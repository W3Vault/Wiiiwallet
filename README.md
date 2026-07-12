# Wiiiwallet

Wiiiwallet is the W3Vault mobile wallet for the Wiiicoin blockchain. It is derived from the open-source BlueWallet React Native codebase and uses ElectrumX for lightweight blockchain access.

## Current network configuration

- Wiiicoin mainnet address and private-key prefixes
- Bech32 addresses beginning `w3i1`
- BIP39 mnemonic wallets
- BIP44, BIP49 and BIP84 derivation with private coin type `9999`
- Wiiicoin WIF private keys
- Wiiicoin PSBT creation and signing
- Default ElectrumX SSL server: `wiiicoin.io:50002`
- Wiiicoin payment links using `wiiicoin:`

Full technical parameters and validation steps are in [`docs/WIIICOIN.md`](docs/WIIICOIN.md).

## Development status

This branch establishes the Wiiicoin on-chain wallet core. Bitcoin-specific services inherited from upstream—such as Lightning, Ark, PayJoin, BIP47, Silent Payments, Bitcoin price feeds and Bitcoin fee APIs—must be hidden or replaced before a production release. They are not Wiiicoin functionality.

## Build

The project requires Node.js 22.11 or later.

```bash
git clone https://github.com/W3Vault/Wiiiwallet.git
cd Wiiiwallet
npm install
```

Run Android:

```bash
npx react-native run-android
```

Run iOS:

```bash
npx pod-install
npm start
npx react-native run-ios
```

## Tests

```bash
npm run tslint
npm run unit -- --runInBand
```

A production build must also pass the live ElectrumX send, receive, restore and broadcast checklist in [`docs/WIIICOIN.md`](docs/WIIICOIN.md).

## Upstream

Original project: `BlueWallet/BlueWallet`.

Keep the upstream remote available for security and maintenance updates, while preserving the Wiiicoin network module and derivation settings during merges.

## Licence

MIT. Retain all upstream licence and attribution notices.
