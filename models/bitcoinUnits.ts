export const BitcoinUnit = {
  // Keep the upstream BTC key for source compatibility, but expose Wiiicoin's
  // ticker everywhere the wallet renders or persists the primary coin unit.
  BTC: 'BTC',
  SATS: 'sats',
  LOCAL_CURRENCY: 'local_currency',
  MAX: 'MAX',
} as const;
export type BitcoinUnit = (typeof BitcoinUnit)[keyof typeof BitcoinUnit];

export const Chain = {
  ONCHAIN: 'ONCHAIN',
  OFFCHAIN: 'OFFCHAIN',
} as const;
export type Chain = (typeof Chain)[keyof typeof Chain];
