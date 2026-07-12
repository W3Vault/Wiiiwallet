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

// BlueElectrum calculates its starting peer index while the module loads. Preserve
// the array length while replacing every Bitcoin fallback with the Wiiicoin server,
// so the pre-calculated index always resolves to a valid Wiiicoin endpoint.
const wiiicoinPeers = hardcodedPeers.map(() => ({ ...WIIICOIN_ELECTRUM_SERVER }));
if (wiiicoinPeers.length === 0) wiiicoinPeers.push({ ...WIIICOIN_ELECTRUM_SERVER });
hardcodedPeers.splice(0, hardcodedPeers.length, ...wiiicoinPeers);
suggestedServers.splice(0, suggestedServers.length, { ...WIIICOIN_ELECTRUM_SERVER });

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

AppRegistry.registerComponent('BlueWallet', () => BlueAppComponent);
