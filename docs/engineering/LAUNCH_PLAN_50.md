# SCHOOL — 50-Item Launch & Competitiveness Plan (EVIDENCE-BACKED)
**Date:** 2026-08-25 · **Audit method:** 3 parallel code-verifying agents (file:line evidence)
**Critical correction:** The pasted plan's headline "P0-1: two critical secrets committed to git"
is **FALSE**. `.env` is gitignored and untracked. The REAL launch blocker is a different
secret: the **Android upload keystore is in pushed git history** (must rotate). All items
below are verified TRUE/FALSE against source — not assumptions.

Legend: ✅ verified present · ❌ verified missing · ⚠️ partial/stub · P0 launch-blocker

---

## TIER 0 — PLAY STORE LAUNCH BLOCKERS (do first — minors-facing app)
1. **[P0] Rotate Android upload keystore leaked in git history.** Blobs `apps/android/android.keystore` (f78cf859), `apps/android-signing/android.keystore` (784a8489), `apps/mobile/android/app/debug.keystore` (364e105) reachable from `refs/remotes/origin/*`. Reset upload key with Google Play; treat as compromised. (`KEYSTORE_NOTE.md` admits "leaked 2026-08-23, rotate before release".)
2. **[P0] Fix TWA `build.gradle` to PRODUCTION host.** `apps/android/app/build.gradle:17` hostName `saeduweb-production.up.railway.app` (staging) + `:33` applicationId `app.railway.up.saeduweb_production.twa` — conflicts with `twa-manifest.json` (host `school.ditshego-ventures.co.za`, packageId `za.co.ditshego.school`). APK would wrap staging.
3. **[P0] Replace `assetlinks.json` placeholder.** `apps/web/public/.well-known/assetlinks.json:11` contains `"REPLACE_WITH_PLAY_APP_SIGNING_FINGERPRINT"` — TWA untrusted (URL bar shows) until real SHA-256 added (must match rotated key #1).
4. **[P0] Fix `.gitignore` merge-conflict markers.** Lines 65/73/77 contain `<<<<<<<` / `=======` / `>>>>>>>` — a committed botched merge. Resolve + recommit.
5. **[P1] Enforce POPIA §35 age-gate (currently bypassable).** `apps/api/src/routes/auth/registration.ts:30` `dateOfBirth: .optional()`; `:71` gate wrapped in `if (parsed.data.dateOfBirth)` — a minor omitting DOB skips under-13 block (`:84-85`) + parental consent (`:88-93`). Make DOB mandatory for learner self-signup.

## TIER 1 — SECURITY & POPIA HARDENING (minors' data)
6. **[P1] Apply real Content-Security-Policy (nonce).** `next.config.mjs:30-46` headers have NO CSP; comment claims `proxy.ts` middleware sets it — but no `middleware.ts`/`proxy.ts` exists; `layout.tsx:135-141` only injects nonce `<meta>` if `x-nonce` set (never). → Add `apps/web/middleware.ts` with per-request nonce + `strict-dynamic`. (Draft: quick-wins/02.)
7. **[P1] Enforce phone encryption at rest in prod.** `config.ts:58` `PHONE_ENCRYPTION_KEY` default `""`; `users.ts:60-66` falls back to plaintext `users.phone` when unset. Key exists; must be provisioned + backfilled (see POPIA_GAP_TICKETS.md Ticket A).
8. **[P1] Encrypt message bodies at rest (E2E differentiator).** `messages.ts:1967` stores `body` plaintext; `:111/:156` `message_body: string`. Minors' DMs unencrypted. Add Web Crypto AES-GCM (per-conversation ECDH keys); server stores ciphertext only.
9. **[P2] Enable HSTS for prod domain.** `next.config.mjs:48-53` only if `HSTS_ENABLED=true`. Turn on for school.ditshego-ventures.co.za.
10. **[P2] Rotate/secure GitHub credential.** `.git/config` remote URL embeds `x-access-token` (on disk, not tracked) — move to credential helper / SSH.

## TIER 2 — VISUAL EDUCATION (the "Google Notebook gap" — your priority)
11. **[HIGH] KaTeX rendered math.** ❌ No katex; `markdown.ts` marked-only. Add `react-markdown`+`remark-math`+`rehype-katex`; generator emits `$…$`. (Draft: quick-wins/01.) Closes P1-7.
12. **[HIGH] Visual lesson schema extension.** ❌ `GeneratedLessonContent` (lessonGenerator.ts:37) has no diagram/chart/image/widget fields. Add `visuals[]` union + `LessonVisual.tsx`. (Draft: quick-wins/03.) Foundation for 13–15.
13. **[HIGH] Auto-generated diagrams (Mermaid/PlantUML).** ❌ Add `diagramSpec` → SVG in lesson body. Concept maps, flowcharts, timelines.
14. **[HIGH] Charts/graphs (recharts/vega-lite).** ❌ Add `charts:[{type,data}]` → interactive bar/line/pie/scatter for Economics/Geography/Science/Accounting.
15. **[HIGH] Image generation (DALL·E 3 / SD / FAL).** ❌ Zero image-gen calls in pipeline. Add `generateLessonVisual(topic,stylePreset)` → Supabase Storage CDN; cache forever; style presets clean/warm/scientific.
16. **[MED] Interactive in-lesson widgets.** ❌ No slider/sim inside `AiLessonView`. Add `widgets[]` (parameter sliders, drag-categorise, sims).
17. **[MED] Upgrade ConceptMap to in-lesson knowledge graph.** ⚠️ `ConceptMap.tsx` real but only section-progress radial in `LearnProgressPanel`; derive edges from content, embed in lesson, clickable → sections.
18. **[MED] High-quality TTS audio lessons.** ⚠️ Browser `speechSynthesis` read-aloud works (`AudioPlayer.tsx`); `VideoLessonMetaSchema.provider:"elevenlabs"` is a dead enum. Wire ElevenLabs for narration + captions + chapters (SA illiteracy reach).
19. **[MED] Visual completion/quality analytics.** ⚠️ `/analytics/mastery-heatmap` (analytics.ts:231) is `notImplemented`. Implement heatmap + per-lesson engagement dashboards.

## TIER 3 — AI INTELLIGENCE (outbox the giants)
20. **[HIGH] RAG-grounded tutor with memory.** ⚠️ `StudyChat.tsx` + `/api/assistant/*` exist but generic. Wire to learner's lesson content + CAPS scaffold + weak-topic data; cite sources.
21. **[MED] Adaptive difficulty (IRT/Elo).** ⚠️ `AdaptivePractice.tsx` exists; use `learner_topic_mastery` for zone-of-proximal-development serving.
22. **[MED] Spaced repetition (SM-2).** ⚠️ `packages/shared/src/sm2.ts` + `FlashcardDeck.tsx` exist; integrate so every lesson schedules reviews + dashboard.
23. **[MED] Exam-readiness predictor.** ⚠️ `ExamReadinessScore.tsx` exists; combine quiz accuracy + mastery + past-paper scores → % readiness + weak-topic recs.
24. **[MED] Semantic lesson search.** ⚠️ `LanguageSearchPanel.tsx` exists; wire Voyage embeddings + pgvector across 7,700 lessons.
25. **[MED] Equation scanner (OCR→solve).** ⚠️ `EquationScanner.tsx` exists; wire OCR→step-solve→similar problems.
26. **[MED] Voice-mode learning.** ⚠️ `VoiceRecorder.tsx` + Whisper STT + `speechSynthesis` exist; loop transcribe→RAG→speak.

## TIER 4 — REAL-TIME / PLATFORM
27. **[MED] Extend SSE real-time beyond messages.** ✅ SSE works (`messages.ts:3985` `/messages/stream` → `MessagesClientPage.tsx:4508` EventSource). Add notifications/assignments streams + typing presence (presence events defined `messageBus.ts:12-13`).
28. **[MED] Full offline (Workbox).** ⚠️ `public/sw.js` hand-rolled (no Workbox); `SaveLessonOfflineButton.tsx` uses `caches.addAll` only; `offline-db.ts` IndexedDB sync unused by button. Upgrade + wire.
29. **[MED] Web-push SENDER (VAPID).** ⚠️ `push/subscribe/route.ts:26-31` stores subs; `notifications.ts` only sends Expo (mobile) — web pushes NEVER dispatch. Add `web-push` + VAPID.
30. **[MED] Real SSO (OIDC/SAML).** ❌ `sso.ts:14-18` stub (decodes base64, no IdP verification). Implement Google Workspace / MS Edu for school deployments.
31. **[MED] Connection pooling.** ⚠️ `db/pool.ts` raw pg.Pool; use Supabase pooler (6543) for serverless scale.
32. **[LOW] Multi-region edge caching.** ✅ Vercel CDN; add edge cache for immutable lesson content.

## TIER 5 — INTEGRATIONS (your "plugins, MCP, connectors" mandate)
33. **[HIGH] Local MCP server / connector framework.** ❌ `.mcp.json` Supabase-only; no `createMcpServer`/`FastMCP` in api. Expose curriculum/lesson/quiz/progress tools to agents.
34. **[HIGH] LMS connectors (Google Classroom, MS Teams, Canvas, Moodle).** ❌ Zero connector implementations.
35. **[MED] Outbound webhook/connector framework (Zapier/IFTTT).** ❌ None.
36. **[MED] Widget/plugin SDK surface.** ❌ No `widgets/`/`plugins/` package; build an SDK for 3rd-party lesson widgets.
37. **[MED] Multi-IdP OIDC discovery.** ⚠️ Single stub endpoint; expand to several edu providers.
38. **[LOW] BrandOS social publishers.** ⚠️ `brandWorkers.ts` has 4 TODO stubs (X/LinkedIn/Instagram/YouTube).

## TIER 6 — CONTENT COMPLETENESS
39. **[HIGH] Resume quality pipeline (OpenAI credits).** ⚠️ 147/15,760 validated; 767 failed; 8,058 ungenerated. Top up + `quality:regen` → 100% CAPS coverage.
40. **[MED] Enrichment pass per lesson** (visualBrief + diagramSpec + audioScript + flashcards).
41. **[MED] Missing-subject coverage** (Life Orientation, Geography FET, History FET, 11 African languages) by enrollment.
42. **[MED] Past-paper → feedback loop** (weak topics → linked lessons → targeted practice → readiness).
43. **[MED] Multi-language lesson content** (English/Afrikaans/Zulu/Sotho/Xhosa/Tswana; Foundation Phase mother-tongue).
44. **[LOW] Teacher lesson-plan generator** (timing, differentiation, rubrics, PDF export).

## TIER 7 — UX POLISH (user experience first)
45. **[MED] Custom 404 `not-found.tsx` + route `loading.tsx`.** ❌ Only `error.tsx`/`global-error.tsx` exist.
46. **[MED] Standardize loading/error (Suspense + query boundaries).** ⚠️ Hand-rolled `useState` guards across pages.
47. **[LOW] Enhance Command Palette** (cmdk fuzzy, recent/contextual). ⚠️ Static list.
48. **[LOW] Orphaned `ThemeToggle`** (0 mounts) — add global dark/light toggle; fix `manifest.json` SVG-only icons (add 192/512 PNG).
49. **[LOW] Parent portal + teacher dashboard** (roles exist; no parent UI; teacher view missing class analytics).
50. **[LOW] Referral + subscription tiers + credit economy** (Scholar/Family/School gating; referral loop; earn-spend credits).

---

## GOOGLE PLAY GO / NO-GO (current)
**NO-GO until Tier 0 items 1–4 are closed.** Specifically: the leaked keystore (#1) is a
release-blocking credential compromise; the TWA wraps STAGING (#2) and the assetlinks
fingerprint is a placeholder (#3) — as-built, the APK would show a URL bar / wrong domain.
Age-gate bypass (#5) is a POPIA §35 violation for a minors app and must be fixed pre-launch.
Everything else (visual content, AI, integrations) is post-launch enhancement, NOT a blocker.

## SEQUENCING
Phase 1 (blockers): Tier 0 (1–5) + Tier 1 (6–8).
Phase 2 (differentiators): Tier 2 (11–19) — start with 11+12 (math + schema backbone).
Phase 3 (intelligence): Tier 3 (20–26).
Phase 4 (platform/integrations): Tier 4–5 (27–38).
Phase 5 (content/UX): Tier 6–7 (39–50).
