---
title: Google Workspace Email Migration Runbook - pixelatedempathy.com
category: runbook
tags:
  - strategy
  - email
  - google-workspace
  - dns
  - confidential
status: published
authorId: 00000000-0000-0000-0000-000000000000
version: 1.0
priority: critical
---

# Google Workspace Email Migration Runbook - pixelatedempathy.com

User-executed procedure for moving mail on `pixelatedempathy.com` from
Cloudflare Email Routing to Google Workspace. **This cutover is executed by the
user (Chad Coburn), not by any agent or automation.** No agent performs DNS
changes, account creation, or admin-console actions at any point; this document
is the complete script the user follows. It is the companion runbook referenced
by `10-google-cloud-startup-program-application.md` (action A2) and is written
so it can be executed end to end without further research.

Facts specific to our current state (verified 2026-10-22):

- Domain: `pixelatedempathy.com` (also the application domain for the Google
  for Startups Cloud Program).
- DNS is hosted on Cloudflare (the domain is on Cloudflare, with the website
  fronted by Cloudflare → Vercel). All record changes below happen in the
  Cloudflare DNS dashboard.
- Inbound mail currently uses **Cloudflare Email Routing** (MX records point
  to `route-1.mx.cloudflare.net` and sibling `route-*.mx.cloudflare.net`
  hosts).
- SPF currently includes `_spf.mx.cloudflare.net`.
- Outbound mail currently flows through a **Resend** sending token (see
  Section 12 for how Resend is handled after the migration).
- The Cloud Identity organization for `pixelatedempathy.com` already exists
  (org ID **334502034583**) — no new organization setup is needed.

## 1. Why this migration, and when

Two goals, in this order:

1. **Business email matching the application domain.** The Google for Startups
   application requires a business email on `pixelatedempathy.com`. Mail must
   run on Google Workspace so the application and day-to-day email both use
   the same Google infrastructure the program reviews.
2. **The Workspace benefit.** The Start tier includes 12 months of Google
   Workspace Business Plus.

**The cutover itself is user-executed.** Everything in Sections 3–14 is done
by the user in the Cloudflare dashboard, the Google Admin console, and a
terminal. Agents do not touch DNS, email routing, or the Admin console.

## 2. Preconditions

Verify every item before starting. Do not begin the cutover with an unchecked
box.

| #   | Precondition                                                                                                                                                                                                                                                                                                                                     | How to check                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | You can log in to the Cloudflare dashboard with administrative access to the `pixelatedempathy.com` zone (DNS + Email).                                                                                                                                                                                                                          | Sign in at dash.cloudflare.com and open the zone.                                                                                                                                  |
| P2  | The Cloud Identity organization for `pixelatedempathy.com` already exists (org ID `334502034583`).                                                                                                                                                                                                                                               | Sign in at admin.google.com with the existing Cloud Identity admin account. If you can see the Admin console for the domain, the org exists — no new organization setup is needed. |
| P3  | **The 31-day rule:** no _paid_ Google Workspace subscription may exist within **31 days** before submitting the program application. Check your Workspace billing history in the Admin console (Billing → Subscription) — if a paid subscription was ever active, the application must be scheduled at least 31 days after any paid period ends. | Admin console → Billing. See Section 3 for the sequencing plan.                                                                                                                    |
| P4  | The mailboxes that must survive the migration are known. At minimum: `chad@pixelatedempathy.com` (the GCP billing administrator identity) and `info@pixelatedempathy.com` (the public contact address — it stays the public contact address after the migration). List any other addresses currently routed by Cloudflare Email Routing.         | Cloudflare dashboard → the zone → Email → Email Routing → Routing rules. Every custom address and the catch-all listed there is a mailbox to recreate in Workspace (Section 6).    |
| P5  | A rollback snapshot of the current DNS state exists (Section 4).                                                                                                                                                                                                                                                                                 | The capture commands in Section 4 have been run and the output saved.                                                                                                              |
| P6  | A terminal with `dig` or `nslookup` available for verification.                                                                                                                                                                                                                                                                                  | `which dig` or `which nslookup`.                                                                                                                                                   |

