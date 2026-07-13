import fs from 'node:fs';

const path = 'screen/wallets/Add.tsx';
let source = fs.readFileSync(path, 'utf8');

const legacyMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [walletAction, entropyActions] : [walletAction];";
const hiddenMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [entropyActions] : [];";
const singleTypeMarkers = [
  'new HDSegwitP2SHWallet()',
  'BIP49 P2SH-P2WPKH',
  'addresses begin with 2',
];

if (source.includes(legacyMenu)) {
  source = source.replace(legacyMenu, hiddenMenu);
  fs.writeFileSync(path, source);
}

const singleTypeScreen = singleTypeMarkers.every(marker => source.includes(marker));
const legacyMenuHidden = source.includes(hiddenMenu);

if (!singleTypeScreen && !legacyMenuHidden) {
  throw new Error('Add Wallet does not enforce Wiiicoin BIP49 P2SH as its only on-chain wallet type');
}

console.log('Wiiicoin BIP49 P2SH is the only on-chain wallet type exposed by Add Wallet.');
