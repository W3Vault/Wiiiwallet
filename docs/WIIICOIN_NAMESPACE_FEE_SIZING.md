# Wiiicoin namespace fee sizing

Wiiicoin namespace and data transactions use a minimum fee rate of 2,000 satoshis per virtual byte.

The namespace selector represents its custom script output using a script-length estimate. The previous estimate omitted four transaction bytes, causing a one-input namespace creation transaction to be priced as 190 vbytes rather than the required conservative 194-vbyte estimate. The resulting 380,000-satoshi fee was below the signed transaction requirement and Wiiicoin Core rejected it under network rules.

Wiiiwallet now patches the installed `coinselect` dependency so custom script outputs retain those four bytes in the estimate. A focused unit test verifies that the representative namespace transaction receives a 388,000-satoshi fee, safely above the 386,000-satoshi minimum observed for a 193-vbyte signed transaction.
