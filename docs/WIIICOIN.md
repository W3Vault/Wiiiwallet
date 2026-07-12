# Wiiiwallet: Wiiicoin network configuration

Wiiiwallet is the W3Vault mobile wallet derived from BlueWallet and configured for the Wiiicoin blockchain.

## Mainnet parameters

| Setting | Wiiicoin value |
|---|---:|
| Ticker | `WIII` |
| Block interval | 120 seconds |
| P2PKH prefix | `0x87` (135) |
| P2SH prefix | `0x7d` (125) |
| WIF prefix | `0x89` (137) |
| Bech32 HRP | `w3i` |
| BIP32 public | `0x0488b21e` |
| BIP32 private | `0x0488ade4` |
| BIP44 coin type | `9999` (private/temporary allocation) |
| Payment URI | `wiiicoin:` |
| Signed-message prefix | `\x18Wiiicoin Signed Message:\n` |
| Electrum SSL | `wiiicoin.io:50002` |
| Electrum TCP | `wiiicoin.io:50001` |
| P2P port | `8869` |
| RPC port | `8868` |

## Default derivation paths

- Legacy P2PKH: `m/44'/9999'/0'`
- Wrapped SegWit: `m/49'/9999'/0'`
- Native SegWit: `m/84'/9999'/0'`

The BIP32 extended-key versions remain compatible with standard `xpub` and `xprv` encodings, while child private keys are exported with the Wiiicoin WIF prefix.

## Supported in this configuration

- BIP39 mnemonic generation and recovery
- Wiiicoin legacy, wrapped SegWit and native SegWit address derivation
- Wiiicoin WIF private keys
- Wiiicoin PSBT construction and signing
- Electrum balance, history, UTXO and broadcast workflows
- `wiiicoin:` payment links
- Wiiicoin address and Bech32 validation

## Intentionally disabled pending Wiiicoin-specific validation

The upstream application contains Bitcoin services and protocols that must not be presented as Wiiicoin features until separately implemented and tested:

- Lightning and Ark wallets
- PayJoin
- BIP47 payment codes
- Silent Payments
- Bitcoin market-price providers
- Bitcoin fee-estimation APIs
- Bitcoin-specific hardware-wallet assumptions

Production releases should hide or remove those screens and services rather than silently connecting to Bitcoin infrastructure.

## Build verification

Use Node.js 22.11 or later, then run:

```bash
npm install
npm run tslint
npm run unit -- --runInBand
```

Before distributing a build, perform an end-to-end test against the Wiiicoin ElectrumX server:

1. Generate a new mnemonic.
2. Confirm the first receive address uses the expected Wiiicoin prefix (`w3i1` for native SegWit).
3. Fund the address with a small amount.
4. Confirm balance and history are returned by `wiiicoin.io:50002`.
5. Send a small transaction to another Wiiicoin address.
6. Confirm the transaction is accepted by ElectrumX and the Wiiicoin daemon.
7. Restore the mnemonic on a second clean installation and confirm the same addresses and balance.

## Upstream maintenance

Keep Wiiicoin-specific changes in small modules and wallet overrides. When synchronising from `BlueWallet/BlueWallet`, do not overwrite `blue_modules/wiiicoin-network.ts`, the `9999` derivation paths, or the Wiiicoin Electrum defaults.
