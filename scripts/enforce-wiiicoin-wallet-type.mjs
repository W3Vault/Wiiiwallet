import fs from 'node:fs';

const walletTypePath = 'screen/wallets/Add.tsx';
let walletTypeSource = fs.readFileSync(walletTypePath, 'utf8');

const legacyMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [walletAction, entropyActions] : [walletAction];";
const hiddenMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [entropyActions] : [];";
const singleTypeMarkers = [
  'new HDSegwitP2SHWallet()',
  'BIP49 P2SH-P2WPKH',
  'addresses begin with 2',
];

if (walletTypeSource.includes(legacyMenu)) {
  walletTypeSource = walletTypeSource.replace(legacyMenu, hiddenMenu);
  fs.writeFileSync(walletTypePath, walletTypeSource);
}

const singleTypeScreen = singleTypeMarkers.every(marker => walletTypeSource.includes(marker));
const legacyMenuHidden = walletTypeSource.includes(hiddenMenu);

if (!singleTypeScreen && !legacyMenuHidden) {
  throw new Error('Add Wallet does not enforce Wiiicoin BIP49 P2SH as its only on-chain wallet type');
}

// Keep the internal BitcoinUnit.BTC identifier for upstream compatibility, but
// display Wiiicoin's user-facing unit name inside an opened wallet.
const walletHeaderPath = 'components/TransactionsNavigationHeader.tsx';
let walletHeaderSource = fs.readFileSync(walletHeaderPath, 'utf8');
const inheritedUnitDisplay =
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.USD) : unit}";
const wiiicoinUnitDisplay =
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.GBP) : unit === BitcoinUnit.BTC ? 'Wiii' : unit}";

if (walletHeaderSource.includes(inheritedUnitDisplay)) {
  walletHeaderSource = walletHeaderSource.replace(inheritedUnitDisplay, wiiicoinUnitDisplay);
}
walletHeaderSource = walletHeaderSource.replace(
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.USD) : unit === BitcoinUnit.BTC ? 'Wiii' : unit}",
  wiiicoinUnitDisplay,
);
fs.writeFileSync(walletHeaderPath, walletHeaderSource);

if (!fs.readFileSync(walletHeaderPath, 'utf8').includes(wiiicoinUnitDisplay)) {
  throw new Error('Opened-wallet balance unit was not changed from BTC to Wiii with GBP as the fiat default');
}

// Replace the inherited BlueWallet image embedded in receive QR codes with the
// same round purple Wiiicoin badge used by the Android launcher.
const qrCodePath = 'components/QRCode.tsx';
let qrCodeSource = fs.readFileSync(qrCodePath, 'utf8');
const inheritedQrImport =
  "import Svg, { Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';";
const wiiicoinQrImport = "import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';";

if (qrCodeSource.includes(inheritedQrImport)) {
  qrCodeSource = qrCodeSource.replace(inheritedQrImport, wiiicoinQrImport);
}

const inheritedQrLogo = [
  '            <SvgImage',
  '              testID="qr-logo-image"',
  "              href={require('../img/qr-code.png')}",
  '              x={logoCenter - logoSize / 2}',
  '              y={logoCenter - logoSize / 2}',
  '              width={logoSize}',
  '              height={logoSize}',
  '              preserveAspectRatio="xMidYMid meet"',
  '            />',
].join('\n');

const wiiicoinQrLogo = [
  '            <G',
  '              testID="qr-wiiicoin-logo"',
  '              transform={`translate(${logoCenter - logoSize / 2} ${logoCenter - logoSize / 2}) scale(${logoSize / 237.2})`}',
  '            >',
  '              <Rect x={6.6} y={6.6} width={224} height={224} rx={112} fill="#A654A0" />',
  '              <Path',
  '                fill="#FFFFFF"',
  '                d="M93.1 192.9H58.9C51.7 192.9 45.8 187 45.8 179.8V57.4C45.8 50.2 51.7 44.3 58.9 44.3H64.3C71.5 44.3 77.4 50.2 77.4 57.4V178.8C78.2 186.8 85 193 93.1 193Z"',
  '              />',
  '              <Path',
  '                fill="#FFFFFF"',
  '                d="M191.5 60.1V177.1C191.5 185.8 184.4 192.9 175.7 192.9H144.3C152.6 192.9 159.2 186.5 159.9 178.4V60.1C159.9 55.7 161.7 51.8 164.5 48.9C167.4 46 171.3 44.3 175.7 44.3C184.4 44.3 191.5 51.4 191.5 60.1Z"',
  '              />',
  '              <Path',
  '                fill="#FFFFFF"',
  '                d="M118.6 44.3C127.3 44.3 134.4 51.4 134.4 60.1V177.1C134.4 185.8 127.3 192.9 118.6 192.9C109.9 192.9 102.8 185.8 102.8 177.1V60.1C102.8 51.4 109.9 44.3 118.6 44.3Z"',
  '              />',
  '            </G>',
].join('\n');

