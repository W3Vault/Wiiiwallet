# Wiiicoin namespace derivation

Wiiicoin Core derives a namespace identifier from the first funding input. The hash format depends on the `DEPLOYMENT_NSFIX` version-bits state.

Mainnet was created in September 2025, while the configured `DEPLOYMENT_NSFIX` signalling window ran from 15 July 2020 to 30 August 2020. The deployment therefore did not activate on the live chain. Its mempool uses the pre-NSFIX rule:

```text
namespace payload = 0x35 || HASH160(reverse(input_0_txid))
```

The output index must not be appended. Appending the ASCII output index creates a different payload and `CWiiiMemPool::validateNamespace` rejects the transaction without a detailed validation-state message, which ElectrumX surfaces as `the transaction was rejected by network rules`.

For the device funding input `5bf7201e9d2ca75dee17c38688a9183bf6016cb364b2ee655747f8391bcdc842:0`, the live payload is:

```text
355051a7934af8ef07459f61a8af5baac641465b45
```

Its Base58Check namespace ID is `NTEf4Zbft422WDxDMtNyM7PQypemYtB5Ra`.

## Regression coverage

The unit suite checks the exact device funding input and verifies that changing the input output index does not change the namespace ID while the live pre-NSFIX rule is active. The permanent consolidation audit prevents the always-on NSFIX derivation from returning.
