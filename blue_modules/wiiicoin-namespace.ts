import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import b58 from 'bs58check';
import type { CoinSelectOutput, CoinSelectReturnInput, CoinSelectTarget, CoinSelectUtxo } from 'coinselect';
import { ECPairFactory, type ECPairInterface } from 'ecpair';

import * as BlueElectrum from './BlueElectrum';
import ecc from './noble_ecc';
import { uint8ArrayToHex } from './uint8array-extras';
import { WIIICOIN_ELECTRUM_SERVER, WIIICOIN_NETWORK } from './wiiicoin-network';
import { AbstractHDElectrumWallet } from '../class/wallets/abstract-hd-electrum-wallet';
import { HDSegwitP2SHWallet } from '../class/wallets/hd-segwit-p2sh-wallet';
import type { CreateTransactionTarget, Utxo } from '../class/wallets/types';

const ElectrumClient = require('electrum-client');
const net = require('net');
const tls = require('tls');
const ECPair = ECPairFactory(ecc);

export const WIII_OP_NAMESPACE = 0xd0;
export const WIII_OP_PUT = 0xd1;
export const WIII_OP_DELETE = 0xd2;
export const WIII_NAMESPACE_TX_VERSION = 0x7100;
export const WIII_NAMESPACE_VALUE = 1_000_000;
export const WIII_NAMESPACE_TRANSFER_KEY_PREFIX = '__WALLET_TRANSFER__';

const DUMMY_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';
// Retained for wire compatibility with the original namespace protocol.
const ROOT_NAMESPACE_KEY = Buffer.from('\x01_KEVA_NS_', 'utf8');
const ROOT_NAMESPACE_KEY_HEX = '015f4b4556415f4e535f';
const MAX_NAMESPACE_NAME_BYTES = 255;
const MAX_NAMESPACE_KEY_BYTES = 255;
const MAX_NAMESPACE_VALUE_BYTES = 3072;

const TRANSACTION_INFO_METHODS = [
  'blockchain.wiii.get_transactions_info',
  'blockchain.wiiicoin.get_transactions_info',
  'blockchain.namespace.get_transactions_info',
];
const KEY_VALUES_METHODS = ['blockchain.wiii.get_keyvalues', 'blockchain.wiiicoin.get_keyvalues', 'blockchain.namespace.get_keyvalues'];

type NamespaceElectrumClient = {
  initElectrum(config: { client: string; version: string }, policy?: { maxRetry: number; callback: () => void }): Promise<unknown>;
  request(method: string, params: unknown[]): Promise<any>;
  blockchainScripthash_getHistory(scripthash: string): Promise<Array<{ tx_hash: string; height: number }>>;
  close(): void;
  onError?: (error: { message?: string }) => void;
};

type NamespaceCoinSelectOutput = CoinSelectOutput & {
  script?: {
    length?: number;
    hex?: string;
  };
};

type NamespaceCoinSelectResult = {
  inputs?: CoinSelectReturnInput[];
  outputs?: NamespaceCoinSelectOutput[];
  fee: number;
};

type AccumulativeCoinSelector = (utxos: CoinSelectUtxo[], targets: CoinSelectTarget[], feeRate: number) => NamespaceCoinSelectResult;

const coinSelectAccumulative = require('coinselect/accumulative') as AccumulativeCoinSelector;

export type NamespaceTransactionInfo = {
  n?: [string, number];
  kv?: {
    op: number;
    key?: string;
    value?: string;
  };
  h?: number;
  o?: unknown[];
};

export type NamespaceSummary = {
  namespaceId: string;
  displayName: string;
  bio?: string;
  ownerAddress: string;
  txid: string;
  vout: number;
  height?: number;
};

export type NamespaceKeyValue = {
  key: string;
  value: string;
  txid?: string;
  height?: number;
  time?: number;
  type?: string;
};

export type NamespaceTransactionResult = {
  tx: string;
  fee: number;
  namespaceId?: string;
  controlTxid?: string;
  controlVout?: number;
};

export type NamespaceWallet = HDSegwitP2SHWallet;

