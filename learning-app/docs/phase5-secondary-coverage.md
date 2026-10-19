# Phase 5 — secondary pages and learning flows, 19 October 2026

## Coverage and changes

The remaining-page inventory in `phase5-earnings-and-coverage.md` was reviewed against the current source.

| Surface | Result |
| --- | --- |
| `/company-learning` | Replaced obsolete future-phase copy with the implemented assignment/progress/reporting workflow. Added responsive setup steps and expandable answers about seats, paid access and company reporting scope. Existing signup/sign-in return destinations are retained. |
| `/certificates` | Replaced the Phase 1A concept with an explanation of actual completion, eligibility, separate issuance, the library, printing and verification. The illustration is identified as an illustration. Existing noindex settings are retained. |
| Privacy, terms, cookies and refunds | Shared legal hero now stacks its eyebrow, heading, summary and revision date in reading order. Contents sidebar aligns to the start of the article and scrolls within a desktop viewport. Policy sections, dates and wording are untouched. |
| `/teach/apply`, `/teach/application` | Added an EN/FR/ES preparation checklist and email wrapping. Loading status announces busy state; failed status loading offers a reload without claiming an unverified application is safe. Form fields, submission handler, status decisions, identity reader and existing-application redirect remain intact. |
| Enrolled lesson player | Added an EN/FR/ES content jump link and focusable target. Long lesson menus have bounded scrolling; mobile previous/next controls wrap within the page. Existing enrollment checks, quiz/player/completion handlers and lesson destinations remain intact. |
| Public certificate verification | Lookup errors now reach a retry boundary rather than appearing as a missing record. Existing valid/revoked/missing record meanings and displayed public fields are retained. Added a route back to certificate information. |
| Issued certificate renderer | Reviewed existing responsive/print rules, private own-certificate reader, revoked state and verification/QR destinations; no renderer or issuance changes. |
| Public provider profile and blog | Existing responsive identity/contact/course layout and journal layout reviewed; retained in this slice. No fabricated courses or article destinations added. |
| Legacy aliases | Existing settings/admin/instructor redirects reviewed; retained. Domain ownership and compatibility helpers are outside this presentation change. |

## Verification

- New isolated rendering regression covers valid/revoked/missing verification states in EN/FR/ES, lookup failure recovery, and one main heading/skip target on the two updated public pages. No hosted requests.
- Existing learner workspace, authentication/navigation, teaching-entry and domain-transition regressions pass.
- Browser review used the computer-use skill/browser tools and a temporary local Next server with local Supabase URL and an empty publishable key. Company Learning at 375px, Certificates at 320px and desktop, and Privacy at 320px had no page-wide horizontal overflow. Company guidance opened successfully. The server was stopped after review and viewport override reset.
- Protected teaching/lesson and real certificate issuance were reviewed through source/regression coverage; no authenticated end-to-end submission, quiz, issuance or payment was performed in this slice. These are final Phase 5 acceptance checks before calling the phase complete.
- Focused ESLint and the final production build/TypeScript pass. The first build encountered a transient Next-generated development validator syntax error with the review server running; the final build passed after stopping that server.

## Resume here

The owner has confirmed that signed-in teaching-application status, long lesson menus, certificate printing and the mobile navigation behave as expected. A subsequent admin phone review found Home duplicated alongside My Learning and Explore in the hamburger drawer; all three are now omitted from the drawer while their persistent bottom-navigation shortcuts remain. The `/teach/application` page is being visually simplified; final Phase 5 sign-off depends on the owner reviewing that refreshed page after deployment. Notifications remain excluded. Phase 6 launch hardening, Live payment activation and the remaining joint SEO/PWA hostname verification are separate checkpoints.
