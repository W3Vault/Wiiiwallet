# Wiiiwallet non-debug APK build request

Build the current consolidated `master` source as a signed Android release variant.

Required validation:
- release variant, not debug
- `debuggable=false`
- APK signature verification
- arm64-v8a output
- upload APK and SHA-256 metadata as workflow artifacts