export class NamespaceRpcUnavailableError extends Error {
  constructor() {
    super('The connected ElectrumX server does not provide Wiiicoin namespace RPC methods.');
    this.name = 'NamespaceRpcUnavailableError';
  }
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes).reverse();
}

function utf8(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'utf8'));
}

function decodeBase64(value?: string): string {
  if (!value) return '';
  return Buffer.from(value, 'base64').toString('utf8');
}

function decodeBase64Bytes(value?: string): Uint8Array {
  if (!value) return new Uint8Array();
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

function assertByteLength(value: string, limit: number, label: string): void {
  const length = Buffer.byteLength(value, 'utf8');
  if (length === 0) throw new Error(`${label} cannot be empty.`);
  if (length > limit) throw new Error(`${label} exceeds the ${limit}-byte limit.`);
}

export function namespaceToPayload(namespaceId: string): Uint8Array {
  try {
    const decoded = b58.decode(namespaceId);
    if (decoded.length !== 21 || decoded[0] !== 53) throw new Error('invalid payload');
    return Uint8Array.from(decoded);
  } catch {
    throw new Error('Invalid Wiiicoin namespace ID.');
  }
}

export function payloadToNamespace(payload: Uint8Array): string {
  if (payload.length !== 21 || payload[0] !== 53) throw new Error('Invalid Wiiicoin namespace payload.');
  return b58.encode(payload);
}

export function deriveNamespacePayload(txid: string, vout: number): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(txid)) throw new Error('Invalid namespace source transaction ID.');
  if (!Number.isInteger(vout) || vout < 0) throw new Error('Invalid namespace source output index.');
  const source = Buffer.concat([Buffer.from(txid, 'hex').reverse(), Buffer.from(String(vout), 'utf8')]);
  const namespaceHash = bitcoin.crypto.hash160(source);
  return Uint8Array.from(Buffer.concat([Buffer.from([53]), Buffer.from(namespaceHash)]));
}

export function deriveNamespaceId(txid: string, vout: number): string {
  return payloadToNamespace(deriveNamespacePayload(txid, vout));
}

function addressHash(address: string): Uint8Array {
  return Uint8Array.from(bitcoin.address.fromBase58Check(address).hash);
}

export function getNamespaceCreationScript(displayName: string, address: string, txid: string, vout: number): Uint8Array {
  assertByteLength(displayName, MAX_NAMESPACE_NAME_BYTES, 'Namespace name');
  return bitcoin.script.compile([
    WIII_OP_NAMESPACE,
    deriveNamespacePayload(txid, vout),
    utf8(displayName),
    bitcoin.opcodes.OP_2DROP,
    bitcoin.opcodes.OP_HASH160,
    addressHash(address),
    bitcoin.opcodes.OP_EQUAL,
  ]);
}

export function getNamespaceUpdateScript(namespaceId: string, address: string, key: string, value: string): Uint8Array {
  assertByteLength(key, MAX_NAMESPACE_KEY_BYTES, 'Namespace key');
  if (Buffer.byteLength(value, 'utf8') > MAX_NAMESPACE_VALUE_BYTES) {
    throw new Error(`Namespace value exceeds the ${MAX_NAMESPACE_VALUE_BYTES}-byte limit.`);
  }
  return bitcoin.script.compile([
    WIII_OP_PUT,
    namespaceToPayload(namespaceId),
    utf8(key),
    utf8(value),
    bitcoin.opcodes.OP_2DROP,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_HASH160,
    addressHash(address),
    bitcoin.opcodes.OP_EQUAL,
  ]);
}

export function getNamespaceDeleteScript(namespaceId: string, address: string, key: string): Uint8Array {
  assertByteLength(key, MAX_NAMESPACE_KEY_BYTES, 'Namespace key');
  return bitcoin.script.compile([
    WIII_OP_DELETE,
    namespaceToPayload(namespaceId),
    utf8(key),
    bitcoin.opcodes.OP_2DROP,
    bitcoin.opcodes.OP_HASH160,
    addressHash(address),
    bitcoin.opcodes.OP_EQUAL,
  ]);
}

