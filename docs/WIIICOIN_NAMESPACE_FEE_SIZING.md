# Wiiicoin namespace fee sizing

Wiiicoin namespace and data transactions use a fee rate of 2,000 satoshis per estimated byte.

The original Wiiicoin wallet passes ordinary UTXOs to `coinselect` without a custom input-script size. `coinselect` therefore uses its conservative 148-byte P2PKH input estimate: a 41-byte input base plus a 107-byte script allowance. Although Wiiiwallet signs these inputs as P2SH-wrapped SegWit, namespace transaction fees must reproduce the original wallet algorithm for compatibility.

Two porting differences previously reduced the fee:

1. Wiiiwallet marked each namespace funding input with a 50-byte script estimate, reducing the calculated input size from 148 to 91 bytes.
2. The custom namespace output estimate omitted four transaction bytes.

The installed `coinselect` patch now restores both values for namespace transactions. The representative one-input namespace creation shown during testing is therefore priced at 502,000 satoshis, or 0.00502000 WIII, instead of 380,000 or 388,000 satoshis.

Wiiiwallet also preserves nested Electrum and daemon rejection details in the error alert while removing raw transaction hexadecimal data. This provides a specific live-node rejection reason if a transaction is refused for any rule other than fee sizing.
