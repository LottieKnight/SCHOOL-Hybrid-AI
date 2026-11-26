# SCHOOL — 50 UPGRADES / FIXES / FEATURES (Independent Audit, 2026-08-25)
**Author:** Hermes Agent (independent of the earlier guessed plan; verified against code)
**Repos:** `projects/SCHOOL-Academic-Platform` + mirror `SCHOOL-Academic-Platform`
**Scope:** Product completeness + competitiveness vs Gemini/ChatGPT/Claude for SA education.
**Note:** Launch blockers (T0-1…T0-5) are owned by opencode — NOT repeated here. This is the
product/feature layer. Items marked ✅ exist-but-needs-work; ❌ missing; 🔧 enhance.

## TIER A — VISUAL & INTERACTIVE EDUCATION (the "Google Notebook" gap — your priority)
1. ✅→🔧 KaTeX math rendering (DONE this session — ensure generator emits `$…$`).
2. ❌ Visual lesson schema `visuals[]` (diagramSpec/chart/image/widget) — extend `GeneratedLessonContent`.
3. ❌ Auto-generated diagrams (Mermaid→SVG) in lesson body.
4. ❌ Charts/graphs (recharts) for Economics/Geography/Science/Accounting.
5. ❌ Image generation (DALL·E 3 / SD / FAL) → Supabase Storage CDN, cache forever.
6. ❌ In-lesson interactive widgets (sliders, drag-categorise, sims).
7. 🔧 Upgrade `ConceptMap.tsx` from progress-radial → in-lesson knowledge graph.
8. 🔧 Wire ElevenLabs TTS (dead enum today) for audio lessons + captions.
9. ❌ Visual completion/engagement analytics (mastery-heatmap stub → real).
10. ❌ "Explain like I'm 12 / in isiZulu / with a diagram" multi-mode lesson re-render.

## TIER B — AI INTELLIGENCE (outbox the giants)
11. 🔧 RAG-grounded tutor: wire StudyChat to lesson content + CAPS + weak-topic memory.
12. 🔧 Adaptive difficulty (IRT/Elo) using `learner_topic_mastery`.
13. 🔧 Spaced repetition (SM-2 `packages/shared/src/sm2.ts`) → review scheduling + dashboard.
14. 🔧 Exam-readiness predictor from quiz/mastery/past-paper data.
15. 🔧 Semantic lesson search (Voyage embeddings + pgvector across 7,700 lessons).
16. 🔧 Equation scanner (OCR → step-solve → similar problems).
17. 🔧 Voice-mode learning (Whisper STT + speechSynthesis already wired).
18. ❌ Offline AI tutor (cached lesson embeddings for no-signal study).
19. ❌ "Ask about my last quiz" contextual AI using analytics.
20. ❌ Teacher AI lesson-plan generator (timing/rubrics/PDF) from `teacher_notes`.

## TIER C — PLATFORM / REAL-TIME / UX (user experience first)
21. ✅ SSE messaging works — 🔧 extend to notifications/assignments + typing presence.
22. 🔧 Full offline (Workbox) — `SaveLessonOfflineButton` → use `offline-db` sync queue.
23. 🔧 Web-push SENDER (VAPID) — subs stored but never dispatched today.
24. ❌ Real SSO (OIDC/SAML) — `sso.ts` is a confirmed stub.
25. 🔧 Connection pooling (Supabase pooler 6543 for serverless scale).
26. ❌ Custom 404 `not-found.tsx` + route `loading.tsx`.
27. 🔧 Standardize loading/error (Suspense + query boundaries).
28. 🔧 Command Palette (cmdk fuzzy, recent/contextual).
29. 🔧 Orphaned `ThemeToggle` → global dark/light; add raster PNG icons to manifest.
30. 🔧 Surfaced offline-sync status UI (`useOffline` invisible today).

## TIER D — INTEGRATIONS (your "plugins, MCP, connectors" mandate)
31. ❌ Local MCP server exposing curriculum/lesson/quiz/progress tools to agents.
32. ❌ LMS connectors (Google Classroom, MS Teams, Canvas, Moodle).
33. ❌ Outbound webhook/connector framework (Zapier/IFTTT).
34. ❌ Widget/plugin SDK surface for 3rd-party lesson widgets.
35. 🔧 Multi-IdP OIDC discovery (expand stub to several edu providers).
36. 🔧 BrandOS social publishers (4 TODO stubs in `brandWorkers.ts`).
37. ❌ WhatsApp notification connector (SA-dominant channel) via Twilio/360Dialog.
38. ❌ Calendar integration (Google/Outlook) for study reminders.

## TIER E — CONTENT COMPLETENESS (SA curriculum depth)
39. 🔧 Resume quality pipeline (147/15,760 validated; 767 failed; 8,058 ungenerated).
40. ❌ Missing-subject coverage (Life Orientation, Geography FET, History FET, 11 African langs).
41. 🔧 Past-paper → feedback loop (weak topics → linked lessons → practice).
42. ❌ Multi-language lesson content (EN/AF/ZU/SO/TS/ST/XH/TN — Foundation mother-tongue).
43. 🔧 Teacher dashboard with class analytics (admin pages exist, teacher view missing).
44. ❌ Parent portal + progress reports (parent role exists, no UI).
45. 🔧 Referral program + credit economy (earn-by-studying → spend on marketplace).

## TIER F — ECONOMIC PRICING & ACCESS (this session's implementation focus)
46. ✅ Wallet/credit system mature — 🔧 add FREE tier + Scholar/Family/School plans.
47. 🔧 **ECONOMIC PRICING MODEL** — implement below (R0 free, ~R29 Scholar, ~R59 Family,
    ~R199 School) with plan_type enum + FeatureGate tiers + PayFast/ZAR.
48. ❌ Data-free / zero-rated access partnership (e.g. Telkom/MTN zero-rating for education).
49. 🔧 NSM (National Student Financial Aid) / bursary voucher redemption in wallet.
50. ❌ Sponsored-seat model (schools/NPOs sponsor learners in need — your outreach goal).

**Sequencing:** A+B (differentiators) → F (pricing/access, this session) → C+D (platform) → E (content).
**Coordination with opencode:** it owns T0-1…T0-5 (launch blockers) + store listing. I own A,B,C,D,E,F here.
No overlap. Both commit locally; push after opencode's T0-1 history rewrite.