export function getNamespaceScriptHash(namespaceId: string): string {
  const syntheticScript = bitcoin.script.compile([
    WIII_OP_PUT,
    namespaceToPayload(namespaceId),
    new Uint8Array(),
    bitcoin.opcodes.OP_2DROP,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_RETURN,
  ]);
  return uint8ArrayToHex(reverseBytes(bitcoin.crypto.sha256(syntheticScript)));
}

export function getRootNamespaceScriptHash(namespaceId: string): string {
  const rootKey = Uint8Array.from(Buffer.concat([Buffer.from(namespaceToPayload(namespaceId)), ROOT_NAMESPACE_KEY]));
  const syntheticScript = bitcoin.script.compile([
    WIII_OP_PUT,
    rootKey,
    new Uint8Array(),
    bitcoin.opcodes.OP_2DROP,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_RETURN,
  ]);
  return uint8ArrayToHex(reverseBytes(bitcoin.crypto.sha256(syntheticScript)));
}

export function isNamespaceCapableWallet(wallet: unknown): wallet is NamespaceWallet {
  return wallet instanceof HDSegwitP2SHWallet && !!wallet.getSecret() && wallet.allowSend();
}

async function connectNamespaceElectrum(): Promise<NamespaceElectrumClient> {
  const preferred = await BlueElectrum.getPreferredServer();
  const host = preferred?.host ?? WIIICOIN_ELECTRUM_SERVER.host;
  const ssl = preferred?.host ? preferred.ssl : WIIICOIN_ELECTRUM_SERVER.ssl;
  const tcp = preferred?.host ? preferred.tcp : undefined;
  const port = ssl ?? tcp;
  if (!port) throw new Error('No Wiiicoin Electrum server is configured.');

  const client: NamespaceElectrumClient = new ElectrumClient(net, tls, port, host, ssl ? 'tls' : 'tcp');
  client.onError = () => {};
  await client.initElectrum({ client: 'Wiiiwallet', version: '1.4' }, { maxRetry: 0, callback: () => {} });
  return client;
}

async function requestWithFallback(client: NamespaceElectrumClient, methods: string[], params: unknown[]): Promise<any> {
  let methodUnavailable = false;
  for (const method of methods) {
    try {
      return await client.request(method, params);
    } catch (error: any) {
      const message = String(error?.message ?? error).toLowerCase();
      const code = Number(error?.code);
      if (code === -32601 || message.includes('method not found') || message.includes('unknown method')) {
        methodUnavailable = true;
        continue;
      }
      throw error;
    }
  }
  if (methodUnavailable) throw new NamespaceRpcUnavailableError();
  throw new Error('Namespace request failed.');
}

async function withNamespaceElectrum<T>(work: (client: NamespaceElectrumClient) => Promise<T>): Promise<T> {
  const client = await connectNamespaceElectrum();
  try {
    return await work(client);
  } finally {
    try {
      client.close();
    } catch {}
  }
}

async function getTransactionInfo(
  client: NamespaceElectrumClient,
  txids: string[],
  namespaceInfo = true,
): Promise<Record<string, NamespaceTransactionInfo>> {
  const uniqueTxids = [...new Set(txids.filter(Boolean))];
  if (uniqueTxids.length === 0) return {};
  const response = await requestWithFallback(client, TRANSACTION_INFO_METHODS, [uniqueTxids, namespaceInfo]);
  if (!Array.isArray(response)) return response ?? {};
  return Object.fromEntries(uniqueTxids.map((txid, index) => [txid, response[index] ?? {}]));
}

