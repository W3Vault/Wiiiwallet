import assert from 'assert';

import { WIIICOIN_DERIVATION_PATHS } from '../../blue_modules/wiiicoin-network';
import { createWiiicoinWalletFromMnemonic, isValidWiiicoinMnemonic } from '../../class/wiiicoin-wallet-restore';
import { HDSegwitP2SHWallet } from '../../class/wallets/hd-segwit-p2sh-wallet';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('Wiiicoin mnemonic restore', () => {
  it('restores the same BIP49 P2SH address used by wallet creation', () => {
    const createdWallet = new HDSegwitP2SHWallet();
    createdWallet.setSecret(mnemonic);

    const restoredWallet = createWiiicoinWalletFromMnemonic(mnemonic);
    const createdAddress = createdWallet._getExternalAddressByIndex(0);
    const restoredAddress = restoredWallet._getExternalAddressByIndex(0);

    assert.strictEqual(restoredWallet.type, HDSegwitP2SHWallet.type);
    assert.strictEqual(restoredWallet.getDerivationPath(), WIIICOIN_DERIVATION_PATHS.wrappedSegwit);
    assert.strictEqual(restoredAddress, createdAddress);
    assert.ok(restoredAddress.startsWith('2'));
    assert.ok(!restoredAddress.startsWith('w3i1'));
  });

  it('validates mnemonic input without selecting a Bech32 wallet', () => {
    assert.strictEqual(isValidWiiicoinMnemonic(mnemonic), true);
    assert.strictEqual(isValidWiiicoinMnemonic('not a valid mnemonic'), false);
  });
});
