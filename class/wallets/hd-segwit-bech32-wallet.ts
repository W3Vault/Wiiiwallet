import BIP32Factory from 'bip32';

import ecc from '../../blue_modules/noble_ecc';
import { WIIICOIN_DERIVATION_PATHS, WIIICOIN_NETWORK } from '../../blue_modules/wiiicoin-network';
import { AbstractHDElectrumWallet } from './abstract-hd-electrum-wallet';

const bip32 = BIP32Factory(ecc);

/** Wiiicoin BIP39 HD wallet using native SegWit addresses. */
export class HDSegwitBech32Wallet extends AbstractHDElectrumWallet {
  static readonly type = 'HDsegwitBech32';
  static readonly typeReadable = 'Wiiicoin HD SegWit (BIP84)';
  // @ts-ignore: override
  public readonly type = HDSegwitBech32Wallet.type;
  // @ts-ignore: override
  public readonly typeReadable = HDSegwitBech32Wallet.typeReadable;
  public readonly segwitType = 'p2wpkh';
  static readonly derivationPath = WIIICOIN_DERIVATION_PATHS.nativeSegwit;

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

  // PayJoin endpoints in the upstream application are Bitcoin-specific.
  allowPayJoin() {
    return false;
  }

  allowCosignPsbt() {
    return true;
  }

  isSegwit() {
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

  // Enable these only after Wiiicoin-specific protocol compatibility is tested.
  allowBIP47() {
    return false;
  }

  allowSilentPaymentSend(): boolean {
    return false;
  }
}
