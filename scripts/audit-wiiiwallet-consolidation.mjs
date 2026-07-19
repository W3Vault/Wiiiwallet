import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const requireText = (path, value, label = value) => {
  const content = read(path);
  if (!content.includes(value)) throw new Error(`${path}: missing ${label}`);
};
const forbidText = (path, value, label = value) => {
  const content = read(path);
  if (content.includes(value)) throw new Error(`${path}: still contains ${label}`);
};
const requireOrder = (path, before, after, label) => {
  const content = read(path);
  const beforeIndex = content.indexOf(before);
  const afterIndex = content.indexOf(after);
  if (beforeIndex < 0 || afterIndex < 0 || beforeIndex >= afterIndex) throw new Error(`${path}: invalid order for ${label}`);
};
const requireFile = path => {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
};

const pkg = JSON.parse(read('package.json'));
if (pkg.name !== 'wiiiwallet') throw new Error('package.json: package name is not wiiiwallet');
if (pkg.description !== 'Wiiiwallet mobile wallet for the Wiiicoin blockchain') throw new Error('package.json: Wiiiwallet description is missing');
if (pkg.repository?.url !== 'https://github.com/W3Vault/Wiiiwallet.git') throw new Error('package.json: repository still points away from W3Vault/Wiiiwallet');
if (pkg.scripts?.patches !== 'npx patch-package && npm run audit:wiiiwallet') throw new Error('package.json: postinstall must validate consolidated source rather than mutate it');

requireText('blue_modules/wiiicoin-network.ts', "WIIICOIN_BECH32_HRP = 'w3i'", 'Wiiicoin bech32 prefix');
requireText('blue_modules/wiiicoin-network.ts', 'bech32: WIIICOIN_BECH32_HRP', 'Wiiicoin bech32 network assignment');
requireText('blue_modules/wiiicoin-network.ts', "host: 'etx1.wiiicoin.io'", 'Wiiicoin ElectrumX host');
requireText('components/TransactionsNavigationHeader.tsx', "unit === BitcoinUnit.BTC ? 'Wiii' : unit", 'Wiii wallet unit');
requireText('components/TransactionsNavigationHeader.tsx', 'FiatUnit.GBP', 'GBP wallet header fallback');
requireText('components/WalletsCarousel.tsx', 'testID="wiiicoin-wallet-watermark"', 'Wiiicoin wallet watermark');
requireText('components/WalletsCarousel.tsx', 'color="#FFFFFF"', 'white wallet watermark');
requireText('screen/UnlockWith.tsx', 'testID="rotating-wiiicoin-logo"', 'rotating Wiiicoin unlock logo');
requireText('components/QRCode.tsx', 'testID="qr-wiiicoin-logo"', 'Wiiicoin QR centre logo');
requireText('components/QRCode.tsx', 'dataPaths.map', 'row-based QR rendering fix');
requireText('components/QRCode.tsx', 'key={`${ecl}|${size}|${logoSize}|${isLogoRendered ? 1 : 0}|${value}`}', 'QR first-render key');
requireText('blue_modules/currency.ts', 'const WIIICOIN_GBP_RATE = 10;', 'fixed WIII GBP rate');

requireText('ios/BlueWallet/Info.plist', '<string>Wiiiwallet</string>', 'iOS Wiiiwallet display name');
requireText('ios/BlueWallet/Info.plist', '<string>wiiicoin</string>', 'wiiicoin iOS URL scheme');
requireText('ios/BlueWallet/Info.plist', '<string>wiiiwallet</string>', 'wiiiwallet iOS URL scheme');
requireText('ios/BlueWallet/Info.plist', '<string>Wiiicoin Value</string>', 'Wiiicoin iOS intent name');
forbidText('ios/BlueWallet/Info.plist', '<string>Bitcoin Price</string>', 'visible Bitcoin price branding');

requireText('android/app/src/main/AndroidManifest.xml', 'android:icon="@drawable/wiiicoin_app_icon"', 'Wiiicoin Android app icon');
requireText('android/app/src/main/AndroidManifest.xml', 'android:roundIcon="@drawable/wiiicoin_app_icon"', 'round Wiiicoin Android app icon');
requireText('android/app/src/main/res/values/strings.xml', '<string name="app_name">Wiiiwallet</string>', 'Android Wiiiwallet app name');

