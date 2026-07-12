import assert from 'assert/strict';
import { createHash } from 'crypto';
import fs from 'fs';
import net from 'net';

import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';

import ecc from './noble-ecc.mjs';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

const RESULT_PATH = 'wiiicoin-smoke-result.json';
const ELECTRUM = { host: 'wiiicoin.io', tcp: 50001 };
const DERIVATION_PATH = "m/44'/9999'/0'/0/0";
const WIIICOIN_NETWORK = {
  messagePrefix: '\x18Wiiicoin Signed Message:\n',
  bech32: 'w3i',
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x87,
  scriptHash: 0x7d,
  wif: 0x89,
};

class ElectrumRpc {
  constructor() {
    this.socket = undefined;
    this.buffer = '';
    this.nextId = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const socket = net.connect(
        {
          host: ELECTRUM.host,
          port: ELECTRUM.tcp,
        },
        resolve,
      );
      this.socket = socket;
      socket.setEncoding('utf8');
      socket.on('data', chunk => this.onData(chunk));
      socket.on('error', reject);
      socket.on('close', () => {
        for (const request of this.pending.values()) {
          clearTimeout(request.timeout);
          request.reject(new Error('Electrum connection closed'));
        }
        this.pending.clear();
      });
    });
  }

  request(method, params = [], timeoutMs = 20_000) {
    if (!this.socket) throw new Error('Electrum socket is not connected');
    const id = ++this.nextId;
    const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Electrum request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.write(payload);
    });
  }

  onData(chunk) {
    this.buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let response;
      try {
        response = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof response.id !== 'number') continue;
      const request = this.pending.get(response.id);
      if (!request) continue;
      clearTimeout(request.timeout);
      this.pending.delete(response.id);
      if (response.error) {
        const message = typeof response.error === 'string' ? response.error : response.error.message || JSON.stringify(response.error);
        request.reject(new Error(message));
      } else {
        request.resolve(response.result);
      }
    }
  }

  close() {
    this.socket?.end();
    this.socket?.destroy();
  }
}

function scriptHashForAddress(address) {
  const script = bitcoin.address.toOutputScript(address, WIIICOIN_NETWORK);
  return Buffer.from(createHash('sha256').update(script).digest()).reverse().toString('hex');
}

function legacyAddressForKey(keyPair) {
  const address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: WIIICOIN_NETWORK }).address;
  if (!address) throw new Error('Unable to derive Wiiicoin legacy address');
  return address;
}

async function createAndBroadcastLegacyTransaction({ rpc, keyPair, sourceAddress, destinationAddress, amount, fee, utxos }) {
  const available = utxos || (await rpc.request('blockchain.scripthash.listunspent', [scriptHashForAddress(sourceAddress)]));
  const selected = [];
  let inputValue = 0;

  for (const utxo of [...available].sort((a, b) => b.value - a.value)) {
    selected.push(utxo);
    inputValue += utxo.value;
    if (inputValue >= amount + fee) break;
  }
  if (inputValue < amount + fee) {
    throw new Error(`Funding wallet balance is insufficient: need ${amount + fee} base units, found ${inputValue}`);
  }

  const psbt = new bitcoin.Psbt({ network: WIIICOIN_NETWORK });
  for (const utxo of selected) {
    const previousHex = await rpc.request('blockchain.transaction.get', [utxo.tx_hash, false]);
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_pos,
      nonWitnessUtxo: Buffer.from(previousHex, 'hex'),
    });
  }

  psbt.addOutput({ address: destinationAddress, value: BigInt(amount) });
  const change = inputValue - amount - fee;
  if (change >= 546) psbt.addOutput({ address: sourceAddress, value: BigInt(change) });

  for (let index = 0; index < selected.length; index++) psbt.signInput(index, keyPair);
  const transaction = psbt.finalizeAllInputs().extractTransaction();
  const hex = transaction.toHex();
  const txid = await rpc.request('blockchain.transaction.broadcast', [hex]);
  const destinationScript = bitcoin.address.toOutputScript(destinationAddress, WIIICOIN_NETWORK);
  const destinationVout = transaction.outs.findIndex(output => Buffer.from(output.script).equals(Buffer.from(destinationScript)));
  if (destinationVout < 0) throw new Error('Unable to locate destination output in transaction');

  return { txid, hex, destinationVout, inputValue, change };
}