**P3 is a hard rule, not advice.** Applying while a paid Workspace
subscription was active within the previous 31 days disqualifies the
application.

## 3. Sequencing relative to the program application

The 31-day rule and the migration interact, so the order matters:

1. **Start the Workspace signup on the free trial path** (Section 6). While
   the account is in its trial period there is no _paid_ subscription, so the
   31-day window stays clean.
2. **Complete the cutover** (Sections 7–11). Business email on the domain is
   live on Google infrastructure from this point.
3. **Submit the application while still in the trial period, before any paid
   billing begins.** This satisfies both requirements simultaneously: the
   business email matches the domain, and no paid Workspace subscription
   exists in the 31 days before applying.
4. **If the trial converts to paid before you submit** (e.g., the trial ended
   and billing started), do not submit. Let the paid period end (or cancel the
   subscription), then wait at least **31 days** from the end of the last paid
   period before applying. The email keeps working either way; only the
   application timing is affected.

If at signup Google offers to start paid billing immediately (rather than a
trial), choose the trial option; if no trial is offered, coordinate the signup
and application dates with the 31-day rule in mind before spending anything.
Confirm the current trial and billing terms in the Admin console at signup —
do not rely on memory or this document for Google's current offer details.

## 4. Pre-flight: capture the rollback snapshot

Before changing anything, record the current state. This snapshot is the
rollback source (Section 14) and the "before" picture for verification.

Run each command and save the output to a file (e.g., a `cutover-notes/`
document on your own machine — do not paste record contents into shared
repos):

```bash
dig MX pixelatedempathy.com +short
dig TXT pixelatedempathy.com +short
dig TXT _dmarc.pixelatedempathy.com +short
dig TXT google._domainkey.pixelatedempathy.com +short
```

And the `nslookup` equivalents (if you prefer nslookup):

```bash
nslookup -type=MX pixelatedempathy.com
nslookup -type=TXT pixelatedempathy.com
nslookup -type=TXT _dmarc.pixelatedempathy.com
```

Expected current-state picture (the rollback baseline):

- **MX:** `route-1.mx.cloudflare.net` plus the sibling `route-*.mx.cloudflare.net`
  entries.
- **TXT (SPF):** a `v=spf1` record that includes `_spf.mx.cloudflare.net` and
  possibly an include for the Resend sender.
- **DMARC:** a `_dmarc` TXT record (or none — record what you find either way).

Also open the Cloudflare zone → Email → Email Routing and screenshot/record
the existing routing rules and the catch-all configuration. **Do not delete
any Cloudflare routing rule yet** — the rollback plan depends on them being
preserved until the cutover is verified.

## 5. Lower the TTLs (timing preparation)

Cutover safety is a TTL problem: DNS resolvers cache records for the TTL
duration, so old MX entries keep sending mail to Cloudflare for up to one
TTL after you switch.

1. **At least a few hours before the cutover** (a full day is safer), set the
   TTL on every record you will change — the MX records and the domain TXT
   (SPF) — to **300 seconds (5 minutes)**. In Cloudflare's DNS editor, the
   TTL field offers "Auto" and numeric values; choose 5 minutes explicitly.
2. **Wait out the old TTL** before cutting over: the effective wait is the
   _previous_ TTL of those records (if they were on Auto/3600s, wait at least
   1 hour after lowering). This ensures every resolver is holding the short
   TTL, not the old long one.
3. Pick a cutover window when no email is expected that you cannot afford to
   risk (late evening or weekend works for a founder-run domain).
4. **After the cutover is verified** (Section 13), restore the TTLs to
   Cloudflare's "Auto" default.

## 6. Prepare Google Workspace

All of this happens in the Google Admin console at admin.google.com, signed in
with the existing Cloud Identity admin for `pixelatedempathy.com`.