requireFile('class/wiiicoin-wallet-restore.ts');
requireFile('tests/unit/wiiicoin-wallet-restore.test.ts');
requireText('class/wiiicoin-wallet-restore.ts', 'new HDSegwitP2SHWallet()', 'BIP49 mnemonic restore wallet class');
requireText('screen/wallets/ImportWalletDiscovery.tsx', 'createWiiicoinWalletFromMnemonic(importText, passphrase)', 'deterministic mnemonic restore');
requireText('screen/wallets/ImportWalletDiscovery.tsx', 'isValidWiiicoinMnemonic(importText)', 'Wiiicoin mnemonic validation');
forbidText('screen/wallets/ImportWalletDiscovery.tsx', 'new HDSegwitBech32Wallet()', 'BIP84 mnemonic restore fallback');
requireText('screen/wallets/ImportSpeed.tsx', 'createWiiicoinWalletFromMnemonic(importText, passphrase || undefined)', 'speed mnemonic restore');
forbidText('screen/wallets/ImportSpeed.tsx', 'HDSegwitBech32Wallet', 'speed BIP84 restore route');
requireText('screen/wallets/ImportCustomDerivationPath.tsx', 'WIIICOIN_DERIVATION_PATHS.wrappedSegwit', 'Wiiicoin BIP49 custom derivation default');
requireText('screen/wallets/ImportCustomDerivationPath.tsx', 'HDSegwitP2SHWallet.type', 'Wiiicoin P2SH custom restore type');

const namespacePath = 'blue_modules/wiiicoin-namespace.ts';
requireText(namespacePath, 'export const WIII_OP_NAMESPACE = 0xd0;', 'namespace create opcode');
requireText(namespacePath, 'export const WIII_OP_PUT = 0xd1;', 'namespace put opcode');
requireText(namespacePath, 'export const WIII_OP_DELETE = 0xd2;', 'namespace delete opcode');
requireText(namespacePath, 'export const WIII_NAMESPACE_TX_VERSION = 0x7100;', 'namespace transaction version');
requireText(namespacePath, 'export const WIII_NAMESPACE_FEE_RATE = 2_000;', 'namespace data-transaction fee floor');
requireText(namespacePath, 'Math.max(WIII_NAMESPACE_FEE_RATE', 'namespace fee estimate floor');
requireText(namespacePath, 'export const WIII_NAMESPACE_SEQUENCE = 0xffffffff;', 'namespace final input sequence');
requireText(namespacePath, 'input, WIII_NAMESPACE_SEQUENCE,', 'namespace sequence applied to every input');
forbidText(namespacePath, 'input, AbstractHDElectrumWallet.defaultRBFSequence,', 'namespace RBF input sequence');
requireText(namespacePath, "Buffer.from('\\x01_WIII_NS_', 'utf8')", 'WIII namespace root marker');
requireText(namespacePath, "'blockchain.wiii.get_transactions_info'", 'WIII namespace transaction RPC');
requireText(namespacePath, "'blockchain.wiii.get_keyvalues'", 'WIII namespace key/value RPC');
forbidText(namespacePath, 'blockchain.keva.', 'legacy keva RPC prefix');
forbidText(namespacePath, '_KEVA_NS_', 'legacy KEVA root marker');
requireOrder(
  namespacePath,
  'addOutputs(psbt, outputs, namespaceScript, changeAddress);',
  'addAndSignInputs(wallet, psbt, inputs);',
  'namespace outputs before input signatures',
);

requireFile('patches/coinselect+3.1.13.patch');
requireFile('tests/unit/wiiicoin-namespace-fee.test.ts');
requireFile('docs/WIIICOIN_NAMESPACE_FEE_SIZING.md');
requireText('patches/coinselect+3.1.13.patch', 'scriptBytes += 57', 'original 148-byte namespace funding-input estimate');
requireText('patches/coinselect+3.1.13.patch', 'output.script.length + 4', 'complete namespace output estimate');
requireText('tests/unit/wiiicoin-namespace-fee.test.ts', 'expect(result.fee).toBe(502_000);', 'original wallet namespace fee regression');
requireText('docs/WIIICOIN_NAMESPACE_FEE_SIZING.md', '0.00502000 WIII', 'documented original wallet fee result');

