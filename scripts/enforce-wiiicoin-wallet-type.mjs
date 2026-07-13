import fs from 'node:fs';

const path = 'screen/wallets/Add.tsx';
let source = fs.readFileSync(path, 'utf8');

const original = "return selectedWalletType === ButtonSelected.ONCHAIN ? [walletAction, entropyActions] : [walletAction];";
const replacement = "return selectedWalletType === ButtonSelected.ONCHAIN ? [entropyActions] : [];";

if (!source.includes(original) && !source.includes(replacement)) {
  throw new Error('Unable to locate the Add Wallet address-type menu');
}

source = source.replace(original, replacement);
fs.writeFileSync(path, source);

console.log('Wiiicoin BIP49 P2SH is the only on-chain wallet type exposed by Add Wallet.');
