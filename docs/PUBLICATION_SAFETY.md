# Publication safety

Scan date: 23 Nov 2026. Tool: gitleaks 8.28.0 over all git objects (`gitleaks detect --log-opts=--all`, default rules, redacted report). No secret values are written here.

This branch does not change repository visibility, delete branches, or rewrite history.

## Secrets

| File | Commit | Type | Notes |
| --- | --- | --- | --- |
| `apps/web/lib/equipment.ts` | `abf9259e927eee03e34682acf4a41338af4c594d` (reachable from `main`) | generic-api-key, false positive | Local storage key constant for equipment quotes. Low entropy. Not a credential. |
| `apps/web/lib/equipment.ts` | `5c8cb55cac1b0eb7368130d971c45fa889f2ef77` (not an ancestor of `main`) | same false positive | Old initial history. |
| `apps/android/android.keystore` | `b974d21c5021ac5f6d5b1882426d7a9504a50d71`, `5ef1bcb5d0bb104275c009f4d9ff7b5e6271814f` | Android keystore | Not on `main`. Still reachable from many other remote branches. |
| `apps/android-signing/android.keystore` | same two commits | Android keystore | Same. Notes in-repo already say the upload key leaked and should be rotated. |
| `apps/mobile/android/app/debug.keystore` | `876514a685d2abe7a1bf8557cae034e688069d0e`, `5ef1bcb5d0bb104275c009f4d9ff7b5e6271814f` | Android debug keystore | Not on `main`. Password in Gradle is the well-known debug password. |

No `.env` files other than examples. No PEM files, service-account JSON, `google-services.json`, or gitleaks hits for OpenAI, Firebase, AWS, Stripe, or database URLs.

**Before a public GitHub repo:** `main` does not need a history rewrite for live API keys. The upload keystore is still in other branches, so those branches must be rewritten or removed (not done here) and the Play upload key rotated if it was ever used. Example passwords in `.env.example` are local placeholders. Rotate them if they were reused in production.

## Third-party content that Apache-2.0 does not cover

| Where | What | Suggested fix |
| --- | --- | --- |
| `apps/web/prisma/past-papers.db` | 1 174 DBE/NSC catalogue rows and source URLs. PDF bytes are not in git. | Keep metadata, attribute DBE, and do not treat the papers or memos as Apache-licensed. Fetch binaries at runtime. |
| `tools/gde_mirror/` | Scraper for Gauteng education files. Downloads land in gitignored `content/`. | Keep the tool. Do not commit the mirror. |
| `packages/shared/content/course_outline.json` | Original week summaries, not full CAPS PDFs. Topic names follow the curriculum. | Keep. Do not add official CAPS PDFs. |
| `apps/web/lib/generated/*AcademicCatalog.generated.json` | Scraped university catalogue text. | Confirm a licence or replace with links. |
| `apps/web/app/fonts/*.woff2` | Playfair Display, Archivo, JetBrains Mono. SIL Open Font License, not Apache. | Keep the files under OFL. See `NOTICE`. |
| `apps/web/public/images/books/becoming-el-matador-cover.jpg` | Book cover. | Replace with art the company owns, or remove before publication. |
| `docs/legal/operator-agreements/evidence/IO_Certificate_2026-018785.pdf` | Official certificate. | Keep out of the Apache grant. |
| `docs/SCHOOL_BOARD_PACKET.pdf`, `docs/SCHOOL_OVERVIEW_FUTURE.pdf` | Internal PDFs. | Confirm they may be public. |

## Personal data

Past-paper attempt tables in the committed database are empty. No learner seed emails were found. Instagram code is a caption generator, not an export of accounts.

Legal documents include an information-officer email, a mobile number, and a street address. Those become public with the repo. Prefer a role mailbox before publication if the mobile number should stay private.

The family page is a read-only week view behind an unguessable token. It shows study signals, not a wallet.
