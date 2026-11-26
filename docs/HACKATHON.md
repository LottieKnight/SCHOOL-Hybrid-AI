# Hybrid tutor — #BuildHybridAI

Built from 11 Nov 2026. Submissions close 30 Nov 2026 at 14:00 PT (1 Dec 00:00 SAST).

## Value

Grade 10–12 CAPS learners on budget Android phones pay for every megabyte. SCHOOL Hybrid Tutor asks Gemini Nano on the phone first. That answer is free, private, and still works when the signal is bad. Long written answers and PDF papers go to cloud Gemini. A counter estimates the mobile data that stayed on the phone, at about R85 per GB.

## What judges should open

1. `npm install` at the repo root.
2. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill `NEXT_PUBLIC_FIREBASE_*` from a Firebase project. Leave them empty to see the graceful empty state.
3. `npm run dev -w apps/web` and open `http://localhost:3000/tutor` on a phone or in Chrome device mode (360×800).
4. In Chrome, enable the Prompt API for Gemini Nano (`chrome://flags` → Prompt API / on-device model) and tap **Enable on-device AI**. That button calls `initializeDeviceModel()` from the tap.
5. Type a short maths question or take a photo. You should see one hint card, not the final answer. Swipe or tap **Next hint**. The answer appears only after **Show the final answer**.
6. The chip says whether the reply ran on this device or in the cloud. A long answer and a PDF plan should say cloud.

Firebase setup:

- Create a Firebase project and a web app.
- Enable AI Logic with the Gemini Developer API.
- Turn on App Check with reCAPTCHA Enterprise. For local dev, set `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN` and register that debug token. Do not ship the debug token.
- Turn on Anonymous auth.
- Add Remote Config keys: `inference_mode` (`PREFER_ON_DEVICE`), `long_answer_chars` (800), `cloud_model` (`gemini-3.5-flash-lite`), `ai_enabled` (true). `ai_enabled` is the kill switch.
- Optional: deploy `firebase/firestore.rules`. Attempts are stored only under `users/{uid}/tutorAttempts` for that anonymous user.

The live site `school.ditshego-ventures.co.za` is OpenNext on Cloudflare Workers (`apps/web/wrangler.jsonc`, `x-opennext: 1`). There is no GitHub Action that deploys it, and this repo does not publish a pull-request preview. Production deploy is a manual Wrangler publish after merge:

```bash
cd apps/web
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
```

That needs a Cloudflare API token for the account that owns the zone. `NEXT_PUBLIC_FIREBASE_*` and the reCAPTCHA Enterprise site key are public and are committed in `apps/web/.env.production` (inlined by `next build`) and repeated in `wrangler.jsonc` `vars` for the Worker runtime. Do not add the App Check debug token. Remote Config is already published in Firebase (`prefer_on_device`, 600 characters, `gemini-2.5-flash`, `ai_enabled=true`).

## Android and Best Android

Gemini Nano is Chrome's built-in Prompt API (`LanguageModel`). Android System WebView, and an in-app WebView, do not expose that API. The Expo screen at `apps/mobile/app/tutor.tsx` is a native journey (steps, thumb-sized button, plain language). **Start tutor in Chrome** opens an Android intent with `package=com.android.chrome`, falling back to the https URL. Hybrid inference then runs in the same `/tutor` page judges use on the web:

- `firebase/ai` `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE`
- on-device path: Gemini Nano through Chrome
- cloud path: Gemini when the answer is longer than `long_answer_chars`, or the upload is a PDF
- the page reads `response.inferenceSource` and shows where the answer ran

Practice → **Hybrid tutor** is the in-app entry (`router.push("/tutor")`).

### Judge test on a phone

1. Install the preview APK, or run `npx expo start` in `apps/mobile` and open it in Expo Go on Android.
2. Set `EXPO_PUBLIC_WEB_BASE_URL` to the deployed SCHOOL site (or a LAN URL such as `http://192.168.0.10:3000` while `next dev` is bound to `0.0.0.0`).
3. Open Practice, tap **Hybrid tutor**, then **Start tutor in Chrome**.
4. In Chrome, tap **Enable on-device AI** (needs the Prompt API flags on Chrome Canary/Dev or a Chrome build that already has Gemini Nano).
5. Ask a short question. Confirm the chip says the answer ran on the device. Ask with a long answer or a PDF and confirm the chip says cloud.
6. Turn on airplane mode and ask a short hint again. On-device should still answer. If the model is not downloaded, the saved topic and `/offline` remain.

### Build an APK

EAS (installable APK, no Play upload):

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview
```

`eas.json` profile `preview` sets `android.buildType` to `apk`. `development` is also an APK, with the dev client.

Local debug APK (Android SDK and a JDK on the machine):

```bash
cd apps/mobile
npm install
npx expo run:android --variant debug
```

The debug APK is under `apps/mobile/android/app/build/outputs/apk/debug/`. Release signing stays outside git. Do not commit a keystore.

## Three-minute demo

1. 0:00 — Phone on a slow network. Open the installed SCHOOL icon. Bottom **Tutor** button.
2. 0:20 — Status chip: on-device model. Tap **Enable on-device AI** if it still needs a download.
3. 0:40 — Photograph a Grade 11 question. The photo is compressed. First hint card appears. Say that the final answer is still hidden.
4. 1:10 — Swipe to the next hint. Point at the data-saved line in rands.
5. 1:30 — Turn on airplane mode. Ask another short hint. It still runs on the phone. If the model is missing, the saved topic and the offline page remain.
6. 2:00 — Mark a short answer, then a long one. The long one is labelled cloud. Method marks are mentioned.
7. 2:25 — Start a timed sitting. Questions lean toward weak topics. Review one question. A revision note and one follow-up are saved.
8. 2:50 — Show the skill map move, then stop.

## Devpost draft

**SCHOOL Hybrid Tutor** helps South African Grade 10–12 learners practise CAPS work without spending their airtime. The tutor calls Firebase AI Logic in hybrid mode: Gemini Nano on the phone when it can, cloud Gemini when the answer is long or the paper is a PDF. Learners get a hint ladder that does not reveal the answer until they ask, a mark with method marks, and a revision plan. Weak topics feed a short timed sitting. Error patterns become a revision note plus one follow-up question. The phone UI is built for a 360px Android screen: camera capture, thumb-level actions, offline cache, and an installable PWA.

## What was already in the repo

Lessons, the past-paper catalogue, accounts, and the Expo shell. This branch adds the hybrid tutor and the mobile layout around it. DBE papers and memos stay the government’s copyright. See `docs/PUBLICATION_SAFETY.md` before the repository is made public.
