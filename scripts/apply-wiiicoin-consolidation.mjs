import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const replaceRequired = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Unable to apply ${label}`);
  return source.replace(before, after);
};

// Wiiiwallet exposes a single Wiiicoin BIP49 P2SH-P2WPKH wallet type.
const walletTypePath = 'screen/wallets/Add.tsx';
let walletTypeSource = read(walletTypePath);
const legacyMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [walletAction, entropyActions] : [walletAction];";
const hiddenMenu = "return selectedWalletType === ButtonSelected.ONCHAIN ? [entropyActions] : [];";
const singleTypeMarkers = ['new HDSegwitP2SHWallet()', 'BIP49 P2SH-P2WPKH', 'addresses begin with 2'];

if (walletTypeSource.includes(legacyMenu)) {
  walletTypeSource = walletTypeSource.replace(legacyMenu, hiddenMenu);
  write(walletTypePath, walletTypeSource);
}

if (!singleTypeMarkers.every(marker => walletTypeSource.includes(marker)) && !walletTypeSource.includes(hiddenMenu)) {
  throw new Error('Add Wallet does not enforce Wiiicoin BIP49 P2SH as its only on-chain wallet type');
}

// Preserve the upstream BTC value internally. Many formatting and persistence
// paths depend on this exact identifier; only user-facing labels become Wiii.
const bitcoinUnitsPath = 'models/bitcoinUnits.ts';
let bitcoinUnits = read(bitcoinUnitsPath);
bitcoinUnits = bitcoinUnits.replace("  BTC: 'WIII',", "  BTC: 'BTC',");
write(bitcoinUnitsPath, bitcoinUnits);
if (!read(bitcoinUnitsPath).includes("BTC: 'BTC'")) throw new Error('Internal BitcoinUnit.BTC compatibility value was not restored');

// Display Wiii inside an opened wallet and use GBP as the fiat unit.
const walletHeaderPath = 'components/TransactionsNavigationHeader.tsx';
let walletHeader = read(walletHeaderPath);
const inheritedUnitDisplay =
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.USD) : unit}";
const inheritedPatchedUnitDisplay =
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.USD) : unit === BitcoinUnit.BTC ? 'Wiii' : unit}";
const wiiicoinUnitDisplay =
  "{unit === BitcoinUnit.LOCAL_CURRENCY ? (preferredFiatCurrency?.endPointKey ?? FiatUnit.GBP) : unit === BitcoinUnit.BTC ? 'Wiii' : unit}";
walletHeader = walletHeader.replace(inheritedUnitDisplay, wiiicoinUnitDisplay).replace(inheritedPatchedUnitDisplay, wiiicoinUnitDisplay);
write(walletHeaderPath, walletHeader);
if (!read(walletHeaderPath).includes(wiiicoinUnitDisplay)) throw new Error('Opened-wallet unit was not changed from BTC to Wiii');

// Replace the Bitcoin B watermark on Wiiicoin wallet cards with an explicitly
// white Wiiicoin watermark. Purple wallet gradients are defined in wallet-gradient.ts.
const carouselPath = 'components/WalletsCarousel.tsx';
let carousel = read(carouselPath);
if (!carousel.includes("import WiiicoinLogo from './WiiicoinLogo';")) {
  carousel = replaceRequired(
    carousel,
    "import { BlueSpacing10 } from './BlueSpacing';",
    "import { BlueSpacing10 } from './BlueSpacing';\nimport WiiicoinLogo from './WiiicoinLogo';",
    'Wiiicoin wallet-card logo import',
  );
}
carousel = carousel.replace(
  "      default:\n        image = direction === 'rtl' ? require('../img/btc-shape-rtl.png') : require('../img/btc-shape.png');",
  "      default:\n        image = undefined;",
);
if (!carousel.includes('testID="wiiicoin-wallet-watermark"')) {
  carousel = replaceRequired(
    carousel,
    "              <ImageBackground source={image} style={[iStyles.image, isCompact && iStyles.imageCompact]} />",
    `              {image ? (\n                <ImageBackground source={image} style={[iStyles.image, isCompact && iStyles.imageCompact]} />\n              ) : (\n                <WiiicoinLogo\n                  testID="wiiicoin-wallet-watermark"\n                  width={isCompact ? 78 : 99}\n                  height={isCompact ? 74 : 94}\n                  style={[iStyles.image, isCompact && iStyles.imageCompact]}\n                  color="#FFFFFF"\n                  opacity={0.28}\n                />\n              )}`,
    'white Wiiicoin wallet watermark',
  );
}
write(carouselPath, carousel);
const verifiedCarousel = read(carouselPath);
if (!verifiedCarousel.includes('testID="wiiicoin-wallet-watermark"') || !verifiedCarousel.includes('color="#FFFFFF"')) {
  throw new Error('Wallet card does not contain the white Wiiicoin watermark');
}

// Replace the inherited BlueWallet unlock/loading artwork with a Wiiicoin logo
// that rotates for as long as wallet storage is opening or decrypting.
const unlockPath = 'screen/UnlockWith.tsx';
let unlock = read(unlockPath);
if (!unlock.includes("import WiiicoinLogo from '../components/WiiicoinLogo';")) {
  unlock = unlock.replace('  Image,\n', '');
  unlock = replaceRequired(
    unlock,
    "import { PasswordInput, PasswordInputHandle } from '../components/PasswordInput';",
    "import { PasswordInput, PasswordInputHandle } from '../components/PasswordInput';\nimport WiiicoinLogo from '../components/WiiicoinLogo';",
    'Wiiicoin unlock logo import',
  );
}
if (!unlock.includes('const logoRotation = useRef(new Animated.Value(0)).current;')) {
  unlock = replaceRequired(
    unlock,
    '  const keyboardOffset = useRef(new Animated.Value(0)).current;',
    '  const keyboardOffset = useRef(new Animated.Value(0)).current;\n  const logoRotation = useRef(new Animated.Value(0)).current;',
    'unlock logo rotation value',
  );
}
if (!unlock.includes('const logoAnimation = Animated.loop(')) {
  unlock = replaceRequired(
    unlock,
    `  useEffect(() => {\n    setWalletsInitialized(false);\n  }, [setWalletsInitialized]);`,
    `  useEffect(() => {\n    setWalletsInitialized(false);\n  }, [setWalletsInitialized]);\n\n  useEffect(() => {\n    if (!state.isAuthenticating) {\n      logoRotation.stopAnimation();\n      logoRotation.setValue(0);\n      return;\n    }\n\n    logoRotation.setValue(0);\n    const logoAnimation = Animated.loop(\n      Animated.timing(logoRotation, {\n        toValue: 1,\n        duration: 1200,\n        easing: Easing.linear,\n        useNativeDriver: true,\n      }),\n    );\n    logoAnimation.start();\n    return () => logoAnimation.stop();\n  }, [state.isAuthenticating, logoRotation]);`,
    'rotating Wiiicoin unlock animation',
  );
}
if (unlock.includes("require('../img/icon.png')")) {
  unlock = replaceRequired(
    unlock,
    `              <Image source={require('../img/icon.png')} style={styles.logoImage} resizeMode="contain" />`,
    `              <Animated.View\n                testID="rotating-wiiicoin-logo"\n                style={[\n                  styles.logoImage,\n                  {\n                    transform: [\n                      {\n                        rotate: logoRotation.interpolate({\n                          inputRange: [0, 1],\n                          outputRange: ['0deg', '360deg'],\n                        }),\n                      },\n                    ],\n                  },\n                ]}\n              >\n                <WiiicoinLogo width={100} height={75} color="#A654A0" />\n              </Animated.View>`,
    'Wiiicoin unlock artwork',
  );
}
write(unlockPath, unlock);
const verifiedUnlock = read(unlockPath);
if (verifiedUnlock.includes("require('../img/icon.png')") || !verifiedUnlock.includes('testID="rotating-wiiicoin-logo"')) {
  throw new Error('BlueWallet unlock artwork is still present');
}

// Replace the centre image in receive QR codes with the round Wiiicoin app icon.
// Split the QR module path into one path per row and key the SVG by its complete
// render inputs. This avoids the Android first-mount path truncation that caused
// the QR code to appear incomplete until the screen was opened a second time.
const qrCodePath = 'components/QRCode.tsx';
let qrCode = read(qrCodePath);
qrCode = qrCode.replace(
  "import Svg, { Defs, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';",
  "import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';",
);
qrCode = qrCode.replace('  dataPath: string;', '  dataPaths: string[];');

const oldPathBuilder = [
  "  let dataPath = '';",
  '  for (let r = 0; r < N; r++) {',
  '    for (let c = 0; c < N; c++) {',
  '      if (!matrix[r][c]) continue;',
  '      if (isLogoRendered && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd) continue;',
  '      if (isInsideFinder(r, c)) continue;',
  '      dataPath += `M${c * cell} ${r * cell}h${cell}v${cell}h-${cell}z`;',
  '    }',
  '  }',
  '',
  '  const plan: RenderPlan = { N, cell, dataPath, finderOrigins, logoCells, logoStart };',
].join('\n');
const newPathBuilder = [
  '  const dataPaths: string[] = [];',
  '  for (let r = 0; r < N; r++) {',
  "    let rowPath = '';",
  '    for (let c = 0; c < N; c++) {',
  '      if (!matrix[r][c]) continue;',
  '      if (isLogoRendered && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd) continue;',
  '      if (isInsideFinder(r, c)) continue;',
  '      rowPath += `M${c * cell} ${r * cell}h${cell}v${cell}h-${cell}z`;',
  '    }',
  '    if (rowPath) dataPaths.push(rowPath);',
  '  }',
  '',
  '  const plan: RenderPlan = { N, cell, dataPaths, finderOrigins, logoCells, logoStart };',
].join('\n');
if (qrCode.includes(oldPathBuilder)) qrCode = qrCode.replace(oldPathBuilder, newPathBuilder);
qrCode = qrCode.replace(
  '    const { cell, dataPath, finderOrigins, logoCells, logoStart } = plan;',
  '    const { cell, dataPaths, finderOrigins, logoCells, logoStart } = plan;',
);
qrCode = qrCode.replace(
  '        {dataPath ? <Path testID="qr-cells-path" d={dataPath} fill={gradFill} /> : null}',
  '        {dataPaths.map((rowPath, rowIndex) => (\n          <Path key={`qr-row-${rowIndex}`} testID="qr-cells-path" d={rowPath} fill={gradFill} />\n        ))}',
);
qrCode = qrCode.replace(
  '      <Svg ref={svgRef} testID="BitcoinAddressQRCode" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>',
  '      <Svg\n        key={`${ecl}|${size}|${logoSize}|${isLogoRendered ? 1 : 0}|${value}`}\n        ref={svgRef}\n        testID="BitcoinAddressQRCode"\n        width={size}\n        height={size}\n        viewBox={`0 0 ${size} ${size}`}\n      >',
);

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
  '              <Path fill="#FFFFFF" d="M93.1 192.9H58.9C51.7 192.9 45.8 187 45.8 179.8V57.4C45.8 50.2 51.7 44.3 58.9 44.3H64.3C71.5 44.3 77.4 50.2 77.4 57.4V178.8C78.2 186.8 85 193 93.1 193Z" />',
  '              <Path fill="#FFFFFF" d="M191.5 60.1V177.1C191.5 185.8 184.4 192.9 175.7 192.9H144.3C152.6 192.9 159.2 186.5 159.9 178.4V60.1C159.9 55.7 161.7 51.8 164.5 48.9C167.4 46 171.3 44.3 175.7 44.3C184.4 44.3 191.5 51.4 191.5 60.1Z" />',
  '              <Path fill="#FFFFFF" d="M118.6 44.3C127.3 44.3 134.4 51.4 134.4 60.1V177.1C134.4 185.8 127.3 192.9 118.6 192.9C109.9 192.9 102.8 185.8 102.8 177.1V60.1C102.8 51.4 109.9 44.3 118.6 44.3Z" />',
  '            </G>',
].join('\n');
if (qrCode.includes(inheritedQrLogo)) qrCode = qrCode.replace(inheritedQrLogo, wiiicoinQrLogo);
qrCode = qrCode.replace(
  '  }, [plan, size, isLogoRendered, logoSize]);',
  '  }, [plan, size, isLogoRendered, logoSize, value, ecl]);',
);
write(qrCodePath, qrCode);
const verifiedQrCode = read(qrCodePath);
if (
  verifiedQrCode.includes("require('../img/qr-code.png')") ||
  !verifiedQrCode.includes('testID="qr-wiiicoin-logo"') ||
  !verifiedQrCode.includes('dataPaths.map') ||
  !verifiedQrCode.includes('key={`${ecl}|${size}|${logoSize}|${isLogoRendered ? 1 : 0}|${value}`}')
) {
  throw new Error('Wiiicoin QR icon or first-render matrix fix was not applied');
}

// Generate the round purple Android app icon with a white Wiiicoin mark.
const appIconPath = 'android/app/src/main/res/drawable/wiiicoin_app_icon.xml';
write(
  appIconPath,
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="237.2"
    android:viewportHeight="237.2">
    <path android:fillColor="#A654A0" android:pathData="M118.6,6.6A112,112 0,1 1,118.6,230.6A112,112 0,1 1,118.6,6.6Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M93.1,192.9H58.9C51.7,192.9 45.8,187 45.8,179.8V57.4C45.8,50.2 51.7,44.3 58.9,44.3H64.3C71.5,44.3 77.4,50.2 77.4,57.4V178.8C78.2,186.8 85,193 93.1,193Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M191.5,60.1V177.1C191.5,185.8 184.4,192.9 175.7,192.9H144.3C152.6,192.9 159.2,186.5 159.9,178.4V60.1C159.9,55.7 161.7,51.8 164.5,48.9C167.4,46 171.3,44.3 175.7,44.3C184.4,44.3 191.5,51.4 191.5,60.1Z" />
    <path android:fillColor="#FFFFFF" android:pathData="M118.6,44.3C127.3,44.3 134.4,51.4 134.4,60.1V177.1C134.4,185.8 127.3,192.9 118.6,192.9C109.9,192.9 102.8,185.8 102.8,177.1V60.1C102.8,51.4 109.9,44.3 118.6,44.3Z" />
</vector>
`,
);

