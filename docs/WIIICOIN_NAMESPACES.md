# Wiiicoin namespace handling

Wiiiwallet includes the core namespace behaviour from `wiiicoin/wiiicoin_wallet`, adapted to the current BlueWallet-based application architecture.

## Supported operations

- Discover namespace control outputs owned by a wallet.
- Create a namespace.
- Read namespace key/value history.
- Add or update a key/value entry.
- Delete a key.
- Transfer namespace control to another Wiiicoin wrapped SegWit address.

The older wallet's social, media, reward, reply, bidding and NFT-specific extensions are not included in this port.

## Wallet requirement

Namespace scripts end with a P2SH ownership condition, matching the original implementation. For that reason, namespace management is exposed only for writable Wiiicoin HD wrapped SegWit wallets (`p2sh(p2wpkh)`).

The namespace control output is reserved by the namespace transaction builder and is excluded from ordinary funding inputs. Every update spends the current control output and creates its replacement with a value of `1,000,000` base units.

## Wire compatibility

The implementation retains the original protocol values:

- Namespace opcode: `0xd0`
- Put opcode: `0xd1`
- Delete opcode: `0xd2`
- Namespace transaction version: `0x7100`
- Namespace Base58Check prefix: `0x35`
- Root namespace marker: `\x01_KEVA_NS_`

A namespace ID is derived from the first selected funding input using:

1. The transaction ID in internal byte order.
2. The UTF-8 decimal output index.
3. HASH160 of those concatenated bytes.
4. Prefix byte `0x35` and Base58Check encoding.

## ElectrumX requirements

The configured Wiiicoin ElectrumX server must provide the namespace RPC methods used by the original wallet:

- `blockchain.keva.get_transactions_info`
- `blockchain.keva.get_keyvalues`

For forward compatibility, the client also tries equivalent `blockchain.wiiicoin.*` and `blockchain.namespace.*` method names when the legacy method name is unavailable.

Standard Electrum calls continue to use the application's configured server. Namespace reads use a short-lived connection to that same preferred server.

## User interface

Namespace management is available under **Settings → Tools → Namespaces**. Transaction creation is followed by a fee confirmation and, when enabled, biometric authentication before broadcast.