function parseNamespaceInfo(
  namespaceId: string,
  history: Array<{ tx_hash: string; height: number }>,
  txs: Record<string, NamespaceTransactionInfo>,
) {
  for (const item of history.slice().reverse()) {
    const tx = txs[item.tx_hash];
    if (!tx?.n || !tx.kv || tx.kv.op === WIII_OP_DELETE) continue;
    if (tx.kv.op === WIII_OP_NAMESPACE) {
      return { namespaceId, displayName: decodeBase64(tx.kv.key), height: item.height };
    }
    if (tx.kv.op === WIII_OP_PUT) {
      const keyHex = uint8ArrayToHex(decodeBase64Bytes(tx.kv.key));
      if (!keyHex.startsWith(ROOT_NAMESPACE_KEY_HEX)) continue;
      const value = decodeBase64(tx.kv.value);
      try {
        const profile = JSON.parse(value);
        return {
          namespaceId,
          displayName: typeof profile.displayName === 'string' ? profile.displayName : namespaceId,
          bio: typeof profile.bio === 'string' ? profile.bio : undefined,
          height: item.height,
        };
      } catch {
        return { namespaceId, displayName: namespaceId, height: item.height };
      }
    }
  }
  return { namespaceId, displayName: namespaceId };
}

async function getNamespaceInfo(client: NamespaceElectrumClient, namespaceId: string) {
  const history = await client.blockchainScripthash_getHistory(getRootNamespaceScriptHash(namespaceId));
  if (!history?.length) return { namespaceId, displayName: namespaceId };
  const txs = await getTransactionInfo(
    client,
    history.map(item => item.tx_hash),
    true,
  );
  return parseNamespaceInfo(namespaceId, history, txs);
}

async function refreshWallet(wallet: NamespaceWallet): Promise<Utxo[]> {
  await wallet.fetchBalance();
  await wallet.fetchTransactions();
  await wallet.fetchUtxo();
  return wallet.getUtxo(true);
}

async function classifyNamespaceUtxos(
  client: NamespaceElectrumClient,
  utxos: Utxo[],
): Promise<{ namespaceUtxos: Array<Utxo & { namespaceId: string }>; spendableUtxos: Utxo[] }> {
  const txInfo = await getTransactionInfo(
    client,
    utxos.map(utxo => utxo.txid),
    true,
  );
  const namespaceUtxos: Array<Utxo & { namespaceId: string }> = [];
  const spendableUtxos: Utxo[] = [];
  for (const utxo of utxos) {
    const namespace = txInfo[utxo.txid]?.n;
    if (namespace && Number(namespace[1]) === utxo.vout) {
      namespaceUtxos.push({ ...utxo, namespaceId: namespace[0] });
    } else {
      spendableUtxos.push(utxo);
    }
  }
  return { namespaceUtxos, spendableUtxos };
}

export async function fetchWalletNamespaces(wallet: NamespaceWallet): Promise<NamespaceSummary[]> {
  if (!isNamespaceCapableWallet(wallet)) throw new Error('Namespaces require a writable wrapped SegWit wallet.');
  const utxos = await refreshWallet(wallet);
  return withNamespaceElectrum(async client => {
    const { namespaceUtxos } = await classifyNamespaceUtxos(client, utxos);
    const summaries = await Promise.all(
      namespaceUtxos.map(async utxo => {
        wallet.setUTXOMetadata(utxo.txid, utxo.vout, { frozen: true });
        const info = await getNamespaceInfo(client, utxo.namespaceId);
        return {
          namespaceId: utxo.namespaceId,
          displayName: info.displayName || utxo.namespaceId,
          bio: info.bio,
          ownerAddress: utxo.address,
          txid: utxo.txid,
          vout: utxo.vout,
          height: utxo.height || info.height,
        };
      }),
    );
    return summaries.sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  });
}

export async function fetchNamespaceKeyValues(namespaceId: string): Promise<NamespaceKeyValue[]> {
  namespaceToPayload(namespaceId);
  return withNamespaceElectrum(async client => {
    const response = await requestWithFallback(client, KEY_VALUES_METHODS, [getNamespaceScriptHash(namespaceId), -1]);
    const values = Array.isArray(response) ? response : (response?.keyvalues ?? []);
    return values.map((item: any) => ({
      key: decodeBase64(item.key),
      value: decodeBase64(item.value),
      txid: item.tx_hash,
      height: item.height,
      time: item.time,
      type: item.type,
    }));
  });
}

