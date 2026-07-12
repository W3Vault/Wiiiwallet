import BIP32Factory, { BIP32Interface } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { Psbt } from 'bitcoinjs-lib';
import { CoinSelectReturnInput } from 'coinselect';

import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import ecc from '../../blue_modules/noble_ecc';
import { hexToUint8Array } from '../../blue_modules/uint8array-extras';
import { WIIICOIN_DERIVATION_PATHS, WIIICOIN_NETWORK } from '../../blue_modules/wiiicoin-network';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';

const bip32 = BIP32Factory(ecc);

/** Wiiicoin BIP39 HD wallet using legacy P2PKH addresses. */
export class HDLegacyP2PKHWallet extends AbstractHDElectrumWallet {
  static readonly type = 'HDlegacyP2PKH';
  static readonly typeReadable = 'Wiiicoin HD Legacy (BIP44 P2PKH)';
  // @ts-ignore: override
  public readonly type = HDLegacyP2PKHWallet.type;
  // @ts-ignore: override
  public readonly typeReadable = HDLegacyP2PKHWallet.typeReadable;
  static readonly derivationPath = WIIICOIN_DERIVATION_PATHS.legacy;

  _getWIFByIndex(internal: boolean, index: number): string | false {
    if (!this.secret) return false;
    const root = bip32.fromSeed(this._getSeed(), WIIICOIN_NETWORK);
    const path = `${this.getDerivationPath()}/${internal ? 1 : 0}/${index}`;
    return root.derivePath(path).toWIF();
  }

  allowSend() {
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

  allowBIP47() {
    return false;
  }

  getXpub() {
    if (this._xpub) return this._xpub;

    const root = bip32.fromSeed(this._getSeed(), WIIICOIN_NETWORK);
    const path = this.getDerivationPath();
    if (!path) throw new Error('Internal error: no path');
    this._xpub = root.derivePath(path).neutered().toBase58();
    return this._xpub;
  }

  _hdNodeToAddress(hdNode: BIP32Interface): string {
    const address = bitcoin.payments.p2pkh({ pubkey: hdNode.publicKey, network: WIIICOIN_NETWORK }).address;
    if (!address) throw new Error('Unable to derive Wiiicoin P2PKH address');
    return address;
  }

  async fetchUtxo(): Promise<void> {
    await super.fetchUtxo();
    const txhexes = await BlueElectrum.multiGetTransactionByTxid(
      this.getUtxo().map(x => x.txid),
      false,
    );

    for (const u of this.getUtxo()) {
      if (txhexes[u.txid]) u.txhex = txhexes[u.txid];
    }
  }

  _addPsbtInput(psbt: Psbt, input: CoinSelectReturnInput, sequence: number, masterFingerprintBuffer: Uint8Array) {
    if (!input.address) throw new Error('Internal error: no address on Utxo during _addPsbtInput()');
    const pubkey = this._getPubkeyByAddress(input.address);
    const path = this._getDerivationPathByAddress(input.address);
    if (!pubkey || !path) throw new Error('Internal error: pubkey or path are invalid');
    if (!input.txhex) throw new Error('UTXO is missing txhex of the input, which is required by PSBT for non-segwit input');

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
      nonWitnessUtxo: hexToUint8Array(input.txhex),
    });

    return psbt;
  }

  allowSilentPaymentSend(): boolean {
    return false;
  }
}
