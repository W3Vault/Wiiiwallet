# Wiiiwallet combined regression release build

Build a fresh signed non-debug Android APK from master commit `b40b2a8eb76fdabc07cd8240219a6d711f44039c`.

The source must include and retain both permanent corrections:

1. Mnemonic restore uses Wiiicoin BIP49 wrapped SegWit (`HDSegwitP2SHWallet`, derivation `m/49'/9999'/0'`) and must restore the original `2...` address rather than a `w3i1...` BIP84 address.
2. Namespace PSBT construction adds all namespace and change outputs before signing any input, preventing `Can not modify transaction, signatures exist.`

This file exists only to trigger a clean release build and must not be merged.