1. **Sign up for Google Workspace (Business Plus) for `pixelatedempathy.com`.**
   Because the Cloud Identity organization (org ID `334502034583`) already
   exists, start from the _existing_ admin account and add the Workspace
   subscription from within the Admin console rather than creating a fresh
   organization — attempting a brand-new signup for an already-claimed domain
   will fail with a "domain already in use" error. If the Admin console asks
   for a domain-verification TXT record, add it in Cloudflare DNS (the domain
   may already be verified via the existing org; add the record only if asked).
2. **Choose the free-trial billing path** per Section 3 so no paid
   subscription exists before the application is submitted.
3. **Create the user accounts** from the P4 list. At minimum:
   - `chad@pixelatedempathy.com` — the primary/admin user (this identity is
     the GCP billing administrator and the program-application identity).
   - `info@pixelatedempathy.com` — the public contact address.
   - Any other addresses from the Cloudflare Email Routing rules (P4).
     Note: Workspace may seed some addresses (e.g., the admin identity) during
     signup; create the rest.
4. **Migrate or forward existing mail as needed.** Cloudflare Email Routing
   forwards messages to destination inboxes (e.g., a personal Gmail). It does
   not store mail on the domain. If specific old forwarded messages matter,
   forward them manually or leave the forwarding destinations intact as
   personal inboxes; Workspace starts with a clean mailbox. Existing mail in
   the forwarding destinations is unaffected by this migration.
5. **Add the forwarding destinations (if any) as verified recipients** in
   Workspace if you set up any catch-all forwarding for the transition period
   — Workspace catch-all forwarding requires the destination to be a verified
   address.

Do not switch any MX records yet. Workspace works fine unverified for MX
until Section 8 flips delivery.

## 7. Disable Cloudflare Email Routing (inbound stops forwarding)

Disabling must happen **before** switching MX, so no mail is delivered to a
routing layer that is being decommissioned while the new one takes over.

1. Open Cloudflare dashboard → `pixelatedempathy.com` zone → **Email →
   Email Routing**.
2. **Disable** the Email Routing configuration (the toggle/control on that
   page). Confirm when prompted. This stops Cloudflare from routing mail and
   removes the auto-generated MX and SPF-related records it created. **Do not
   delete the routing rules** — leave the configured addresses and catch-all
   intact so they can be re-enabled for rollback.
3. Check **DNS → Records** for any leftovers: MX records pointing to
   `route-*.mx.cloudflare.net` and a TXT record containing
   `_spf.mx.cloudflare.net`. If Cloudflare did not remove them, delete them
   manually now (they are Cloudflare-routing artifacts, not general DNS
   records you need).
4. If the routing rules themselves offer a disable state distinct from
   deletion, keep the rules in the disabled (not deleted) state.

After this step the domain has **no** MX records (or only ones you have
already deleted) — that is the intended intermediate state; inbound mail
bounces for the minutes until Section 8 completes. That is why TTLs were
lowered and the window was chosen in Section 5.

## 8. Switch the MX records to Google

In Cloudflare DNS → Records, add exactly these five MX records (delete any
other MX records first — Google requires being the only mail exchanger):

| Type | Name                            | Mail server               | Priority | TTL |
| ---- | ------------------------------- | ------------------------- | -------- | --- |
| MX   | `@` (or `pixelatedempathy.com`) | `aspmx.l.google.com`      | 1        | 300 |
| MX   | `@` (or `pixelatedempathy.com`) | `alt1.aspmx.l.google.com` | 5        | 300 |
| MX   | `@` (or `pixelatedempathy.com`) | `alt2.aspmx.l.google.com` | 5        | 300 |
| MX   | `@` (or `pixelatedempathy.com`) | `alt3.aspmx.l.google.com` | 10       | 300 |
| MX   | `@` (or `pixelatedempathy.com`) | `alt4.aspmx.l.google.com` | 10       | 300 |

In Cloudflare's MX editor, the "Name" field is typically `@` for the domain
root, and the record content is `mailserver priority` combined (e.g.,
`aspmx.l.google.com 1`); use the editor's separate priority field if it
provides one. **Content must be the bare hostname — no trailing dot, no IP.**

Verification that the switch has propagated is in Section 12.

## 9. SPF (sender authorization for outbound mail)

