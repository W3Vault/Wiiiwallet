import { createHash } from 'crypto';
import * as fs from 'fs';
import * as tls from 'tls';

import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairInterface } from 'ecpair';

import ecc from '../../blue_modules/noble_ecc';
import {
  WIIICOIN_DERIVATION_PATHS,
  WIIICOIN_ELECTRUM_SERVER,
  WIIICOIN_NETWORK,
} from '../../blue_modules/wiiicoin-network';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
const RESULT_PATH = 'wiiicoin-smoke-result.json';

type ElectrumResponse = {
  id?: number;
  result?: any;
  error?: { code?: number; message?: string } | string | null;
};

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
};

type ElectrumUtxo = {
  height: number;
  tx_hash: string;
  tx_pos: number;
  value: number;
};

class ElectrumRpc {
  private socket?: tls.TLSSocket;
  private buffer = '';
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect(
        {
          host: WIIICOIN_ELECTRUM_SERVER.host,
          port: WIIICOIN_ELECTRUM_SERVER.ssl,
          servername: WIIICOIN_ELECTRUM_SERVER.host,
          rejectUnauthorized: false,
        },
        () => resolve(),
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

  request(method: string, params: any[] = [], timeoutMs = 20_000): Promise<any> {
    if (!this.socket) throw new Error('Electrum socket is not connected');
    const id = ++this.nextId;
    const payload = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Electrum request timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      this.socket!.write(payload);
    });
  }

  close(): void {
    this.socket?.end();
    this.socket?.destroy();
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let response: ElectrumResponse;
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
}

function scriptHashForAddress(address: string): string {
  const script = bitcoin.address.toOutputScript(address, WIIICOIN_NETWORK);
  return Buffer.from(createHash('sha256').update(script).digest()).reverse().toString('hex');
}

function legacyAddressForKey(keyPair: ECPairInterface): string {
  const address = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: WIIICOIN_NETWORK }).address;
  if (!address) throw new Error('Unable to derive Wiiicoin legacy address');
  return address;
}

async function createAndBroadcastLegacyTransaction(args: {
  rpc: ElectrumRpc;
  keyPair: ECPairInterface;
  sourceAddress: string;
  destinationAddress: string;
  amount: number;
  fee: number;
  utxos?: ElectrumUtxo[];
}): Promise<{ txid: string; hex: string; destinationVout: number; inputValue: number; change: number }> {
  const { rpc, keyPair, sourceAddress, destinationAddress, amount, fee } = args;
  const available = args.utxos || ((await rpc.request('blockchain.scripthash.listunspent', [scriptHashForAddress(sourceAddress)])) as ElectrumUtxo[]);
  const selected: ElectrumUtxo[] = [];
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
    const previousHex = (await rpc.request('blockchain.transaction.get', [utxo.tx_hash, false])) as string;
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
  const txid = (await rpc.request('blockchain.transaction.broadcast', [hex])) as string;
  const destinationScript = bitcoin.address.toOutputScript(destinationAddress, WIIICOIN_NETWORK);
  const destinationVout = transaction.outs.findIndex(output => Buffer.from(output.script).equals(Buffer.from(destinationScript)));
  if (destinationVout < 0) throw new Error('Unable to locate destination output in transaction');

  return { txid, hex, destinationVout, inputValue, change };
}

jest.setTimeout(180_000);

describe('Wiiicoin live wallet and ElectrumX smoke test', () => {
  it('generates a wallet, connects to ElectrumX and optionally completes a round-trip transaction', async () => {
    const rpc = new ElectrumRpc();
    const result: Record<string, any> = {
      generatedAt: new Date().toISOString(),
      electrum: `${WIIICOIN_ELECTRUM_SERVER.host}:${WIIICOIN_ELECTRUM_SERVER.ssl}`,
      transactionTest: 'not attempted',
    };

    try {
      await rpc.connect();
      result.serverVersion = await rpc.request('server.version', ['Wiiiwallet smoke test', '1.4']);
      const header = await rpc.request('blockchain.headers.subscribe');
      result.blockHeight = header?.height;

      const mnemonic = bip39.generateMnemonic(128);
      // Prevent accidental disclosure if a future assertion includes the mnemonic.
      process.stdout.write(`::add-mask::${mnemonic}\n`);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const child = bip32.fromSeed(seed, WIIICOIN_NETWORK).derivePath(`${WIIICOIN_DERIVATION_PATHS.legacy}/0/0`);
      if (!child.privateKey) throw new Error('Generated HD child has no private key');
      const generatedKey = ECPair.fromPrivateKey(child.privateKey, { network: WIIICOIN_NETWORK });
      const generatedAddress = legacyAddressForKey(generatedKey);
      result.generatedAddress = generatedAddress;
      result.generatedAddressVersion = bitcoin.address.fromBase58Check(generatedAddress).version;
      result.initialBalance = await rpc.request('blockchain.scripthash.get_balance', [scriptHashForAddress(generatedAddress)]);
      result.initialHistory = await rpc.request('blockchain.scripthash.get_history', [scriptHashForAddress(generatedAddress)]);

      expect(result.serverVersion).toBeTruthy();
      expect(result.blockHeight).toBeGreaterThan(0);
      expect(result.generatedAddressVersion).toBe(WIIICOIN_NETWORK.pubKeyHash);

      const fundingWif = process.env.WIIICOIN_TEST_WIF?.trim();
      if (!fundingWif) {
        result.transactionTest = 'skipped: WIIICOIN_TEST_WIF secret is not configured';
        return;
      }

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

      // Spend the newly-created output back to the funding address. This proves the
      // generated Wiiiwallet key can sign an actual transaction accepted by ElectrumX.
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

      expect(fundingTx.txid).toMatch(/^[0-9a-f]{64}$/i);
      expect(returnTx.txid).toMatch(/^[0-9a-f]{64}$/i);
    } finally {
      fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
      console.log('WIIICOIN_SMOKE_RESULT', JSON.stringify(result));
      rpc.close();
    }
  });
});
