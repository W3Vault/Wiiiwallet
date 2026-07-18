# Verification targets

The non-debug APK produced by this branch must be built from `b40b2a8eb76fdabc07cd8240219a6d711f44039c` plus build-trigger documentation only.

Required source invariants:

- `ImportWalletDiscovery.tsx` routes valid mnemonics through `createWiiicoinWalletFromMnemonic`.
- `createWiiicoinWalletFromMnemonic` creates `HDSegwitP2SHWallet`.
- Namespace transaction building calls `addOutputs(...)` before `addAndSignInputs(...)`.
- The Wiiiwallet consolidation audit passes.
- The release APK is signed and non-debuggable.

Build-only documentation; do not merge.
