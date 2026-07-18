${docs.trimEnd()}

## Input sequence compatibility

Namespace transactions use the final input sequence **0xffffffff**, matching the original Wiiicoin wallet. They must not inherit the ordinary payment wallet RBF sequence. Electrum rejection alerts also omit raw transaction hex while preserving the server message and error code.
