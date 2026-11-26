# Android signing key (NOT in git)

This upload keystore is gitignored (*.keystore) for security.
Store it in a secret manager / local-only path. See docs/engineering/ANDROID_AAB_RELEASE_SETUP.md.
The key was previously leaked in git history and purged on 2026-08-23 (B3 fix).
If you need to re-sign, generate a fresh upload key and register it with Play.
