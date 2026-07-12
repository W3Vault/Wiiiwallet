import * as bitcoin from 'bitcoinjs-lib';
import { CoinSelectTarget } from 'coinselect';
import { ECPairFactory } from 'ecpair';

import ecc from '../../blue_modules/noble_ecc';
import { WIIICOIN_NETWORK } from '../../blue_modules/wiiicoin-network';
import { LegacyWallet } from './legacy-wallet';
import { CreateTransactionResult, CreateTransactionUtxo } from './types';
import { hexToUint8Array } from '../../blue_modules/uint8array-extras';

const ECPair = ECPairFactory(ecc);

/** Creates a Wiiicoin P2SH-wrapped SegWit address. */
function pubkeyToP2shSegwitAddress(pubkey: Uint8Array): string | false {
  const { address } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey, network: WIIICOIN_NETWORK }),
    network: WIIICOIN_NETWORK,
  });
  return address ?? false;
}

export class SegwitP2SHWallet extends LegacyWallet {
  static readonly type = 'segwitP2SH';
  static readonly typeReadable = 'Wiiicoin SegWit (P2SH)';
  // @ts-ignore: override
  public readonly type = SegwitP2SHWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = SegwitP2SHWallet.typeReadable;
  public readonly segwitType = 'p2sh(p2wpkh)';

  static witnessToAddress(witness: string): string | false {
    try {
      const pubKey = hexToUint8Array(witness);
      return pubkeyToP2shSegwitAddress(pubKey);
    } catch (_) {
      return false;
    }
  }

  static scriptPubKeyToAddress(scriptPubKey: string): string | false {
    try {
      const scriptPubKey2 = hexToUint8Array(scriptPubKey);
      return (
        bitcoin.payments.p2sh({
          output: scriptPubKey2,
          network: WIIICOIN_NETWORK,
        }).address ?? false
      );
    } catch (_) {
      return false;
    }
  }

  getAddress(): string | false {
    if (this._address) return this._address;
    let address;
    try {
      const keyPair = ECPair.fromWIF(this.secret, WIIICOIN_NETWORK);
      const pubKey = keyPair.publicKey;
      if (!keyPair.compressed) {
        console.warn('only compressed public keys are good for segwit');
        return false;
      }
      address = pubkeyToP2shSegwitAddress(pubKey);
    } catch (err) {
      return false;
    }
    this._address = address;

    return this._address;
  }

  createTransaction(
    utxos: CreateTransactionUtxo[],
    targets: CoinSelectTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number,
    skipSigning = false,
    masterFingerprint: number,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');
    const { inputs, outputs, fee } = this.coinselect(utxos, targets, feeRate);
    sequence = sequence || 0xffffffff;
    const psbt = new bitcoin.Psbt({ network: WIIICOIN_NETWORK });
    let c = 0;
    const values: Record<number, number> = {};
    const keyPair = ECPair.fromWIF(this.secret, WIIICOIN_NETWORK);

    inputs.forEach(input => {
      values[c] = input.value;
      c++;

      const pubkey = keyPair.publicKey;
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: WIIICOIN_NETWORK });
      const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: WIIICOIN_NETWORK });
      if (!p2sh.output) {
        throw new Error('Internal error: no p2sh.output during createTransaction()');
      }

      psbt.addInput({
        hash: input.txid,
        index: input.vout,
        sequence,
        witnessUtxo: {
          script: p2sh.output,
          value: BigInt(input.value),
        },
        redeemScript: p2wpkh.output,
      });
    });

    outputs.forEach(output => {
      if (!output.address) output.address = changeAddress;
      psbt.addOutput({
        address: output.address,
        value: BigInt(output.value),
      });
    });

    if (!skipSigning) {
      for (let cc = 0; cc < c; cc++) psbt.signInput(cc, keyPair);
    }

    let tx;
    if (!skipSigning) tx = psbt.finalizeAllInputs().extractTransaction();
    return { tx, inputs, outputs, fee, psbt };
  }

  allowSendMax() {
    return true;
  }

  isSegwit() {
    return true;
  }

  allowSignVerifyMessage() {
    return true;
  }
}