function selectNamespaceInputs(
  utxos: Utxo[],
  targets: CreateTransactionTarget[],
  feeRate: number,
): { inputs: CoinSelectReturnInput[]; outputs: NamespaceCoinSelectOutput[]; fee: number } {
  const preparedUtxos = JSON.parse(JSON.stringify(utxos)) as CoinSelectUtxo[];
  const preparedTargets = JSON.parse(JSON.stringify(targets)) as CreateTransactionTarget[];

  for (const utxo of preparedUtxos) {
    if (!utxo.script?.length) utxo.script = { length: 50 };
  }
  for (const target of preparedTargets) {
    if (target.script?.hex) target.script.length = target.script.hex.length / 2 - 4;
  }

  const { inputs, outputs, fee } = coinSelectAccumulative(preparedUtxos, preparedTargets as CoinSelectTarget[], feeRate);
  if (!inputs || !outputs) throw new Error('Not enough spendable balance for the namespace transaction.');
  return { inputs, outputs, fee };
}

function addAndSignInputs(wallet: NamespaceWallet, psbt: bitcoin.Psbt, inputs: CoinSelectReturnInput[]): void {
  const keyPairs: ECPairInterface[] = [];
  inputs.forEach(input => {
    const address = String(input.address ?? '');
    if (!address) throw new Error('Unable to derive the signing key for a namespace input.');
    const wif = wallet._getWifForAddress(address);
    wallet._addPsbtInput(psbt, input, AbstractHDElectrumWallet.defaultRBFSequence, new Uint8Array([0, 0, 0, 0]));
    keyPairs.push(ECPair.fromWIF(wif, WIIICOIN_NETWORK));
  });
  keyPairs.forEach((keyPair, index) => psbt.signInput(index, keyPair));
}

function addOutputs(psbt: bitcoin.Psbt, outputs: NamespaceCoinSelectOutput[], namespaceScript: Uint8Array, changeAddress: string): void {
  let namespaceOutputAdded = false;
  for (const output of outputs) {
    if (output.script?.hex && !namespaceOutputAdded) {
      psbt.addOutput({ script: namespaceScript, value: BigInt(output.value) });
      namespaceOutputAdded = true;
      continue;
    }
    const address = output.address ?? changeAddress;
    psbt.addOutput({ address, value: BigInt(output.value) });
  }
  if (!namespaceOutputAdded) throw new Error('Namespace output was not selected.');
}

function buildSignedTransaction(
  wallet: NamespaceWallet,
  inputs: CoinSelectReturnInput[],
  outputs: NamespaceCoinSelectOutput[],
  namespaceScript: Uint8Array,
  changeAddress: string,
): Pick<NamespaceTransactionResult, 'tx' | 'controlTxid' | 'controlVout'> {
  const psbt = new bitcoin.Psbt({ network: WIIICOIN_NETWORK });
  psbt.setVersion(WIII_NAMESPACE_TX_VERSION);
  addAndSignInputs(wallet, psbt, inputs);
  addOutputs(psbt, outputs, namespaceScript, changeAddress);
  psbt.finalizeAllInputs();

  const transaction = psbt.extractTransaction(true);
  const controlVout = transaction.outs.findIndex(output => uint8ArrayToHex(output.script) === uint8ArrayToHex(namespaceScript));
  if (controlVout < 0) throw new Error('Unable to locate the namespace control output.');
  return { tx: transaction.toHex(), controlTxid: transaction.getId(), controlVout };
}

async function estimateNamespaceFeeRate(): Promise<number> {
  try {
    return Math.max(1, await BlueElectrum.estimateFee(6));
  } catch {
    return 1;
  }
}