requireFile('blue_modules/wiiicoin-namespace-error.ts');
requireFile('tests/unit/wiiicoin-namespace-error.test.ts');
requireText('blue_modules/wiiicoin-namespace-error.ts', 'candidate.data', 'nested daemon rejection detail');
requireText('blue_modules/wiiicoin-namespace-error.ts', "candidate['reject-details']", 'daemon reject-details support');
requireText('blue_modules/wiiicoin-namespace-error.ts', '[0-9a-f]{128,}', 'raw transaction rejection redaction');
requireText('tests/unit/wiiicoin-namespace-error.test.ts', 'bad-txns-inputs-missingorspent', 'Error-instance rejection detail regression');

const namespacePreflightPath = 'blue_modules/wiiicoin-namespace-preflight.ts';
requireFile(namespacePreflightPath);
requireFile('tests/unit/wiiicoin-namespace-preflight.test.ts');
requireText(namespacePreflightPath, "version: ['1.7', '1.7']", 'strict Electrum protocol 1.7 namespace preflight');
requireText(namespacePreflightPath, 'blockchain.transaction.testmempoolaccept', 'namespace mempool acceptance RPC');
requireText(namespacePreflightPath, 'NamespaceMempoolRejectedError', 'readable Core rejection error');
requireText(namespacePreflightPath, 'NamespacePreflightUnavailableError', 'readable preflight protocol error');
requireText(namespacePreflightPath, 'ElectrumX negotiated protocol', 'negotiated protocol diagnostic');
forbidText(namespacePreflightPath, 'Preflight is an optional diagnostic layer', 'silent preflight fallback');
requireText('tests/unit/wiiicoin-namespace-preflight.test.ts', 'mandatory-script-verify-flag-failed', 'mempool reject-reason regression');
requireText('tests/unit/wiiicoin-namespace-preflight.test.ts', 'protocol 1.7 is required', 'protocol diagnostic regression');

for (const path of [
  'screen/settings/NamespaceManager.tsx',
  'screen/settings/NamespaceDetails.tsx',
  'loc/wiiicoinNamespace.ts',
  'docs/WIIICOIN_NAMESPACES.md',
  'tests/unit/wiiicoin-namespace.test.ts',
]) requireFile(path);
requireText('navigation/index.tsx', 'NamespaceManager', 'namespace manager navigation');
requireText('navigation/index.tsx', 'NamespaceDetails', 'namespace details navigation');
requireText('screen/settings/SettingsTools.tsx', 'NamespaceManager', 'Settings → Tools namespace entry');
requireText('screen/settings/NamespaceManager.tsx', 'formatNamespaceError(error)', 'namespace creation RPC error formatting');
requireText('screen/settings/NamespaceDetails.tsx', 'formatNamespaceError(error)', 'namespace mutation RPC error formatting');
requireText('screen/settings/NamespaceManager.tsx', 'preflightNamespaceTransaction(transaction.tx)', 'namespace creation mempool preflight');
requireText('screen/settings/NamespaceDetails.tsx', 'preflightNamespaceTransaction(transaction.tx)', 'namespace mutation mempool preflight');
requireText('docs/WIIICOIN_NAMESPACES.md', 'blockchain.wiii.', 'WIII namespace documentation');
forbidText('docs/WIIICOIN_NAMESPACES.md', 'blockchain.keva.', 'legacy namespace documentation');

requireText('fastlane/Fastfile', '"Wiiiwallet-#{version_name}-#{build_number}', 'Wiiiwallet APK filename');
forbidText('fastlane/Fastfile', '"BlueWallet-#{version_name}-#{build_number}', 'BlueWallet APK filename');
requireText('.github/workflows/build-release-apk.yml', 'EXPECTED_FILENAME="Wiiiwallet-', 'Wiiiwallet release artifact filename');
requireText('.github/workflows/build-release-apk.yml', 'build_release_apk', 'release APK lane');

console.log('Wiiiwallet consolidation audit passed.');