Replace the Cloudflare routing SPF include with Google's. In Cloudflare DNS →
Records, find the TXT record for `@` (the root domain) that starts with
`v=spf1` and update it.

- **Remove:** `include:_spf.mx.cloudflare.net`
- **Add:** `include:_spf.google.com`
- **Keep:** any Resend include that Section 4's snapshot showed in the record
  (see Section 12), and keep any other includes you captured.

The target record, assuming only Google and Resend are needed, is:

```
v=spf1 include:_spf.google.com include:<resend-include-from-snapshot> ~all
```

If Resend is not represented in the snapshot's SPF record (or you stop using
Resend for this domain entirely), the minimal record is:

```
v=spf1 include:_spf.google.com ~all
```

Notes:

- Google allows `~all` or `-all`; `~all` (soft fail) is the safe default while
  you verify, and `-all` (hard fail) can come later once every legitimate
  sender is confirmed.
- **Never keep both** `_spf.mx.cloudflare.net` and the Resend/Google includes
  in a way that leaves a stale include — a stale include is harmless but
  messy; a missing active include causes outbound mail to be rejected.
- If the snapshot showed a single SPF record that exceeded DNS's 255-character
  TXT limit or used the SPF "redirect" pattern, mirror exactly what the
  snapshot had and only swap the Cloudflare include for Google's.

## 10. DKIM (signed outbound mail)

DKIM signs outbound Gmail messages so receivers can verify they were sent by
the domain. This is configured in the Google Admin console, then published as
one TXT record in Cloudflare DNS.

1. In the Admin console: **Apps → Google Workspace → Gmail → Authenticate
   email** (some console versions label this "Configure DKIM email signing").
2. Select the domain `pixelatedempathy.com`.
3. **Generate a new record** with the default settings — key length **2048
   bits**, selector prefix `google` (the defaults). This produces a long TXT
   value and a record name.
4. In Cloudflare DNS → Records, add a **TXT** record:
   - **Name:** `google._domainkey` (Cloudflare will store it as
     `google._domainkey.pixelatedempathy.com`).
   - **Content:** the exact TXT value from the Admin console (the long
     `v=DKIM1; k=rsa; p=MIIBIjANBgkqh...` string). Copy it whole — do not
     truncate or reformat. If the console shows the value quoted, paste the
     inner content.
5. Back in the Admin console, click **Activate** (or "Start authentication")
   to turn signing on for the domain.
6. If the console reports DKIM not yet detected, wait a few minutes and retry
   — it needs DNS to propagate (another reason the TTL is 300).

## 11. DMARC (policy for unauthenticated mail)

DMARC tells receivers what to do with mail that fails SPF/DKIM. Add one TXT
record in Cloudflare DNS:

- **Name:** `_dmarc`
- **Content (start here):**

```
v=DMARC1; p=none; rua=mailto:chad@pixelatedempathy.com
```

Rationale and escalation path:

- Start with `p=none` (monitor-only) so reports flow without affecting
  delivery while you confirm SPF/DKIM pass on real mail.
- After a monitoring period with clean reports (a week or two of real mail),
  escalate to `p=quarantine`, and later `p=reject`, e.g.
  `v=DMARC1; p=quarantine; rua=mailto:chad@pixelatedempathy.com`. Escalation
  is a user decision made on the reports; nothing in this migration requires
  it on day one.
- If Section 4's snapshot showed an existing `_dmarc` record, preserve its
  `rua` reporting address and policy unless you are intentionally changing
  the policy; the new record above replaces it only if none existed.

## 12. Outbound mail and the Resend note