export async function createNamespace(wallet: NamespaceWallet, displayName: string): Promise<NamespaceTransactionResult> {
  if (!isNamespaceCapableWallet(wallet)) throw new Error('Namespaces require a writable wrapped SegWit wallet.');
  assertByteLength(displayName.trim(), MAX_NAMESPACE_NAME_BYTES, 'Namespace name');
  const namespaceAddress = await wallet.getAddressAsync();
  const changeAddress = await wallet.getChangeAddressAsync();
  if (!namespaceAddress || !changeAddress) throw new Error('Unable to derive namespace wallet addresses.');
  const feeRate = await estimateNamespaceFeeRate();
  const utxos = await refreshWallet(wallet);
  return withNamespaceElectrum(async client => {
    const { spendableUtxos } = await classifyNamespaceUtxos(client, utxos);
    const dummyScript = getNamespaceCreationScript(displayName.trim(), namespaceAddress, DUMMY_TXID, 0);
    const targets: CreateTransactionTarget[] = [
      { value: WIII_NAMESPACE_VALUE, script: { hex: uint8ArrayToHex(dummyScript), length: dummyScript.length } },
    ];
    const { inputs, outputs, fee } = selectNamespaceInputs(spendableUtxos, targets, feeRate);
    if (inputs.length === 0) throw new Error('Not enough spendable balance to create a namespace.');
    const sourceTxid = String(inputs[0].txid);
    const sourceVout = Number(inputs[0].vout);
    const namespaceScript = getNamespaceCreationScript(displayName.trim(), namespaceAddress, sourceTxid, sourceVout);
    return {
      ...buildSignedTransaction(wallet, inputs, outputs, namespaceScript, changeAddress),
      namespaceId: deriveNamespaceId(sourceTxid, sourceVout),
      fee,
    };
  });
}

async function buildNamespaceMutation(
  wallet: NamespaceWallet,
  namespaceId: string,
  scriptFactory: (ownerAddress: string) => Uint8Array,
  newOwnerAddress?: string,
): Promise<NamespaceTransactionResult> {
  if (!isNamespaceCapableWallet(wallet)) throw new Error('Namespaces require a writable wrapped SegWit wallet.');
  namespaceToPayload(namespaceId);
  const feeRate = await estimateNamespaceFeeRate();
  const utxos = await refreshWallet(wallet);
  return withNamespaceElectrum(async client => {
    const { namespaceUtxos, spendableUtxos } = await classifyNamespaceUtxos(client, utxos);
    const namespaceUtxo = namespaceUtxos.find(utxo => utxo.namespaceId === namespaceId);
    if (!namespaceUtxo) throw new Error('The namespace control output is not available in this wallet.');
    const ownerAddress = newOwnerAddress ?? namespaceUtxo.address;
    const namespaceScript = scriptFactory(ownerAddress);
    const targets: CreateTransactionTarget[] = [
      { value: WIII_NAMESPACE_VALUE, script: { hex: uint8ArrayToHex(namespaceScript), length: namespaceScript.length } },
    ];
    const { inputs, outputs, fee } = selectNamespaceInputs([namespaceUtxo, ...spendableUtxos], targets, feeRate);
    const usesControlOutput = inputs.some(input => String(input.txid) === namespaceUtxo.txid && Number(input.vout) === namespaceUtxo.vout);
    if (!usesControlOutput) throw new Error('Namespace control output was not selected.');
    return {
      ...buildSignedTransaction(wallet, inputs, outputs, namespaceScript, namespaceUtxo.address),
      fee,
    };
  });
}

export async function setNamespaceKey(
  wallet: NamespaceWallet,
  namespaceId: string,
  key: string,
  value: string,
): Promise<NamespaceTransactionResult> {
  return buildNamespaceMutation(wallet, namespaceId, ownerAddress => getNamespaceUpdateScript(namespaceId, ownerAddress, key, value));
}

export async function deleteNamespaceKey(wallet: NamespaceWallet, namespaceId: string, key: string): Promise<NamespaceTransactionResult> {
  return buildNamespaceMutation(wallet, namespaceId, ownerAddress => getNamespaceDeleteScript(namespaceId, ownerAddress, key));
}

export async function transferNamespace(
  wallet: NamespaceWallet,
  namespaceId: string,
  newOwnerAddress: string,
): Promise<NamespaceTransactionResult> {
  if (!wallet.isAddressValid(newOwnerAddress)) throw new Error('The destination address is not valid for Wiiicoin.');
  const transferKey = `${WIII_NAMESPACE_TRANSFER_KEY_PREFIX}${Date.now()}`;
  return buildNamespaceMutation(
    wallet,
    namespaceId,
    ownerAddress => getNamespaceUpdateScript(namespaceId, ownerAddress, transferKey, ''),
    newOwnerAddress,
  );
}
