# SCHOOL Platform — next-intl i18n Design

**Date:** 2026-05-30  
**Scope:** Phase 1 UI translation using next-intl (preference-based locale, no URL changes)  
**Languages:** All 11 official South African text languages  

---

## 1. Problem

The platform stores the user's language preference (`appPreferences.language`) but uses it only to instruct the AI tutor. The entire UI (buttons, headings, error messages, navigation) remains in English regardless of preference. Students whose home language is isiZulu, Afrikaans, or Sesotho navigate a fully English interface.

---

## 2. Goals

- The platform UI renders in the user's chosen language from their first login onward.
- Language switching is instant (cookie-driven, no extra DB calls per request).
- Translations are AI-generated and stored as version-controlled JSON — human corrections are submitted via PR over time.
- Phase 1 covers the highest-traffic pages. Full coverage (all 136 pages) is a follow-up.

---

## 3. Non-Goals

- URL-based locale prefixes (`/zu/dashboard`) — not needed for a logged-in EdTech app.
- Manual translations at launch — impractical for 11 languages.
- Right-to-left (RTL) layout support — none of the 11 SA languages require it.
- Sign Language (SASL) — visual medium, out of scope for text-based UI.

---

## 4. Architecture

### Locale resolution (no URL change)

```
User saves language preference
  → API writes language to DB (existing)
  → Response also sets: Set-Cookie: NEXT_LOCALE=zu; Path=/; SameSite=Lax; HttpOnly

Subsequent page loads:
  → next-intl's getRequestConfig reads NEXT_LOCALE cookie
  → Loads messages/zu.json
  → Root layout wraps children in NextIntlClientProvider
  → Server Components: getTranslations("namespace") → t("key")
  → Client Components: useTranslations("namespace") → t("key")
```

No middleware changes to `proxy.ts` are needed — the cookie is read by `i18n/request.ts` at the Next.js request level.

### New files

```
apps/web/
  i18n/
    request.ts              ← next-intl config entry point
  messages/
    en.json                 ← source of truth (~300 strings, Phase 1)
    zu.json                 ← isiZulu (auto-generated, human-correctable)
    xh.json                 ← isiXhosa
    af.json                 ← Afrikaans
    st.json                 ← Sesotho
    tn.json                 ← Setswana
    nso.json                ← Sepedi
    ts.json                 ← Xitsonga
    ss.json                 ← siSwati
    ve.json                 ← Tshivenda
    nr.json                 ← isiNdebele
  scripts/
    translate.ts            ← Claude API batch translation script
```

### Modified files

```
apps/web/
  next.config.mjs           ← wrap with createNextIntlPlugin
  app/layout.tsx            ← add NextIntlClientProvider
  app/api/settings/route.ts ← set NEXT_LOCALE cookie on language save
  (Phase 1 pages listed in §6)
```

---

## 5. Translation Files

### Key structure

`messages/en.json` is the single source of truth. Keys are namespaced by feature:

```json
{
  "nav": { ... },
  "dashboard": { ... },
  "auth": { ... },
  "settings": { ... },
  "assistant": { ... },
  "quiz": { ... },
  "onboarding": { ... },
  "errors": { ... },
  "common": { ... }
}
```

### Interpolation

next-intl uses ICU message syntax natively:
- Simple: `"welcome": "Welcome back, {name}"`
- Plural: `"streak": "{count, plural, one {# day streak} other {# day streak}}"`

### Translation script (`scripts/translate.ts`)

Behaviour:
1. Reads `messages/en.json`
2. For each target language code (zu, xh, af, st, tn, nso, ts, ss, ve, nr):
   a. Reads the existing target file (if any) to find already-translated keys
   b. Sends only untranslated keys to the Claude API (`claude-sonnet-4-6`)
   c. System prompt instructs: preserve `{placeholder}` markers exactly, use educational register appropriate for Grade R–12 students, keep the JSON structure identical
   d. Merges new translations with existing (never overwrites human-corrected keys)
   e. Writes the result to `messages/[code].json`
