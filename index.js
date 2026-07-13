import './bugsnag';
import './gesture-handler';
import 'react-native-get-random-values';
import './shim.js';
import './blue_modules/wiiicoin-network';

import React, { useEffect } from 'react';
import { AppRegistry, LogBox } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';

import App from './App';
import { restoreSavedPreferredFiatCurrencyAndExchangeFromStorage } from './blue_modules/currency';
import { runArkBackgroundTask } from './blue_modules/arkade-background';
import { hardcodedPeers, suggestedServers } from './blue_modules/BlueElectrum';
import { WIIICOIN_ELECTRUM_SERVER } from './blue_modules/wiiicoin-network';
import DeeplinkSchemaMatch from './class/deeplink-schema-match';
import loc from './loc';

// BlueElectrum calculates its starting peer index while the module loads. Preserve
// the array length while replacing every Bitcoin fallback with the Wiiicoin server,
// so the pre-calculated index always resolves to a valid Wiiicoin endpoint.
const wiiicoinPeers = hardcodedPeers.map(() => ({ ...WIIICOIN_ELECTRUM_SERVER }));
if (wiiicoinPeers.length === 0) wiiicoinPeers.push({ ...WIIICOIN_ELECTRUM_SERVER });
hardcodedPeers.splice(0, hardcodedPeers.length, ...wiiicoinPeers);
suggestedServers.splice(0, suggestedServers.length, { ...WIIICOIN_ELECTRUM_SERVER });

// Keep upstream internal BTC identifiers for compatibility, while ensuring every
// user-facing label identifies the application and coin as Wiiicoin / WIII.
const rewriteWiiicoinTerminology = value => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/BlueWallet/g, 'Wiiicoin')
    .replace(/\bBitcoin\b/g, 'Wiiicoin')
    .replace(/\bBTC\b/g, 'WIII')
    .replace(/Satoshi per vByte/g, 'Base units per vByte')
    .replace(/satoshi per vByte/g, 'base units per vByte')
    .replace(/sat\/vByte/g, 'units/vByte');
};

const applyWiiicoinTerminology = () => {
  const visited = new WeakSet();
  const rewriteObject = object => {
    if (!object || typeof object !== 'object' || visited.has(object)) return;
    visited.add(object);
    for (const key of Object.keys(object)) {
      const value = object[key];
      if (typeof value === 'string') {
        try {
          object[key] = rewriteWiiicoinTerminology(value);
        } catch (_) {}
      } else if (value && typeof value === 'object') {
        rewriteObject(value);
      }
    }
  };

  rewriteObject(loc);
  if (loc.units) {
    loc.units.BTC = 'WIII';
    loc.units.sat_vbyte = 'units/vByte';
  }
};

const originalSetContent = loc.setContent.bind(loc);
loc.setContent = (...args) => {
  const result = originalSetContent(...args);
  applyWiiicoinTerminology();
  return result;
};

const originalSetLanguage = loc.setLanguage.bind(loc);
loc.setLanguage = (...args) => {
  const result = originalSetLanguage(...args);
  applyWiiicoinTerminology();
  return result;
};

applyWiiicoinTerminology();

// The upstream URI parser is intentionally retained to minimise divergence. Feed
// it a BIP21-compatible internal form, then expose Wiiicoin URIs at the app edge.
const normalizeWiiicoinUri = value => (typeof value === 'string' ? value.replace(/^wiiicoin:(\/\/)?/i, 'bitcoin:') : value);
const originalHasSchema = DeeplinkSchemaMatch.hasSchema.bind(DeeplinkSchemaMatch);
const originalIsBitcoinAddress = DeeplinkSchemaMatch.isBitcoinAddress.bind(DeeplinkSchemaMatch);
const originalBip21Decode = DeeplinkSchemaMatch.bip21decode.bind(DeeplinkSchemaMatch);
const originalBip21Encode = DeeplinkSchemaMatch.bip21encode.bind(DeeplinkSchemaMatch);
const originalNavigationRouteFor = DeeplinkSchemaMatch.navigationRouteFor.bind(DeeplinkSchemaMatch);

DeeplinkSchemaMatch.hasSchema = value =>
  (typeof value === 'string' && value.trim().toLowerCase().startsWith('wiiicoin:')) || originalHasSchema(value);
DeeplinkSchemaMatch.isBitcoinAddress = value => originalIsBitcoinAddress(normalizeWiiicoinUri(value));
DeeplinkSchemaMatch.bip21decode = value => originalBip21Decode(normalizeWiiicoinUri(value));
DeeplinkSchemaMatch.bip21encode = (address, options) => originalBip21Encode(address, options).replace(/^bitcoin:/i, 'wiiicoin:');
DeeplinkSchemaMatch.navigationRouteFor = (event, completionHandler, context) =>
  originalNavigationRouteFor({ ...event, url: normalizeWiiicoinUri(event.url) }, completionHandler, context);

// Android headless execution boots a bare JS runtime without the React tree.
// The headless task callback must be registered at module scope before
// AppRegistry.registerComponent so the symbol exists when the OS dispatches a
// terminated-process wake.
BackgroundFetch.registerHeadlessTask(async event => {
  if (event.timeout) {
    BackgroundFetch.finish(event.taskId);
    return;
  }
  await runArkBackgroundTask(event.taskId);
});

if (!Error.captureStackTrace) {
  Error.captureStackTrace = () => {};
}

LogBox.ignoreLogs([
  'Require cycle:',
  'Battery state `unknown` and monitoring disabled, this is normal for simulators and tvOS.',
  'Open debugger to view warnings.',
  'Non-serializable values were found in the navigation state',
]);

const BlueAppComponent = () => {
  useEffect(() => {
    restoreSavedPreferredFiatCurrencyAndExchangeFromStorage().catch(error => {
      console.error('Failed to restore preferred currency and exchange rates on startup:', error);
    });
  }, []);

  return <App />;
};

// The native component name remains unchanged for React Native compatibility.
AppRegistry.registerComponent('BlueWallet', () => BlueAppComponent);
