# Android AAB Release Setup

This document is the release-day runbook for the SCHOOL Trusted Web Activity bundle.

## Repository identity

- Package ID: `za.co.ditshego.school`
- Production host: `school.ditshego-ventures.co.za`
- Compile SDK: Android API 36
- Target SDK: Android API 35
- Minimum SDK: Android API 21
- Gradle wrapper: 8.11.1
- Android Gradle Plugin: 8.9.1
- Output: `apps/android/app/build/outputs/bundle/release/app-release.aab`

## Local prerequisites

Install JDK 21, Android SDK Platform 35 and 36, Android SDK Platform Tools, Android SDK Command-line Tools, and compatible Android Build Tools. The Gradle wrapper downloads Gradle 8.11.1 automatically.

Set the SDK variables in the shell used for the build:

```bash
export JAVA_HOME=/absolute/path/to/jdk-21
export ANDROID_SDK_ROOT=/absolute/path/to/Android/Sdk
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
```

Create the untracked SDK location file:

```bash
cat > apps/android/local.properties <<EOF
sdk.dir=$ANDROID_SDK_ROOT
EOF
```

Accept licences and install the project platforms:

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "platforms;android-36" "cmdline-tools;latest"
```

## Release signing variables

The Gradle release signing configuration is environment-driven. Never commit a keystore, certificate, or password.

```bash
export ANDROID_KEYSTORE_PATH="$HOME/.school-android/school-upload.jks"
export ANDROID_KEYSTORE_PASSWORD='your-keystore-password'
export ANDROID_KEY_ALIAS='school-upload'
export ANDROID_KEY_PASSWORD='your-key-password'
```

To force a Play-ready build to fail rather than silently produce an unsigned bundle, set:

```bash
export SCHOOL_ANDROID_SIGNING_REQUIRED=true
```

When this flag is `true`, Gradle requires all four signing variables. When it is absent or `false`, a local release build may be configured without signing credentials for compilation checks only; do not upload that artifact to Google Play.

Generate a new upload key outside the repository if one has not been provided:

```bash
mkdir -p "$HOME/.school-android"
chmod 700 "$HOME/.school-android"
keytool -genkeypair -v \
  -keystore "$HOME/.school-android/school-upload.jks" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias school-upload \
  -dname "CN=SCHOOL, O=DITSHEGO VENTURES (PTY) LTD, C=ZA"

keytool -export -rfc \
  -keystore "$HOME/.school-android/school-upload.jks" \
  -alias school-upload \
  -file "$HOME/.school-android/school-upload-cert.pem"
```

If the app already exists in Google Play, the owner must complete the upload-key reset or registration in Play Console. The fingerprint used in `assetlinks.json` must be the certificate that signs the distributed app—normally the **Play App Signing certificate**, not merely the local upload certificate.

## Preflight and build

From the repository root:

```bash
npm run security:android-release

cd apps/android
chmod +x gradlew
./gradlew clean
./gradlew bundleRelease
```

For a Play-ready build, use:

```bash
SCHOOL_ANDROID_SIGNING_REQUIRED=true \
ANDROID_KEYSTORE_PATH="$HOME/.school-android/school-upload.jks" \
ANDROID_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" \
ANDROID_KEY_ALIAS="school-upload" \
ANDROID_KEY_PASSWORD="$ANDROID_KEY_PASSWORD" \
./gradlew bundleRelease --no-daemon
```

The expected artifact is:

```text
apps/android/app/build/outputs/bundle/release/app-release.aab
```

Verify that it exists and is non-empty:

```bash
test -s app/build/outputs/bundle/release/app-release.aab
ls -lh app/build/outputs/bundle/release/app-release.aab
```

Verify signing:

```bash
jarsigner -verify -verbose -certs \
  app/build/outputs/bundle/release/app-release.aab
```

## Digital Asset Links handoff

The web file is:

```text
apps/web/public/.well-known/assetlinks.json
```

It must contain package `za.co.ditshego.school` and the SHA-256 fingerprint for the certificate used by the installed Play app. After updating it, deploy the web app and verify:

```bash
curl -fsSL \
  https://school.ditshego-ventures.co.za/.well-known/assetlinks.json | jq .
```

The TWA should open without a browser URL bar only after the live asset-links document matches the distributed app certificate.

## Manual release-day items

1. Confirm Play Console app identity and package ID.
2. Generate or retrieve the upload keystore.
3. Complete upload-key registration/reset in Play Console.
4. Retrieve the Play App Signing SHA-256 fingerprint.
5. Update `assetlinks.json` if the fingerprint differs.
6. Deploy the web change and verify the live asset-links URL.
7. Build with `SCHOOL_ANDROID_SIGNING_REQUIRED=true`.
8. Upload the AAB to an internal testing track.
9. Verify the installed app opens the production host as a trusted TWA.
10. Keep the keystore, passwords, and certificate backups in a secure secret manager.