const result = {
  generatedAt: new Date().toISOString(),
  electrum: `${ELECTRUM.host}:${ELECTRUM.tcp}`,
  electrumTransport: 'tcp',
  derivationPath: DERIVATION_PATH,
  transactionTest: 'not attempted',
};
const rpc = new ElectrumRpc();

try {
  assert.equal(WIIICOIN_NETWORK.pubKeyHash, 135);
  assert.equal(WIIICOIN_NETWORK.scriptHash, 125);
  assert.equal(WIIICOIN_NETWORK.wif, 137);
  assert.equal(WIIICOIN_NETWORK.bech32, 'w3i');

  const mnemonic = bip39.generateMnemonic(128);
  process.stdout.write(`::add-mask::${mnemonic}\n`);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const child = bip32.fromSeed(seed, WIIICOIN_NETWORK).derivePath(DERIVATION_PATH);
  if (!child.privateKey) throw new Error('Generated HD child has no private key');
  const generatedKey = ECPair.fromPrivateKey(child.privateKey, { network: WIIICOIN_NETWORK });
  const generatedAddress = legacyAddressForKey(generatedKey);
  const decodedAddress = bitcoin.address.fromBase58Check(generatedAddress);
  assert.equal(decodedAddress.version, WIIICOIN_NETWORK.pubKeyHash);

  result.generatedAddress = generatedAddress;
  result.generatedAddressVersion = decodedAddress.version;
  result.generatedWifVersion = WIIICOIN_NETWORK.wif;

  await rpc.connect();
  result.serverVersion = await rpc.request('server.version', ['Wiiiwallet smoke test', '1.4']);
  const header = await rpc.request('blockchain.headers.subscribe');
  result.blockHeight = header?.height;
  result.initialBalance = await rpc.request('blockchain.scripthash.get_balance', [scriptHashForAddress(generatedAddress)]);
  result.initialHistory = await rpc.request('blockchain.scripthash.get_history', [scriptHashForAddress(generatedAddress)]);

  assert.ok(result.serverVersion, 'ElectrumX did not return a server version');
  assert.ok(Number(result.blockHeight) > 0, 'ElectrumX did not return a valid block height');

  const fundingWif = process.env.WIIICOIN_TEST_WIF?.trim();
  if (!fundingWif) {
    result.transactionTest = 'skipped: WIIICOIN_TEST_WIF secret is not configured';
  } else {
    process.stdout.write(`::add-mask::${fundingWif}\n`);
    const fundingKey = ECPair.fromWIF(fundingWif, WIIICOIN_NETWORK);
    const fundingAddress = legacyAddressForKey(fundingKey);
    const amount = Number(process.env.WIIICOIN_TEST_AMOUNT_BASE_UNITS || '1000000');
    const fee = Number(process.env.WIIICOIN_TEST_FEE_BASE_UNITS || '100000');
    result.fundingAddress = fundingAddress;
    result.amountBaseUnits = amount;
    result.feeBaseUnits = fee;

    const fundingTx = await createAndBroadcastLegacyTransaction({
      rpc,
      keyPair: fundingKey,
      sourceAddress: fundingAddress,
      destinationAddress: generatedAddress,
      amount,
      fee,
    });
    result.fundingTxid = fundingTx.txid;

    const returnAmount = amount - fee;
    if (returnAmount < 546) throw new Error('Configured test amount is too small for the return transaction');
    const returnTx = await createAndBroadcastLegacyTransaction({
      rpc,
      keyPair: generatedKey,
      sourceAddress: generatedAddress,
      destinationAddress: fundingAddress,
      amount: returnAmount,
      fee,
      utxos: [
        {
          height: 0,
          tx_hash: fundingTx.txid,
          tx_pos: fundingTx.destinationVout,
          value: amount,
        },
      ],
    });
    result.returnTxid = returnTx.txid;
    result.transactionTest = 'passed: generated wallet funded and returned funds through ElectrumX';

    assert.match(fundingTx.txid, /^[0-9a-f]{64}$/i);
    assert.match(returnTx.txid, /^[0-9a-f]{64}$/i);
  }

  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = error instanceof Error ? error.stack || error.message : String(error);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log('WIIICOIN_SMOKE_RESULT', JSON.stringify(result));
  rpc.close();
}