3. Logs a summary: X keys translated, Y skipped (already existed)

Usage:
```bash
ANTHROPIC_API_KEY=... npx tsx scripts/translate.ts
# Or re-run to fill only new keys added to en.json
npx tsx scripts/translate.ts
```

---

## 6. Phase 1 Scope — Pages and Components

The following are translated in this phase (in priority order):

| Priority | Target | Description |
|---|---|---|
| 1 | `app/layout.tsx` + `ShellLayout` | Navigation, shell chrome — affects every page |
| 2 | `app/page.tsx` | Landing / home page |
| 3 | `app/dashboard/page.tsx` + `DashboardHomeClient` | Main logged-in home |
| 4 | `app/auth/page.tsx` + auth components | Login, signup, error states |
| 5 | `app/settings/page.tsx` | Language/persona/privacy settings |
| 6 | `app/assistant/page.tsx` + assistant components | AI tutor UI |
| 7 | `app/daily-quiz/` pages | Daily quiz UI |
| 8 | `app/onboarding/` pages | First-run wizard |
| 9 | `error.tsx`, `global-error.tsx` | Error boundaries |
| 10 | `ProfileSidebarPanel`, `CookieConsentBanner`, `EmailVerificationBanner` | High-visibility shared components |

Phase 2 (separate sprint): bookstore, marketplace, past-papers, community, classes, learn, planner, and all remaining pages.

---

## 7. Cookie Behaviour

- **Name:** `NEXT_LOCALE`
- **Path:** `/` (applies to all routes)
- **Flags:** `HttpOnly; SameSite=Lax` — not `Secure` in development, `Secure` in production
- **Lifetime:** Session (cleared on browser close) is fine — the DB preference is the durable source. The cookie is just a performance cache to avoid a DB round-trip per page load.
- **Set by:** The `PUT /api/profile/me` response (or a dedicated `POST /api/settings/language` endpoint) adds a `Set-Cookie` header when `appPreferences.language` changes.
- **Fallback:** If no cookie, `i18n/request.ts` defaults to `"en"`.

---

## 8. Handling Missing Keys

If a translation key exists in `en.json` but not in `zu.json` (e.g., after a new feature adds strings), next-intl falls back to the English value automatically when configured with `onError: (error) => {}`. This means untranslated new strings silently render in English — acceptable for Phase 2 pages until the script is re-run.

---

## 9. Error Handling

- **Missing locale file:** next-intl throws at build time if a locale is registered but its message file is absent. All 11 files must exist (even if empty `{}`) before deploying.
- **Invalid interpolation:** next-intl throws in development if a `{placeholder}` is missing from a `t()` call. This surfaces issues early.
- **Script failure:** If the Claude API call fails for a language, the script logs the error and continues to the next language — a partial run is safe.

---

## 10. Testing

- Unit: test that `buildLanguageInstruction` (already exists) returns correct strings.
- Integration: add a test that loads `messages/en.json` and all 10 target files and verifies key counts match (catches script failures where a language file has fewer keys than English).
- Manual: log in, change language to isiZulu in settings, reload — verify UI strings change.

---

## 11. Rollout

1. Merge Phase 1 implementation to `main`.
2. Run `translate.ts` script locally to generate all language files.
3. Commit generated files — they are source-controlled so Vercel deploys them.
4. Monitor for `MISSING_MESSAGE` warnings in Sentry (next-intl emits these).
5. Invite mother-tongue speakers from the SCHOOL community to review and submit corrections via GitHub.

---

## 12. Out of Scope for This Spec

- Locale-aware number/date formatting (e.g. Afrikaans uses comma as decimal separator) — add later via next-intl's `<Number>` and `<DateTime>` components.
- Right-to-left layout.
- Translation memory / TM tools.
- Phase 2 pages.
