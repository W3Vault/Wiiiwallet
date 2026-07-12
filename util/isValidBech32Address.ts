import * as bitcoin from 'bitcoinjs-lib';

import { WIIICOIN_BECH32_HRP } from '../blue_modules/wiiicoin-network';

export function isValidBech32Address(address: string): boolean {
  try {
    const decoded = bitcoin.address.fromBech32(address);
    return decoded.prefix === WIIICOIN_BECH32_HRP;
  } catch (_) {
    return false;
  }
}
