# SCHOOL — Data Breach Notification Runbook

**Owner:** MK Ditshego (Information Officer)
**Contact:** privacy@ditshego-ventures.co.za · [Redacted for public repository — contact privacy@ditshego-ventures.co.za]
**Last updated:** 26 May 2026 (revised 2026-08-25 — hosting corrected to Vercel; Railway retired)
**Applies to:** DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL (Reg: 2026/349873/07)

---

## Quick Reference

| Action | Detail |
|---|---|
| Information Regulator (SA) | complaints@inforegulator.org.za · +27 10 023 5200 |
| POPIA §22 deadline | 72 hours from becoming aware |
| Platform infrastructure | Web: Vercel · API: Vercel (saedu-api-server) · DB: Supabase (PostgreSQL) |
| Email provider | Resend (notifications@school.ditshego-ventures.co.za) |
| Security contact (inbound) | privacy@ditshego-ventures.co.za |

---

## 1. What Is a Notifiable Breach?

A **reportable breach** under POPIA §22 occurs when personal information is accessed, acquired, used, or disclosed without authorisation, and there are reasonable grounds to believe it could cause harm to a data subject.

**Always notifiable:**
- Unauthorised access to the `users` table (email, phone, DOB, is_minor)
- Credential leak (password hashes, JWT secrets)
- Exposure of minor data (`is_minor = true`, `parent_email`, `parental_consent_given_at`)
- Database dump or bulk export without authorisation
- Ransomware or destructive attack on the database or file storage
- Compromised Resend API key (could allow sending from SCHOOL's domain)
- Compromised `PHONE_ENCRYPTION_KEY` (decrypts all stored phone numbers)
- Compromised `JWT_SECRET` (allows forging auth tokens)

**Assess case-by-case:**
- Single account takeover (report if minor account or if attacker accessed other users' data)
- Misconfigured API endpoint exposing limited data (assess by number of records and sensitivity)
- Log file containing PII exposed to an unintended party

**Not notifiable (document anyway):**
- Failed intrusion attempt with no data accessed
- Brute-force attack blocked by rate limiting with no successful logins
- Internal human error corrected before any external exposure

---

## 2. Severity Tiers

| Tier | Criteria | Response SLA |
|---|---|---|
| **P1 — Critical** | Minor data exposed; credential leak; bulk user data accessed; encryption key compromised | Contain within **1 hour**, notify regulator within **24 hours** |
| **P2 — High** | Single adult account compromised with data accessed; email provider key leaked; limited PII exposure | Contain within **4 hours**, notify regulator within **48 hours** |
| **P3 — Medium** | Potential exposure with no confirmed data access; misconfiguration discovered and corrected | Contain within **24 hours**, assess notification requirement |
| **P4 — Low** | Failed attack, no data accessed, no user impact | Document only; no notification required |

---

## 3. Phase 1 — Detect & Contain (0–4 hours)

### 3.1 Confirm the breach

Run these queries immediately to establish scope. Replace timestamps as needed.

**Check for unusual bulk reads on users table (Supabase psql):**
```sql
SELECT actor_id, action, COUNT(*) as count, MIN(created_at) as first, MAX(created_at) as last
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY actor_id, action
HAVING COUNT(*) > 50
ORDER BY count DESC;
```

**Check for logins from new IPs on a specific account:**
```sql
SELECT al.user_id, al.ip_address, al.created_at, al.action, al.metadata
FROM audit_log al
WHERE al.action IN ('auth.login', 'auth.register')
  AND al.created_at > NOW() - INTERVAL '48 hours'
ORDER BY al.created_at DESC
LIMIT 200;
```

**Check all actions for a suspected compromised user:**
```sql
SELECT action, ip_address, user_agent, created_at, metadata
FROM audit_log
WHERE user_id = '<USER_ID>'
   OR actor_id = '<USER_ID>'
ORDER BY created_at DESC
LIMIT 500;
```

**Identify minor accounts that may have been affected:**
```sql
SELECT id, email, first_name, last_name, parent_email,
       parental_consent_given_at, created_at, last_active_at
FROM users
WHERE is_minor = true
  AND id IN (
    SELECT DISTINCT user_id FROM audit_log
    WHERE created_at > NOW() - INTERVAL '48 hours'
      AND action NOT IN ('auth.login')
  );
```

**Count affected users by data category:**
```sql
SELECT
  COUNT(*) FILTER (WHERE is_minor = true)      AS minor_accounts_affected,
  COUNT(*) FILTER (WHERE is_minor = false)     AS adult_accounts_affected,
  COUNT(*) FILTER (WHERE phone_number IS NOT NULL) AS with_phone,
  COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL) AS with_dob,
  COUNT(*)                                     AS total
FROM users
WHERE id IN (
  /* replace with list of affected user IDs */
  SELECT DISTINCT user_id FROM audit_log
  WHERE created_at BETWEEN '<start>' AND '<end>'
);
```

### 3.2 Contain

**If database credentials are compromised:**
1. Rotate `DATABASE_URL` / Supabase connection string in Vercel environment variables immediately
2. Revoke the old credential in Supabase project settings
3. Restart/redeploy the API service

**If JWT_SECRET is compromised (all sessions forged):**
1. Rotate `JWT_SECRET` in Vercel environment variables
2. Redeploy API — all existing sessions are immediately invalidated
3. Users will be logged out and must re-authenticate

**If PHONE_ENCRYPTION_KEY is compromised:**
1. Rotate key and re-encrypt all phone numbers using `apps/web/scripts/encrypt-existing-phone-numbers.ts`
2. The old key must be retained temporarily for the re-encryption migration; delete after

**If Resend API key is compromised:**
1. Revoke the key in the Resend dashboard immediately
2. Issue a new key and update `RESEND_API_KEY` in Vercel
3. Check Resend send logs for unauthorised outbound emails

**If a Vercel environment variable is exposed:**
1. Rotate the affected secret in Vercel Project Settings → Environment Variables
2. Trigger a new production deployment to pick up the new value

### 3.3 Preserve evidence

Before rotating any credentials:
```bash
# Export audit log for the incident window to a local file
psql $DATABASE_URL -c "\COPY (
  SELECT * FROM audit_log
  WHERE created_at BETWEEN '<start>' AND NOW()
  ORDER BY created_at ASC
) TO '/tmp/incident-<DATE>-audit.csv' CSV HEADER;"
```

Store this file securely. It is your forensic record for the regulator.

---

## 4. Phase 2 — Assess & Notify (4–72 hours)

### 4.1 Assess harm potential

Before notifying, document:
- **What data was accessed?** (names, emails, phones, DOBs, minor flags, financial data)
- **How many data subjects?** (distinguish minors from adults)
- **What could an attacker do with it?** (identity theft, targeted phishing, minor exploitation)
- **Is the data already public elsewhere?** (reduces harm, may affect notification decision)
- **Is there an ongoing risk?** (if yes, accelerate timeline)

### 4.2 Notify the Information Regulator (POPIA §22)

**Required within 72 hours.** Use this template:

---

**TO:** complaints@inforegulator.org.za
**SUBJECT:** Data Breach Notification — DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL — [DATE]

Dear Information Regulator,

In terms of section 22 of the Protection of Personal Information Act 4 of 2013, DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL (Registration Number: 2026/349873/07) hereby notifies you of a data breach.

**1. Responsible Party**
DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL
[Redacted for public repository — contact privacy@ditshego-ventures.co.za]
Information Officer: MK Ditshego
Email: privacy@ditshego-ventures.co.za
Phone: [Redacted for public repository — contact privacy@ditshego-ventures.co.za]

**2. Nature of the breach**
[Describe what happened: e.g. "Unauthorised access to our user database via a compromised API credential, resulting in the exposure of personal information of approximately X data subjects."]

**3. Personal information involved**
[List the categories: e.g. "Full names, email addresses, hashed passwords, and phone numbers (AES-256-GCM encrypted). Approximately X records of which Y belong to minor data subjects (under 18)."]

**4. Approximate number of data subjects affected**
[Insert number. Break down adults vs minors.]

**5. Likely consequences**
[e.g. "Risk of phishing or identity theft targeting affected users. Elevated risk for minor data subjects."]

**6. Measures taken or proposed**
[e.g. "Affected credentials have been rotated. Affected users have been notified and advised to change passwords. We have engaged [forensic provider if any] to conduct a full investigation."]

**7. Date and time of discovery**
[Insert ISO timestamp: e.g. 2026-05-26T14:30:00+02:00]

**8. Date and time breach is believed to have begun**
[Insert or state "under investigation"]

Yours faithfully,
MK Ditshego
Information Officer — DITSHEGO VENTURES (Pty) Ltd

---

### 4.3 Notify affected data subjects (POPIA §22(3))

POPIA requires notifying affected individuals unless the regulator directs otherwise or it would compromise a criminal investigation.

**Email template — send via Resend to affected users:**

---

**SUBJECT:** Important security notice regarding your SCHOOL account

Dear [First Name],

We are writing to inform you of a security incident that may have affected your SCHOOL account.

**What happened**
[Brief plain-language description: e.g. "On [DATE], we discovered that an unauthorised party may have accessed a portion of our user database."]

**What information was involved**
[Be specific: e.g. "Your name, email address, and encrypted phone number may have been accessed. Your password was stored as a one-way hash and cannot be reversed."]

**What we have done**
- Secured the vulnerability and rotated all affected credentials
- Notified the Information Regulator of South Africa as required by law
- Launched an internal investigation

**What you should do**
1. Change your SCHOOL password at https://school.ditshego-ventures.co.za/settings
2. If you use the same password on other services, change it there too
3. Be alert to phishing emails claiming to be from SCHOOL — we will never ask for your password by email

**Your rights under POPIA**
You have the right to access your personal information, request correction, and lodge a complaint with the Information Regulator at complaints@inforegulator.org.za or +27 10 023 5200.

We sincerely apologise for this incident. If you have questions, contact us at privacy@ditshego-ventures.co.za.

DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL

---

**For minor data subjects**, send a separate email to the `parent_email` on their account using the same content, addressed to the parent/guardian.

---

## 5. Phase 3 — Post-Incident (72 hours+)

### 5.1 Internal incident record

Document in `docs/security/incidents/YYYY-MM-DD-<slug>.md`:

```
Date discovered:
Date of breach (estimated):
Discovered by:
Root cause:
Data categories affected:
Number of data subjects:
Minors affected (Y/N):
Containment actions taken:
Regulator notified (date/time):
Users notified (date/time):
External parties involved:
Total downtime (if any):
```

### 5.2 Root cause analysis

Within 7 days, answer:
1. How did the attacker gain access?
2. What controls failed or were absent?
3. What would have detected this sooner?
4. What changes prevent recurrence?

### 5.3 Remediation tracking

Open a GitHub issue tagged `security` with each remediation item. Close it only when deployed to production.

---

## 6. Data Map — What We Hold

| Category | Fields | Storage | Sensitivity |
|---|---|---|---|
| Identity | `first_name`, `last_name` | PostgreSQL plaintext | Medium |
| Contact | `email` | PostgreSQL plaintext | High |
| Contact | `phone_number` | PostgreSQL AES-256-GCM | High |
| Demographic | `date_of_birth`, `country`, `province`, `city` | PostgreSQL plaintext | Medium |
| Minor-specific | `is_minor`, `parent_email`, `parental_consent_given_at` | PostgreSQL plaintext | **Critical** |
| Credentials | `password_hash` (bcrypt, cost 12) | PostgreSQL | High |
| Sessions | JWT (httpOnly cookie), `saedu_session` / `saedu_csrf` | Client cookie | High |
| Audit | `audit_log` table | PostgreSQL | Medium |
| Financial | Wallet credit balance, transaction history | PostgreSQL | Medium |
| Payment | No card data held — payments via PayFast (PCI-DSS compliant) | N/A | N/A |

---

## 7. Key Contacts

| Role | Contact |
|---|---|
| Information Officer | MK Ditshego — privacy@ditshego-ventures.co.za — [Redacted for public repository — contact privacy@ditshego-ventures.co.za] |
| Information Regulator (SA) | complaints@inforegulator.org.za — +27 10 023 5200 |
| Vercel support | vercel.com/support |
| Supabase support | supabase.com/support |
| Resend support | resend.com/support |

---

## 8. Security Alias Setup (TODO)

Once `school.ditshego-ventures.co.za` DNS has propagated, add `security@school.ditshego-ventures.co.za` as a verified sending identity in Resend and as a receiving alias in your email host. Update this document and the Privacy Policy contact details accordingly.

---

*DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL · Registration: 2026/349873/07 · Last reviewed: 2026-08-25 (formally adopted)*