Current state: outbound mail for the domain flows through a **Resend** token
(the app's transactional sends). The migration changes how _human_ mail is
sent — Gmail becomes the primary outbound path — and touches Resend in two
specific ways:

1. **Keep Resend working if it stays in use.** If the application continues to
   send transactional mail through Resend after the cutover:
   - Preserve Resend's SPF include in the domain SPF record (Section 9) —
     take the exact include string from the Section 4 snapshot rather than
     guessing it.
   - Leave Resend's DKIM record untouched. Resend manages its own DKIM keys
     under its own selector; the Google DKIM record added in Section 10 is a
     separate selector (`google._domainkey`) and they coexist.
2. **If Resend is no longer needed for this domain**, remove its SPF include
   from the record at your next cleanup pass and let the DKIM record age out.
   Do not remove Resend's records in the same window as the cutover unless
   the app's sending path has already been confirmed independent of it.

Either way: **no Resend credentials, tokens, or API keys appear in this
runbook or in any changed record's documentation.** Resend keys live only in
the app's environment configuration; this runbook concerns DNS only.

After the migration, mail sent from Gmail accounts on the domain (e.g.,
`info@`, `chad@`) is authorized by `include:_spf.google.com` and signed with
the `google._domainkey` DKIM key. Test this specifically in Section 13.

## 13. Verification

Run these from a terminal. Each command and the expected result is listed.
Wait for DNS propagation between changes — with a 300-second TTL, records
should appear within minutes; allow up to ~15 minutes before debugging.

### 13.1 DNS records

```bash
dig MX pixelatedempathy.com +short
```

Expected — exactly these five lines and nothing else:

```
1 aspmx.l.google.com.
5 alt1.aspmx.l.google.com.
5 alt2.aspmx.l.google.com.
10 alt3.aspmx.l.google.com.
10 alt4.aspmx.l.google.com.
```

(No `route-*.mx.cloudflare.net` entries remain.)

```bash
dig TXT pixelatedempathy.com +short
```

Expected — a `v=spf1` record containing `include:_spf.google.com`, no
`_spf.mx.cloudflare.net`, plus the preserved Resend include if applicable.

```bash
dig TXT google._domainkey.pixelatedempathy.com +short
```

Expected — the long `v=DKIM1; k=rsa; p=...` record from Section 10.

```bash
dig TXT _dmarc.pixelatedempathy.com +short
```

Expected — the `v=DMARC1; ...` record from Section 11.

### 13.2 nslookup equivalents

If `dig` is unavailable, `nslookup` shows the same records:

```bash
nslookup -type=MX pixelatedempathy.com
nslookup -type=TXT pixelatedempathy.com
nslookup -type=TXT google._domainkey.pixelatedempathy.com
nslookup -type=TXT _dmarc.pixelatedempathy.com
```

The MX answer must list the five Google hosts with priorities 1/5/5/10/10; if
it still shows `route-*.mx.cloudflare.net`, propagation is incomplete or a
stale record was missed.

### 13.3 End-to-end mail tests

DNS correctness is necessary but not sufficient — prove mail actually flows:

1. **Inbound:** from a personal external address, send a message to
   `info@pixelatedempathy.com` and to `chad@pixelatedempathy.com`. Both must
   arrive in the corresponding Workspace inboxes within minutes.
2. **Outbound:** from `info@pixelatedempathy.com` in Gmail, send to an
   external address (e.g., your personal inbox).
3. **Authentication headers:** in the receiving Gmail, open the message and
   use **"Show original"** (three-dot menu). The header block must show:
   - `SPF: PASS` (for Gmail-sent mail — the sending IP is authorized by
     `include:_spf.google.com`)
   - `DKIM: PASS` with domain `pixelatedempathy.com` (signed by the
     `google._domainkey` key)
   - `DMARC: PASS`
4. **Resend path (if Resend remains in use):** trigger one transactional send
   from the application and confirm it still delivers; repeat the
   "Show original" check on it — Resend's own SPF/DKIM must still pass.

If any "Show original" check shows `SPF: FAIL`/`DKIM: FAIL` for Gmail-sent
mail, re-check Sections 9–10 records with `dig`; if inbound mail bounces, see
Section 14.

## 14. Rollback plan

Use this if inbound or outbound mail is broken after the cutover and cannot
be fixed quickly. The rollback restores the pre-migration state from the
Section 4 snapshot. **The rollback window is limited:** it works as long as
the Cloudflare Email Routing rules still exist (they were disabled, not
deleted, in Section 7). Do not delete those rules until the cutover has been
verified and you have decided to commit to it.

### 14.1 Rollback steps (in order)

1. **Re-enable Cloudflare Email Routing.** Cloudflare dashboard → zone →
   Email → Email Routing → re-enable it. Because the routing rules were
   preserved, the previous custom addresses and catch-all resume working.
2. **Restore the MX records.** Delete the five Google MX records and
   re-create the Cloudflare-routing MX entries from the Section 4 snapshot
   (the `route-*.mx.cloudflare.net` set; re-enabling Email Routing in step 1
   may re-add them automatically — check and reconcile against the snapshot).
3. **Restore the SPF record.** Re-edit the root-domain TXT: remove
   `include:_spf.google.com`, restore `include:_spf.mx.cloudflare.net`, keep
   everything else from the snapshot (including the Resend include).
4. **DKIM/DMARC: leave them.** The `google._domainkey` DKIM record and the
   `_dmarc` record are harmless in the rolled-back state (no Gmail signing is
   active; DMARC monitors only). Removing them is optional cleanup.
5. **Verify rollback with dig:** `dig MX pixelatedempathy.com +short` must
   show the `route-*.mx.cloudflare.net` set again, and the SPF TXT must match
   the snapshot.
6. **Test mail end to end:** send one inbound and one outbound message as in
   Section 13.3 and confirm delivery.

### 14.2 If the rollback also fails

If mail is broken in both the new and rolled-back configurations, the likely
cause is DNS propagation (resolvers still caching an intermediate state).
Wait one full old-TTL cycle (e.g., 1 hour if the original TTL was 3600),
re-run the `dig` checks from a fresh resolver (or use `dig @1.1.1.1 ...` to
query a specific resolver), and retest. Do not make further record changes
while propagation is in flight — that resets the wait.

### 14.3 Committing to the new state

Once Section 13 verification passes completely and mail has flowed correctly
for at least a full day:

1. Restore the TTLs on MX and SPF records to Cloudflare "Auto" (Section 5).
2. Delete the preserved Cloudflare Email Routing rules permanently (they are
   now dead weight; re-enabling later would fight the Google MX records).
3. Record the completion date and the final record values in your own notes
   (not in any shared repository).

## 15. Completion checklist

The migration is complete when every line is checked:

- [ ] Section 2 preconditions all verified before starting (P1–P6).
- [ ] Rollback snapshot captured (Section 4) and Cloudflare routing rules
      preserved until verification.
- [ ] TTLs lowered to 300s before the cutover and restored after (Sections 5
      and 14.3).
- [ ] Cloudflare Email Routing disabled before the MX switch (Section 7).
- [ ] MX records are exactly the five Google hosts: `aspmx.l.google.com` (1),
      `alt1.aspmx.l.google.com` (5), `alt2.aspmx.l.google.com` (5),
      `alt3.aspmx.l.google.com` (10), `alt4.aspmx.l.google.com` (10).
- [ ] SPF record includes `_spf.google.com` and no longer references
      `_spf.mx.cloudflare.net` (Section 9); Resend include handled per
      Section 12.
- [ ] DKIM record `google._domainkey` published and signing activated
      (Section 10).
- [ ] DMARC record published starting at `p=none` (Section 11).
- [ ] `dig`/`nslookup` verification outputs match Section 13.1/13.2.
- [ ] End-to-end tests pass: inbound delivery to `info@` and `chad@`, Gmail
      outbound with SPF/DKIM/DMARC all PASS in "Show original" (Section 13.3).
- [ ] Mail flowed correctly for a full day; Cloudflare routing rules then
      deleted permanently (Section 14.3).
- [ ] No paid Workspace subscription activated before the program application
      is submitted (Section 3); the 31-day rule is satisfied.
- [ ] No credentials, tokens, or secrets were written into DNS records,
      notes, or repositories during the migration.

When the checklist is complete, the business email on `pixelatedempathy.com`
runs on Google Workspace, the domain prerequisite for the program application
is satisfied, and the remaining application steps continue per
`10-google-cloud-startup-program-application.md` (Section 9, actions A2/A3).
