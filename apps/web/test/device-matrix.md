# Device Screenshot Matrix

Use this when you want to inspect SCHOOL on a set of representative phone layouts without physical devices.

## Run

Start the web app in a separate terminal first:

```bash
npm run dev -w apps/web -- --hostname 127.0.0.1 --port 3000
```

Then run the matrix:

```bash
npm run screenshots:matrix -w apps/web
```

## What it captures

- `http://127.0.0.1:3000/learn/wves312`
- `http://127.0.0.1:3000/learn`
- iPhone and Android emulation presets in a single pass
- Auth and health requests to `localhost:4000` are mocked so you can capture layout without the backend.

## CI Preview Tiers

Use these tier mappings in GitHub Actions when you want a small, representative device set rather than the full matrix:

- `legacy-iphone` -> `iPhone 6`
  - Closest Playwright preset for the small-screen iPhone 6s-era layout class.
- `mainstream-iphone` -> `iPhone 12`
  - Covers the common modern iPhone baseline while still catching narrow-phone regressions.
- `budget-android` -> `Moto G4`
  - Represents a low-cost Android handset class with tighter CPU/memory headroom.
- `tablet` -> `iPad (gen 7)`
  - Covers the mainstream tablet layout class for iPad users.
- `low-end-tablet` -> `Nexus 7`
  - Covers smaller, older Android tablet layouts similar to budget MatePad/Voda tablet usage patterns.

If you need exact Huawei or other vendor-specific browser behavior, use a real-device cloud or physical hardware after this emulated preview pass.

## Output

Screenshots are written to your OS temp directory by default:

```text
/tmp/school-device-matrix
```

You can override the output directory:

```bash
npm run screenshots:matrix -w apps/web -- --out /tmp/my-matrix
```

You can also override routes or devices:

```bash
npm run screenshots:matrix -w apps/web -- --route /learn/wves312 --route /assistant --device "iPhone 14" --device "Galaxy S24"
```

If your app is on a different port, pass `--base-url`:

```bash
npm run screenshots:matrix -w apps/web -- --base-url http://127.0.0.1:3010
```
