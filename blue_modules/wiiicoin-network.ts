import * as bitcoin from 'bitcoinjs-lib';

export const WIIICOIN_NAME = 'Wiiicoin';
export const WIIICOIN_TICKER = 'WIII';
export const WIIICOIN_COIN_TYPE = 9999;
export const WIIICOIN_URI_SCHEME = 'wiiicoin';
export const WIIICOIN_BECH32_HRP = 'w3i';
export const WIIICOIN_MESSAGE_PREFIX = '\x18Wiiicoin Signed Message:\n';

export const WIIICOIN_NETWORK: bitcoin.Network = {
  messagePrefix: WIIICOIN_MESSAGE_PREFIX,
  bech32: WIIICOIN_BECH32_HRP,
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x87,
  // Wiiicoin Core generates P2SH-wrapped SegWit addresses such as 2a1Q....
  // Base58Check decoding confirms these use version byte 0x03.
  scriptHash: 0x03,
  wif: 0x89,
};

export const WIIICOIN_DERIVATION_PATHS = {
  legacy: "m/44'/9999'/0'",
  wrappedSegwit: "m/49'/9999'/0'",
  nativeSegwit: "m/84'/9999'/0'",
} as const;

// Default Wiiiwallet ElectrumX endpoint. Connections use TLS/SSL on the
// standard Electrum secure port so wallet traffic is encrypted in transit.
export const WIIICOIN_ELECTRUM_SERVER = {
  host: 'etx1.wiiicoin.io',
  ssl: 50002,
} as const;

/**
 * BlueWallet assumes bitcoin.networks.bitcoin whenever a network is omitted.
 * Wiiiwallet is a dedicated Wiiicoin application, so replace that shared default
 * before wallet, PSBT, address and script modules are evaluated.
 */
export function configureBitcoinJsForWiiicoin(): bitcoin.Network {
  Object.assign(bitcoin.networks.bitcoin, WIIICOIN_NETWORK);
  return bitcoin.networks.bitcoin;
}

configureBitcoinJsForWiiicoin();
