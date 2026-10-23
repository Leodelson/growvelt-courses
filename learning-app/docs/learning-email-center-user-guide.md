# Growvelt Email Center, operator guide

Checked against the current Growvelt source and approved production release on 23 October 2026. This describes what exists now, not planned features. Provider prices and allowances can change; check the shared Resend Usage page before a release.

## The most important answers

Open [Growvelt Email Center](https://www.growvelt.com/learning/dashboard/admin/emails). It is Growvelt's own workspace and recipient database, not a link to Careers.

**Yes, the current release has a real 100-recipient limit per marketing campaign.** It is not a lifetime allowance or Resend's daily limit. It does not automatically divide a larger audience into batches. Entering 5,000 in an environment variable will not remove it: validation deliberately accepts only 1 to 100.

Growvelt can grow beyond 100 users, but this Email Center is not yet a tested 5,000-, 10,000- or 100,000-recipient sender. That needs a separate scaling release and appropriate provider plans. No subscription upgrade or increased cap was made in this email-styling release.

## Allowances: do not mix these up

| Limit | Applies to | Current boundary |
| --- | --- | --- |
| Growvelt campaign cap | One Email Center marketing campaign | At most 100 eligible accounts, exact reviewed list |
| Growvelt account/support selection | One genuine transactional Email Center message | 1 to 10 selected existing accounts; separate budget approval also required |
| Shared free marketing allowance | Resend contacts across Careers and Growvelt | Up to 1,000 contacts; broadcasts do not consume the transactional sending allowance |
| Shared free transactional allowance | API/SMTP account emails, including automatic security/auth/payment emails | 100/day and 3,000/month; inbound mail also counts |
| Email Center account/support budget | Only this manual transactional workflow | Zero by default; an approved short-lived allocation is required, bounded to 10/day and 100/month locally |

The provider's free daily transactional window resets at midnight UTC (1:00 AM Nigeria time). Marketing is contact-based rather than a per-message monthly pool. These are **shared team allowances**, not new allowances per sender address, API key, segment or product. See [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) and [broadcast versus transactional billing](https://resend.com/pricing).

Unsubscribed contacts still count toward the provider contact quota; see [Resend's contact explanation](https://www.resend.com/migrate/mailchimp). Do not delete and re-import people to evade limits or reset an unsubscribe.

The last activation check saw 592/1,000 shared contacts and three configured segments. That was a snapshot, **not a live balance**. Do not assume 408 free places remain today. Growvelt's preparation step checks the provider again and stops if usage or the complete audience cannot be verified. Other products can consume the shared allowance between checks.

## Who can send

Only the two confirmed operators, `nduleonardc@gmail.com` and `admin@growvelt.com`, with Growvelt administrator authorization, can use the server-side sending workflow. A normal learner, instructor, company administrator or another platform administrator does not gain this permission automatically. Credentials remain on the server.

## Sender cards

| Card | Configured sender | Appropriate use |
| --- | --- | --- |
| Growvelt | `no-reply@growvelt.com` | Growvelt updates and course news |
| Growvelt Support | `support@growvelt.com` | Support and account follow-up |
| Growvelt Admin | `admin@growvelt.com` | Official account/platform notices |
| Growvelt Partnerships | `partnership@growvelt.com` | Partnerships and collaborations |
| Growvelt No-reply | `no-reply@growvelt.com` | Notices where a reply is not expected |

Choosing a card changes the sender identity, not the available quota. It does not create a mailbox or import partnership inquiries. A message from Partnerships still needs the correct content classification and eligible recipients. Replies are not managed as an inbox inside Email Center.

## Email delivery: which mode should I choose?

**Announcement broadcast** is for newsletters, course promotions and broad Growvelt announcements. It uses Resend Broadcasts, requires explicit Growvelt marketing consent, and excludes globally unsubscribed contacts. Use this for promotional content even when sending to just one person. A partnership sales pitch is not automatically transactional.

**Account/support email** is only for a real account-specific service issue, such as an individual support resolution. It requires 1 to 10 selected existing accounts, a fresh operator approval and a separately approved quota allocation. That allocation was not enabled by the marketing release. Do not use this mode to bypass the broadcast cap, consent or the contact allowance.

Automatic login alerts, password resets, invitations and payment notifications run through their own workflows. They are not drafts you must send here, but their provider usage is part of the shared transactional allowance. Account/support preflight leaves more than 25 daily and 250 monthly emails of headroom; this is a safety check, not a guaranteed cross-product quota reservation. A growing stream of login alerts alone can eventually exceed the free plan.

## Recipient cards

| Audience | Meaning in marketing mode |
| --- | --- |
| All Growvelt users | Confirmed Growvelt accounts with recorded marketing consent, not everyone who registered |
| Learners | Eligible opted-in learner accounts |
| Approved instructors | Eligible opted-in instructors approved to teach |
| Organizations | Eligible opted-in active company owners and administrators, not every employee |
| Selected Growvelt accounts | Existing Growvelt email addresses or user IDs you enter, one per line |

Selected accounts are matched against Growvelt, deduplicated and checked. Unknown/external addresses are not an arbitrary mailing-list import. All current marketing consent checks still apply to a selected list. Organizations and Partnerships are different concepts: the sender card does not determine the audience.

The local recipient review is not the final provider audience. Preparation verifies existing Resend contacts and the exact Growvelt segment membership too. A missing contact blocks preparation; this release does **not** automatically import all signups, reuse Careers' audience or globally re-subscribe someone. A separately approved contact-onboarding/synchronization workflow is needed as the audience grows.

## Email content and preview

| Field/control | What it does |
| --- | --- |
| Subject | Inbox subject, 3 to 160 characters, one line |
| Email headline | Optional visible heading, up to 160 characters; leave blank for no body heading. The inbox subject is never inserted automatically |
| Message | 10 to 4,000 characters. Supports `**bold**`, `_italic_` and `- ` bullet lines. Raw HTML is escaped; images, video and attachments are not supported |
| Personalized greeting | Preview can show an example name. **Marketing broadcasts currently use “Hello there,”**, not each recipient's real name. Account/support rendering can use the reviewed name |
| Button text and link | Optional call-to-action; provide both or neither. Label up to 60 characters; HTTPS Growvelt links only |
| Send email | Email is the supported delivery channel |
| Bell / device push | Not activated in this Email Center. Do not promise a bell alert or push delivery from this form |
| Preview | Uses the shared server email renderer; refresh it after editing. It is not an exact simulation of every recipient's Gmail, Apple Mail or Zoho app |

The current button-link allowlist is `www.growvelt.com`, `growvelt.com`, `learn.growvelt.com`, `www.learn.growvelt.com` and `jobs.growvelt.com`. Arbitrary external links are rejected.

## The safe sending sequence

1. **New draft:** starts a separate message. Switching drafts/new draft prompts about unsaved edits. It does not delete historical deliveries.
2. Choose sender, mode and audience; write the content and optional button.
3. **Save draft:** saves manually to Growvelt and assigns a stable ID/revision. There is no automatic autosave. Saving is not sending.
4. **Refresh preview:** inspect the rendered heading, message, footer and button. Open/check the intended destination separately.
5. **Review recipients:** after saving, capture the eligible recipient snapshot. Inspect the count and exclusions.
6. **Check release recipients:** verify the exact addresses and saved content that this release would use. Stop if anybody unexpected is included.
7. For marketing, **Prepare provider draft (no send):** checks shared usage, existing contacts, suppressions and exact membership; reserves the Growvelt campaign slot and creates an **unsent** Resend broadcast. It can change membership only in Growvelt's reserved segment; Careers' segments are not repurposed. It does not import missing contacts.
8. **Approve exact release · 15 minutes:** read the confirmation and approve only this saved revision and exact list. This does not send yet. An expired approval must be renewed; changing content or the audience requires saving, reviewing and approving again.
9. **Confirm and send:** this is the real send operation. Re-read the final confirmation. Click once, then check the outcome/history. Do not create a replacement campaign just because the response is slow.
10. **Check delivery status:** check the existing provider operation until its state is verified. Provider acceptance or queueing is not delivery to every inbox.

Account/support mode does not prepare a marketing provider draft, but still requires the exact release review, short-lived approval and its own quota approval. If a button is unavailable, read the displayed prerequisite/error; do not switch modes to force it through.

Once a marketing campaign reserves the segment, another campaign cannot overwrite its audience while the outcome is pending. Finish reconciliation first. This prevents an in-flight broadcast from accidentally using somebody else's list.

## Saved drafts, history and recovery buttons

Saved drafts/reviews load their saved revision into the composer; the workspace shows a bounded recent list, not an unlimited searchable archive. Accepted/sent campaigns remain audit records. Use **New draft** for a genuinely new message, not repeated send attempts on the old one.

The delivery history shows local phase and provider status. `draft`/`reviewed` are not sent; `sending` or `needs_review` can require investigation; `accepted` only means the provider accepted the request. For broadcasts, `queued` is still in progress, and verified `sent`/`canceled` are terminal states. Delivery/bounce counts belong in the provider report, not an assumption based on a success toast.

**Check delivery status** reads/reconciles the existing broadcast. It does not recreate it, send another copy or clear uncertainty. A verified terminal state releases the campaign slot. If the provider outcome cannot be established, leave the operation locked and investigate its saved provider ID rather than blindly retrying.

**Cancel queued remainder** attempts to stop a verified still-queued broadcast, where the provider allows cancellation. It cannot recall emails already delivered. If cancellation is uncertain, reconcile again; do not assume nobody received it. Email, notification bells and push would be separate channels, not one atomic delivery transaction.

## Consent and unsubscribe behavior

Creating an account, buying a course, being an administrator or contacting Partnerships is not itself marketing consent. Use the user's recorded Growvelt preference. An opted-out person is not made eligible by entering their address manually.

Growvelt's local consent is checked again during the sending workflow. Provider global unsubscribe status is also respected. Because Careers and Growvelt use the same Resend team, a global Resend unsubscribe can affect both products: segments are not separate unsubscribe accounts. This release does not silently undo global opt-outs or provide automatic contact imports and delivery-webhook reconciliation.

## What happens at 5,000, 10,000 or 100,000 users?

Registered users and marketing contacts are different counts. Having 10,000 accounts does not permit 10,000 marketing contacts on the shared free plan. Paid marketing tiers are contact-based; paid transactional tiers cover the separate stream of security/auth/payment/support emails. Check the then-current [Resend plans](https://resend.com/pricing) before purchasing anything.

Before a larger audience release we must deliberately upgrade/test the application's hard cap, free-plan-specific quota validation, full audience pagination, contact onboarding/consent synchronization, durable work scheduling, shared-team rate/budget coordination, recovery and delivery reconciliation. A provider upgrade by itself does not make today's guarded code handle paid-plan values or 10,000 recipients.

For a legitimate audience above 100 but still within the shared free contact allowance, a reviewed campaign would need distinct, non-overlapping selected groups and separate terminal reconciliations; today's UI does not automate this. Do not repeatedly send “All users” assuming it advances to the next 100, and do not split lists to evade provider limits. Build the larger-campaign workflow before routinely operating at that scale.

## If something stops

- **No eligible recipients:** check confirmed Growvelt accounts and explicit marketing opt-in; do not infer consent.
- **Contact missing / globally unsubscribed:** stop. Review approved onboarding or consent status; do not force a resubscribe.
- **Too many recipients:** the current campaign cap is enforced; no email has been sent by that failed check.
- **Preview/review/approval stale:** save the intended revision, refresh, review and approve again.
- **Quota unavailable or account/support budget missing:** wait for verified headroom or request a bounded allocation. Do not change sender aliases or keys to bypass it.
- **Slow/unknown result:** preserve the draft/provider ID and use reconciliation. Never assume a timeout means “not sent.”
- **Emergency pause:** an operator can disable new releases while retaining recovery access and audit records. Do not delete campaigns, contacts or logs to clear an error.

## Checking the mobile email fix

The source now removes the light-only declaration that made the Gmail message surround white, and adds narrow-screen Gmail background/text compatibility without changing the desktop palette. This covers newly rendered Growvelt emails. Git deployment does not modify emails already received or the HTML already stored in an old provider draft.

For a real phone check, trigger one fresh login alert or intentionally send a newly prepared owner-only test. Inspect Gmail on iPhone in dark mode, including outer edges, logo, text and button; also check desktop. Browser previews cannot certify native Gmail/Zoho rendering. The 13 Supabase Auth template source files are prepared too, but their hosted Auth settings require a separate save; Git push does not publish those dashboard settings.

No checkout, payout or live-payment activation is implied by this work. Phase 6's tested framework patch remains the next roadmap item after this email review.