// Ensure both Android splash implementations use the supplied Wiii mark.
write(
  'android/app/src/main/res/drawable/wiiiwallet_splash.xml',
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/wiiicoin_splash_background" />
    <item android:drawable="@drawable/wiiicoin_logo" android:gravity="center" />
</layer-list>
`,
);
const manifest = read('android/app/src/main/AndroidManifest.xml');
if (!manifest.includes('android:icon="@drawable/wiiicoin_app_icon"') || !manifest.includes('android:roundIcon="@drawable/wiiicoin_app_icon"')) {
  throw new Error('Android manifest does not use the Wiiicoin app icon');
}
const android12Styles = read('android/app/src/main/res/values-v31/styles.xml');
if (!android12Styles.includes('@drawable/wiiicoin_logo')) throw new Error('Android 12 splash does not use the Wiii logo');

// Fix Wiiicoin fiat valuation at one WIII = £10 GBP.
const currencyPath = 'blue_modules/currency.ts';
let currency = read(currencyPath);
currency = currency.replace('let preferredFiatCurrency: FiatUnitType = FiatUnit.USD;', 'let preferredFiatCurrency: FiatUnitType = FiatUnit.GBP;');
currency = currency.replace(
  'let exchangeRates: ExchangeRates = { LAST_UPDATED_ERROR: false };',
  "const WIIICOIN_GBP_RATE = 10;\nlet exchangeRates: ExchangeRates = { LAST_UPDATED_ERROR: false, BTC_GBP: WIIICOIN_GBP_RATE, LAST_UPDATED: Date.now() };",
);
currency = currency.replace(
  'async function setPreferredCurrency(item: FiatUnitType): Promise<void> {\n  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);',
  'async function setPreferredCurrency(item: FiatUnitType): Promise<void> {\n  item = FiatUnit.GBP;\n  await DefaultPreference.setName(GROUP_IO_BLUEWALLET);',
);
currency = currency.replace(
  '    const rate = await getFiatRate(preferredFiatCurrency.endPointKey);',
  '    preferredFiatCurrency = FiatUnit.GBP;\n    const rate = WIIICOIN_GBP_RATE;',
);
currency = currency.replace(
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
currency = currency.replace(
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
write(currencyPath, currency);
const verifiedCurrency = read(currencyPath);
if (!verifiedCurrency.includes('const WIIICOIN_GBP_RATE = 10;') || !verifiedCurrency.includes('const rate = WIIICOIN_GBP_RATE;')) {
  throw new Error('Wiiicoin GBP valuation was not applied');
}

// Apply visible Wiiiwallet naming on iOS while preserving internal bundle IDs.
const iosInfoPath = 'ios/BlueWallet/Info.plist';
let iosInfo = read(iosInfoPath);
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
write(iosInfoPath, iosInfo);

console.log('Wiiicoin branding consolidation complete:');
console.log('- white Wiiicoin wallet watermark');
console.log('- round Wiiicoin receive QR icon');
console.log('- complete first-render QR matrix');
console.log('- rotating Wiiicoin unlock/loading logo');
console.log('- Wiii opened-wallet balance label');
console.log('- Wiii Android splash and round Wiiicoin app icon');
console.log('- fixed GBP valuation at 1 WIII = £10');
