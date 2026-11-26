# Informed Consent — "Observational Silence v1"

**Study:** Observational Silence (AURA AI Laboratory × Mondli Manzi, NWU Psychology)
**Consent version:** `v1` · stored in `research_consents.consent_version` / `consent_scope`

> **Status: DRAFT for the NWU Research Ethics Committee (REC) and the supervisor of
> record. This is a starting template, not legal advice.** The wording, the
> incomplete-disclosure justification, retention periods and cross-border clauses
> must be reviewed and approved by the REC and an Information Officer before any
> data is collected. POPIA references are signposts for that review, not a
> compliance opinion.

---

## 0. The disclosure tension (read this first)

Inattentional blindness only works if the participant does **not** know an
unexpected event is coming. Telling them everything up front destroys the very
thing being measured. The accepted resolution is **authorised incomplete
disclosure with full debriefing**:

- The consent screen truthfully describes the study as being about *attention and
  counting* and the data we collect — but does **not** reveal the unexpected
  event.
- Immediately after the trial, a **debrief** reveals the true purpose, explains why
  it was withheld, and offers the participant a second, fully-informed chance to
  withdraw their data.

The REC must explicitly approve this incomplete disclosure. The schema records it:
`consent_scope.incompleteDisclosure = true`, `consent_scope.debriefProvided = true`.

---

## 1. Adult informed-consent screen (the UI copy, v1)

> ### About this study
> SCHOOL's Game Center is running a short research game with **AURA AI Laboratory**
> and a researcher from **North West University**. It studies how people pay
> attention while doing a counting task. It takes about **2–3 minutes**.
>
> ### What you'll do
> You'll watch a short animation and count how many times one group of shapes
> passes their token, then answer a few quick questions about what you saw.
>
> ### What we collect
> - Your answers and counts in the game
> - How quickly you respond (timing in milliseconds)
> - A coarse description of your device (screen size, browser family) — **never**
>   your full device fingerprint or IP address
>
> We do **not** collect special-category information (health, beliefs, etc.). Your
> responses are stored against a **pseudonymous research code**, not your name.
>
> ### How your data is used
> Your de-identified responses may be used in **academic research and
> publications**, and may be shared as a **de-identified open dataset** (e.g. on the
> Open Science Framework) so other researchers can verify the findings.
>
> ### Your rights
> - Taking part is **completely voluntary**. It will not affect your SCHOOL account,
>   marks, or anything else.
> - You can **stop at any time**, and you can **withdraw your data afterwards** from
>   your research settings — we'll delete it if analysis hasn't begun.
> - There is **no payment** and no direct benefit to you; the benefit is to science.
> - Risks are minimal (at most, mild frustration).
>
> ### Where your data is processed
> SCHOOL's servers may process your data **outside South Africa** (our hosting
> providers). We protect it with the same safeguards required under POPIA.
>
> ### Questions or complaints
> Contact the research team at **[research@ditshego-ventures.co.za]** or the NWU REC
> at **[REC contact / clearance no.]**.
>
> ☐ **I am 18 or older, I have read the above, and I agree to take part and to the
> use of my de-identified data as described.**
>
> [ I consent ]    [ Not now ]

## 2. Guardian consent (for participants under 18)

> ### Permission for your child to take part
> Your child uses SCHOOL, which is running a short attention research game (2–3
> minutes) with AURA AI Laboratory and a North West University researcher. We are
> asking your permission because your child is under 18 (POPIA requires a parent or
> guardian's consent to process a child's information).
>
> The game and the data collected are exactly as described in the participant
> information [link]. Participation is voluntary, there is no payment, risks are
> minimal, and data is stored against a pseudonymous code and used de-identified for
> research.
>
> ☐ **I am the parent/legal guardian of this child and I give permission for them to
> take part and for their de-identified data to be used as described.**

Wiring: guardian consent reuses `users.parental_consent_given_at` /
`users.parent_email`. The API blocks a minor from enrolling until that timestamp is
set (`412 guardian_consent_required`).

## 3. Child assent (simplified, shown to the minor)

> ### Want to play a quick attention game for science?
> You'll watch some shapes move and count how many times the teal ones pass to each
> other, then answer a few questions. It takes a couple of minutes. A grown-up has
> already said it's okay.
>
> You don't have to, and you can stop whenever you want — nothing happens to your
> account.
>
> [ Sure, let's play ]    [ No thanks ]

## 4. Debrief (shown immediately after the trial)

> ### Thanks — here's what this was really about
> This game studies **inattentional blindness**: how, when we focus hard on one
> task (counting the teal passes), we can completely miss something obvious — like
> the shape that crossed the screen. We didn't mention it beforehand because knowing
> about it would change what you notice, and that's exactly what we're measuring.
>
> Whether you spotted it or not is genuinely useful data — about half of people miss
> it, and that's the famous finding this builds on.
>
> You can still **withdraw your data** now if you'd prefer we didn't use it:
> [ Use my data ]    [ Withdraw my data ]

## 5. Withdrawal mechanics

- During a trial: leaving the page abandons the session (no completed record).
- After a trial (debrief or settings): calls
  `POST /research/consent/:consentId/withdraw`, which marks consent withdrawn and
  halts any in-progress sessions (see `db/research.ts`).
- A scheduled job should hard-delete withdrawn participants' rows **if analysis has
  not started**; after the dataset is locked for analysis, withdrawal removes
  identifiers but the de-identified record may be retained (state this in the
  consent and have the REC approve it).

## 6. Structured `consent_scope` (stored on grant)

```json
{
  "consentVersion": "v1",
  "study": "observational-silence-v1",
  "purposes": ["academic_research", "scientific_publication", "deidentified_open_data"],
  "dataCategories": ["gameplay_responses", "response_timing_ms", "self_report_answers", "coarse_device_info"],
  "specialCategory": false,
  "incompleteDisclosure": true,
  "debriefProvided": true,
  "voluntary": true,
  "compensation": "none",
  "crossBorderProcessing": true,
  "retention": "identifiable_until_account_deletion; deidentified_retained_post_lock",
  "withdrawal": "anytime; halts collection; pre-analysis records deleted on request",
  "minor": false,
  "guardianConsent": false
}
```

The web client sends this object as `scope` on `POST /research/:studyCode/consent`;
the minor/guardian fields are set server-side from the user's record.

## 7. POPIA checklist for the REC submission

- [ ] Responsible party + Information Officer named (AURA / Ditshego Ventures).
- [ ] Purpose specification matches `purposes` above; no further processing beyond it.
- [ ] Lawful basis = **consent** (adult) / **guardian consent** (minor, POPIA §34–35).
- [ ] Openness: participant information sheet provided (this document).
- [ ] Security safeguards: pseudonymisation, salted hashes, access controls.
- [ ] Cross-border transfer (POPIA §72) disclosed and justified.
- [ ] Data-subject participation: access + withdrawal routes implemented.
- [ ] Incomplete disclosure + debrief explicitly approved.