if (qrCodeSource.includes(inheritedQrLogo)) {
  qrCodeSource = qrCodeSource.replace(inheritedQrLogo, wiiicoinQrLogo);
}
fs.writeFileSync(qrCodePath, qrCodeSource);

const verifiedQrCode = fs.readFileSync(qrCodePath, 'utf8');
if (!verifiedQrCode.includes('testID="qr-wiiicoin-logo"') || verifiedQrCode.includes("require('../img/qr-code.png')")) {
  throw new Error('Receive QR code still contains the inherited BlueWallet centre icon');
}

// Use a transparent-corner vector so Android launchers display a round purple
// badge with the supplied Wiiicoin mark rendered in white inside the circle.
const appIconPath = 'android/app/src/main/res/drawable/wiiicoin_app_icon.xml';
const roundAppIcon = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="237.2"
    android:viewportHeight="237.2">

    <path
        android:fillColor="#A654A0"
        android:pathData="M118.6,6.6A112,112 0,1 1,118.6,230.6A112,112 0,1 1,118.6,6.6Z" />

    <path
        android:fillColor="#FFFFFF"
        android:pathData="M93.1,192.9H58.9C51.7,192.9 45.8,187 45.8,179.8V57.4C45.8,50.2 51.7,44.3 58.9,44.3H64.3C71.5,44.3 77.4,50.2 77.4,57.4V178.8C78.2,186.8 85,193 93.1,193Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M191.5,60.1V177.1C191.5,185.8 184.4,192.9 175.7,192.9H144.3C152.6,192.9 159.2,186.5 159.9,178.4V60.1C159.9,55.7 161.7,51.8 164.5,48.9C167.4,46 171.3,44.3 175.7,44.3C184.4,44.3 191.5,51.4 191.5,60.1Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M118.6,44.3C127.3,44.3 134.4,51.4 134.4,60.1V177.1C134.4,185.8 127.3,192.9 118.6,192.9C109.9,192.9 102.8,185.8 102.8,177.1V60.1C102.8,51.4 109.9,44.3 118.6,44.3Z" />
</vector>
`;
fs.writeFileSync(appIconPath, roundAppIcon);

const verifiedIcon = fs.readFileSync(appIconPath, 'utf8');
if (!verifiedIcon.includes('M118.6,6.6A112,112') || !verifiedIcon.includes('android:fillColor="#FFFFFF"')) {
  throw new Error('Round Wiiicoin launcher icon was not generated correctly');
}

// Use GBP as Wiiiwallet's fiat denomination and a fixed launch valuation of
// one WIII = £10. Internal BTC naming remains because upstream formatting APIs
// represent a whole coin as 100,000,000 base units.
const currencyPath = 'blue_modules/currency.ts';
let currencySource = fs.readFileSync(currencyPath, 'utf8');
currencySource = currencySource.replace(
  'let preferredFiatCurrency: FiatUnitType = FiatUnit.USD;',
  'let preferredFiatCurrency: FiatUnitType = FiatUnit.GBP;',
);
currencySource = currencySource.replace(
  'let exchangeRates: ExchangeRates = { LAST_UPDATED_ERROR: false };',
  "const WIIICOIN_GBP_RATE = 10;\nlet exchangeRates: ExchangeRates = { LAST_UPDATED_ERROR: false, BTC_GBP: WIIICOIN_GBP_RATE, LAST_UPDATED: Date.now() };",
);
currencySource = currencySource.replace(
  'async function setPreferredCurrency(item: FiatUnitType): Promise<void> {\n  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);',
  'async function setPreferredCurrency(item: FiatUnitType): Promise<void> {\n  item = FiatUnit.GBP;\n  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);',
);
currencySource = currencySource.replace(
  '    const rate = await getFiatRate(preferredFiatCurrency.endPointKey);',
  '    preferredFiatCurrency = FiatUnit.GBP;\n    const rate = WIIICOIN_GBP_RATE;',
);
currencySource = currencySource.replace(
  /async function getPreferredCurrency\(\): Promise<FiatUnitType> \{[\s\S]*?\n\}\n\nasync function _restoreSavedExchangeRatesFromStorage/,
  `async function getPreferredCurrency(): Promise<FiatUnitType> {
  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);
  preferredFiatCurrency = FiatUnit.GBP;
  await DefaultPreference.set(PREFERRED_CURRENCY_STORAGE_KEY, FiatUnit.GBP.endPointKey);
  await DefaultPreference.set(PREFERRED_CURRENCY_LOCALE_STORAGE_KEY, FiatUnit.GBP.locale.replace('-', '_'));
  return preferredFiatCurrency;
}

