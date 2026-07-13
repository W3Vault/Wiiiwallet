import BIP32Factory, { BIP32Interface } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';
import b58 from 'bs58check';
import { CoinSelectReturnInput } from 'coinselect';
import { ECPairFactory, ECPairInterface } from 'ecpair';

import ecc from '../../blue_modules/noble_ecc';
import { concatUint8Arrays, hexToUint8Array } from '../../blue_modules/uint8array-extras';
import { WIIICOIN_DERIVATION_PATHS, WIIICOIN_NETWORK } from '../../blue_modules/wiiicoin-network';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';
import { CreateTransactionResult, CreateTransactionTarget, CreateTransactionUtxo } from './types';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

/** Wiiicoin BIP39 HD wallet using P2SH-wrapped SegWit addresses. */
export class HDSegwitP2SHWallet extends AbstractHDElectrumWallet {
  static readonly type = 'HDsegwitP2SH';
  static readonly typeReadable = 'Wiiicoin HD SegWit (BIP49 P2SH)';
  // @ts-ignore: override
  public readonly type = HDSegwitP2SHWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = HDSegwitP2SHWallet.typeReadable;
  public readonly segwitType = 'p2sh(p2wpkh)';
  static readonly derivationPath = WIIICOIN_DERIVATION_PATHS.wrappedSegwit;

  _getWIFByIndex(internal: boolean, index: number): string | false {
    if (!this.secret) return false;
    const root = bip32.fromSeed(this._getSeed(), WIIICOIN_NETWORK);
    const path = `${this.getDerivationPath()}/${internal ? 1 : 0}/${index}`;
    return root.derivePath(path).toWIF();
  }

  allowSend() {
    return true;
  }

  allowRBF() {
    return true;
  }

  allowCosignPsbt() {
    return true;
  }

  allowSignVerifyMessage() {
    return true;
  }

  allowMasterFingerprint() {
    return true;
  }

  allowXpub() {
    return true;
  }

  _hdNodeToAddress(hdNode: BIP32Interface): string {
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: hdNode.publicKey, network: WIIICOIN_NETWORK });
    const address = bitcoin.payments.p2sh({ redeem: p2wpkh, network: WIIICOIN_NETWORK }).address;
    if (!address) throw new Error('Unable to derive Wiiicoin P2SH address');
    return address;
  }

  /** Returns a ypub-compatible extended public key for existing UI support. */
  getXpub() {
    if (this._xpub) return this._xpub;

    const root = bip32.fromSeed(this._getSeed(), WIIICOIN_NETWORK);
    const path = this.getDerivationPath();
    if (!path) throw new Error('Internal error: no path');
    const xpub = root.derivePath(path).neutered().toBase58();

    let data = b58.decode(xpub);
    data = data.slice(4);
    this._xpub = b58.encode(concatUint8Arrays([hexToUint8Array('049d7cb2'), data]));
    return this._xpub;
  }

  /**
   * Build and sign a Wiiicoin P2SH-P2WPKH transaction.
   *
   * The upstream transaction builder calls ECPair.fromWIF without a network,
   * which assumes Bitcoin WIF version 0x80. Wiiicoin uses 0x89, so the network
   * must be supplied explicitly here.
   */
  createTransaction(
    utxos: CreateTransactionUtxo[],
    targets: CreateTransactionTarget[],
    feeRate: number,
    changeAddress: string,
    sequence: number = AbstractHDElectrumWallet.defaultRBFSequence,
    skipSigning = false,
    masterFingerprint: number = 0,
  ): CreateTransactionResult {
    if (targets.length === 0) throw new Error('No destination provided');

    const { inputs, outputs, fee } = this.coinselect(utxos, targets, feeRate);
    sequence = sequence || AbstractHDElectrumWallet.defaultRBFSequence;

    const psbt = new bitcoin.Psbt({ network: WIIICOIN_NETWORK });
    const keypairs: Record<number, ECPairInterface> = {};

    let masterFingerprintBuffer: Uint8Array;
    if (masterFingerprint) {
      let masterFingerprintHex = Number(masterFingerprint).toString(16).padStart(8, '0');
      masterFingerprintHex = masterFingerprintHex.slice(-8);
      masterFingerprintBuffer = hexToUint8Array(masterFingerprintHex).reverse();
    } else {
      masterFingerprintBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    }

    inputs.forEach((input, index) => {
      if (!input.address) throw new Error('Internal error: no address on Wiiicoin UTXO');

      if (!skipSigning) {
        const privateKey = this._getWifForAddress(input.address);
        if (!privateKey) throw new Error('Internal error: no Wiiicoin WIF to sign input');
        keypairs[index] = ECPair.fromWIF(privateKey, WIIICOIN_NETWORK);
      }

      this._addPsbtInput(psbt, input, sequence, masterFingerprintBuffer);
    });

    const sanitizedOutputs = outputs.map(output => {
      const outputData = output as typeof output & { script?: { hex?: string } };
      const isChange = !outputData.address && !outputData.script?.hex;
      const address = outputData.address ?? (isChange ? changeAddress : undefined);
      const path = address ? this._getDerivationPathByAddress(address) : false;
      const pubkey = address ? this._getPubkeyByAddress(address) : false;

      const psbtOutput: {
        address?: string;
        script?: Uint8Array;
        value: bigint;
        bip32Derivation?: Array<{ masterFingerprint: Uint8Array; path: string; pubkey: Uint8Array }>;
      } = {
        value: BigInt(outputData.value),
      };

      if (address) psbtOutput.address = address;
      if (outputData.script?.hex) psbtOutput.script = hexToUint8Array(outputData.script.hex);
      if (isChange && path && pubkey) {
        psbtOutput.bip32Derivation = [{ masterFingerprint: masterFingerprintBuffer, path, pubkey }];
      }

      psbt.addOutput(psbtOutput);
      return { ...outputData, address };
    });

    if (!skipSigning) {
      inputs.forEach((_, index) => psbt.signInput(index, keypairs[index]));
    }

    const tx = skipSigning ? undefined : psbt.finalizeAllInputs().extractTransaction();
    return { tx, inputs, outputs: sanitizedOutputs, fee, psbt };
  }

  _addPsbtInput(psbt: Psbt, input: CoinSelectReturnInput, sequence: number, masterFingerprintBuffer: Uint8Array) {
    if (!input.address) throw new Error('Internal error: no address on Utxo during _addPsbtInput()');
    const pubkey = this._getPubkeyByAddress(input.address);
    const path = this._getDerivationPathByAddress(input.address);
    if (!pubkey || !path) throw new Error('Internal error: pubkey or path are invalid');

    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey, network: WIIICOIN_NETWORK });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh, network: WIIICOIN_NETWORK });
    if (!p2sh.output) throw new Error('Internal error: no p2sh.output during _addPsbtInput()');
    if (!p2wpkh.output) throw new Error('Internal error: no redeem script during _addPsbtInput()');

    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      sequence,
      bip32Derivation: [
        {
          masterFingerprint: masterFingerprintBuffer,
          path,
          pubkey,
        },
      ],
      witnessUtxo: {
        script: p2sh.output,
        value: BigInt(input.value),
      },
      redeemScript: p2wpkh.output,
    });

    return psbt;
  }

  isSegwit() {
    return true;
  }

  allowSilentPaymentSend(): boolean {
    return false;
  }
}
