import { HDSegwitP2SHWallet } from './wallets/hd-segwit-p2sh-wallet';

/**
 * Restores the single on-chain wallet format supported by Wiiiwallet.
 *
 * New Wiiiwallet wallets use BIP49 P2SH-P2WPKH at the Wiiicoin coin type.
 * Mnemonic restore must use that same wallet class and derivation path rather
 * than BlueWallet's generic BIP84 discovery fallback.
 */
export function createWiiicoinWalletFromMnemonic(mnemonic: string, passphrase?: string): HDSegwitP2SHWallet {
  const wallet = new HDSegwitP2SHWallet();
  wallet.setSecret(mnemonic);

  if (!wallet.validateMnemonic()) {
    throw new Error('Invalid mnemonic');
  }

  if (passphrase !== undefined) {
    wallet.setPassphrase(passphrase);
  }

  return wallet;
}

export function isValidWiiicoinMnemonic(mnemonic: string): boolean {
  const wallet = new HDSegwitP2SHWallet();
  wallet.setSecret(mnemonic);
  return wallet.validateMnemonic();
}