async function _restoreSavedExchangeRatesFromStorage`,
);
currencySource = currencySource.replace(
  /async function _restoreSavedPreferredFiatCurrencyFromStorage\(\): Promise<void> \{[\s\S]*?\n\}\n\nasync function isRateOutdated/,
  `async function _restoreSavedPreferredFiatCurrencyFromStorage(): Promise<void> {
  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);
  preferredFiatCurrency = FiatUnit.GBP;
  currencyFormatter = null;
  await DefaultPreference.set(PREFERRED_CURRENCY_STORAGE_KEY, FiatUnit.GBP.endPointKey);
  await DefaultPreference.set(PREFERRED_CURRENCY_LOCALE_STORAGE_KEY, FiatUnit.GBP.locale.replace('-', '_'));
  exchangeRates[BTC_PREFIX + FiatUnit.GBP.endPointKey] = WIIICOIN_GBP_RATE;
  exchangeRates[LAST_UPDATED] = Date.now();
  exchangeRates.LAST_UPDATED_ERROR = false;
}

async function isRateOutdated`,
);
fs.writeFileSync(currencyPath, currencySource);

const verifiedCurrency = fs.readFileSync(currencyPath, 'utf8');
if (
  !verifiedCurrency.includes('let preferredFiatCurrency: FiatUnitType = FiatUnit.GBP;') ||
  !verifiedCurrency.includes('const WIIICOIN_GBP_RATE = 10;') ||
  !verifiedCurrency.includes('const rate = WIIICOIN_GBP_RATE;')
) {
  throw new Error('Wiiicoin GBP valuation was not applied');
}

// Apply visible iOS Wiiiwallet branding while preserving inherited internal
// bundle identifiers and document identifiers for build compatibility.
const iosInfoPath = 'ios/BlueWallet/Info.plist';
let iosInfo = fs.readFileSync(iosInfoPath, 'utf8');
iosInfo = iosInfo
  .replace('<string>BlueWallet</string>', '<string>Wiiiwallet</string>')
  .replaceAll('<string>BW COSIGNER</string>', '<string>Wiiiwallet Cosigner</string>')
  .replace('Quickly view the current Bitcoin market rate.', 'Quickly view the current Wiiicoin value.')
  .replace('<string>Bitcoin Price</string>', '<string>Wiiicoin Value</string>')
  .replace('<string>Partially Signed Bitcoin Transaction</string>', '<string>Partially Signed Wiiicoin Transaction</string>')
  .replace('<string>Bitcoin Transaction</string>', '<string>Wiiicoin Transaction</string>');

if (!iosInfo.includes('<string>wiiicoin</string>')) {
  iosInfo = iosInfo.replace(
    '<array>\n\t\t\t\t<string>bitcoin</string>',
    '<array>\n\t\t\t\t<string>wiiicoin</string>\n\t\t\t\t<string>wiiiwallet</string>\n\t\t\t\t<string>bitcoin</string>',
  );
}
fs.writeFileSync(iosInfoPath, iosInfo);

const verifiedIosInfo = fs.readFileSync(iosInfoPath, 'utf8');
if (
  !verifiedIosInfo.includes('<string>Wiiiwallet</string>') ||
  !verifiedIosInfo.includes('<string>wiiicoin</string>') ||
  !verifiedIosInfo.includes('<string>Wiiicoin Value</string>')
) {
  throw new Error('Visible Wiiiwallet iOS branding was not applied');
}

console.log('Wiiicoin BIP49 P2SH is the only on-chain wallet type exposed by Add Wallet.');
console.log('Opened-wallet balance unit displays Wiii.');
console.log('Receive QR codes use the round Wiiicoin app icon.');
console.log('Android launcher icon uses a round purple Wiiicoin badge with a white mark.');
console.log('Wiiicoin fiat valuation is fixed at 1 WIII = £10 GBP.');
console.log('Visible iOS branding is Wiiiwallet / Wiiicoin.');
