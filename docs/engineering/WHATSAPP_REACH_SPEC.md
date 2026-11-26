# WhatsApp Reach Spec — Share-to-WhatsApp + Daily-Quiz Bot

Goal: reach the maximum number of SA learners at ~zero cost, leveraging the fact that
WhatsApp is used by **~96% of SA internet users (~29M)** and is the #1 favourite app
(23h42m/month). Two parts: (A) passive share (ships today, no backend) and (B) an
active daily-quiz bot (Meta Cloud API, free tier).

Both align with the FREE-tier discipline: no paid dependency, no new infra beyond a
webhook + one cron job.

---

## PART A — Share to WhatsApp (web, zero backend)

**Concept:** every lesson page, quiz result, and past-paper result gets a "Share on
WhatsApp" button that opens `https://wa.me/?text=<encoded message with deep link>`.
This turns each learner into a distributor inside class/family groups.

**Why it's the highest-leverage first move:**
- Pure client-side. No API, no webhook, no cost.
- Uses `wa.me` (official WhatsApp click-to-chat). Works on the web TWA and mobile web.
- Viral within existing groups (the dominant SA comms channel).

**Implementation (web app):**
1. Create `apps/web/components/ShareWhatsApp.tsx` (client component):
   ```tsx
   "use client";
   export function ShareWhatsApp({ title, url, message }: { title: string; url: string; message?: string }) {
     const text = encodeURIComponent(`${message ?? "Check this SCHOOL lesson:"} ${title} ${url}`);
     const href = `https://wa.me/?text=${text}`;
     return <a href={href} target="_blank" rel="noopener" className="share-wa">Share on WhatsApp</a>;
   }
   ```
2. Mount it on:
   - `apps/web/app/learn/[phase]/[grade]/[subject]/.../page.tsx` (lesson results)
   - `apps/web/app/daily-quiz/page.tsx` (after submit → QuizSubmitResponse: share score + streak)
   - `apps/web/app/past-papers/...` (result cards)
3. Deep-link target: use the language-aware lesson URL (we already set the
   `LESSON_LANGUAGE` cookie + selector) so the shared link opens in the recipient's
   language where available.
4. Tracking (optional, cheap): append `?ref=whatsapp` to the shared URL and count
   installs/signups from that param in `apps/api/src/lib/metrics/registry.ts`.

**Done when:** button renders on the 3 surfaces; link opens WhatsApp with pre-filled text.

---

## PART B — Daily-Quiz WhatsApp Bot (Meta Cloud API, free tier)

**Concept:** learners opt in (SMS/QR/on-site) with their phone number → each day the bot
sends today's quiz question(s), they reply with answers, the bot scores them and replies
with the explanation + streak. Reuses the **existing quiz generation** and the
**existing outbound-message precedent** (`apps/api/src/routes/messages.ts` has
`assignment-reminders` + `weekly-snapshot`; `apps/api/src/lib/assignmentReminders.ts`
shows the digest pattern).

**Why Meta Cloud API (not Twilio/360Dialog):**
- Free tier: 1,000 free business-initiated conversations/month, then ~$0.005–0.03/convo.
  No fixed cost → fits FREE-tier discipline.
- Official, no third-party broker. Webhook-based.

### Architecture (new files)
```
apps/api/src/routes/whatsapp.ts          # webhook: GET verify + POST inbound messages
apps/api/src/lib/whatsapp/
    client.ts        # Meta Graph API send helper (fetch, no SDK needed)
    quizAdapter.ts   # maps existing quiz logic -> a WhatsApp session
    sessionStore.ts  # per-phone state (awaiting answer, current quizId, streak)
apps/api/src/cron/whatsappDailyPush.ts   # called by Vercel Cron / external cron
apps/web/app/api/whatsapp/webhook/route.ts  # Next route wrapper (or put in Fastify)
```

### Data flow
1. **Opt-in:** learner sends "JOIN" to the WhatsApp number (or scans a QR on the web app
   → `wa.me/<number>?text=JOIN`). `whatsapp.ts` inbound handler stores phone + links to
   optional account.
2. **Daily push (cron, ~07:00 SA time):** `whatsappDailyPush.ts` iterates opted-in phones,
   calls the existing quiz generator (the same source `apps/web/app/daily-quiz/page.tsx`
   uses — centralise it in `apps/api/src/lib/profile-preferences.ts` or a new
   `getDailyQuiz(userId)` if not already shared), and `client.ts` sends the question via
   Meta Graph API.
3. **Inbound answer:** learner replies → `whatsapp.ts` POST → `quizAdapter.ts` validates
   against stored `quizId` → scores → replies with correctness + `correctAnswer` +
   `explanation` (the same fields `QuizSubmitResponse` already returns) + updated streak.
4. **Streak/engagement:** reuse the streak logic already in `daily-quiz`. Store streak in
   the existing user profile / a small `whatsapp_sessions` table.

### Wiring to existing code (reuse, don't rebuild)
- Quiz content: the existing `QuizQuestion` / `QuizSubmitResponse` shapes (see
  `apps/web/app/daily-quiz/page.tsx`) are exactly what the bot sends/receives. If the
  generator currently lives only in the web client, **extract it into
  `apps/api/src/lib/quiz.ts`** so both web and bot share it (single source of truth).
- Outbound precedent: mirror the pattern in `apps/api/src/lib/assignmentReminders.ts`
  (scheduled digest → send). The bot push is the same shape.
- POPIA: opt-in must be explicit + revocable ("STOP"). Store consent timestamp. This is
  required and we already have PAIA/POPIA docs — cite them in the privacy notice the bot
  sends on JOIN.

### Free-tier cost model
- 1,000 free business-initiated convos/month (Meta free tier).
- User-initiated (replies) are free.
- Beyond free tier: ~R0.05–0.50/convo. At 10k learners doing 1 quiz/day, worst case
  ~R5k/mo — but start on free tier; scale only if retention proves out.

### MVP scope (build order)
1. `client.ts` (send text via Graph API using `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`).
2. `whatsapp.ts` webhook (verify token + echo inbound to logs).
3. Manually send one quiz to your own number → confirm delivery.
4. `quizAdapter.ts` + session store → answer scoring.
5. `whatsappDailyPush.ts` + Vercel Cron (`vercel.json` cron job) → daily 07:00 push.
6. Opt-in UI (QR + "JOIN" handler) on web app.
7. POPIA consent + STOP handler.

---

## Success metrics (cheap to track)
- Share CTR: `?ref=whatsapp` installs from Part A.
- Bot: opt-ins, daily active quiz-takers, reply rate, streak retention (D7/D30).
- Cost: conversations/month vs Meta free-tier cap.

## Risks / guardrails
- **POPIA:** explicit opt-in, revocable, consent logged. No learner data sold/shared.
- **Spam:** cap to 1 message/day; honour STOP instantly.
- **Token safety:** `WHATSAPP_TOKEN` is a secret → env only, never logged/committed
  (matches our no-credentials rule). Same discipline as the Vercel token handling.

## Relation to other reach levers
- Part A is the immediate, free, ship-today win.
- Part B compounds it: every bot quiz result carries a "Share your streak" CTA (Part A).
- Both feed the zero-rating application (operators want evidence of educational value +
  compliance — our PAIA/POPIA docs already provide this).
