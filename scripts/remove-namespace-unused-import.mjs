import fs from 'node:fs';

const path = 'blue_modules/wiiicoin-namespace.ts';
const content = fs.readFileSync(path, 'utf8');
const unusedImport = "import { AbstractHDElectrumWallet } from '../class/wallets/abstract-hd-electrum-wallet';\n";
if (!content.includes(unusedImport)) throw new Error('Expected namespace import was not found.');
fs.writeFileSync(path, content.replace(unusedImport, ''));
console.log('Removed unused namespace RBF import.');
