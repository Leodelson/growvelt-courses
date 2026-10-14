# Phase 5 — public support-page checkpoint

Updated 14 October 2026. Dashboard empty-state integrations are pushed separately in `ef2d176`. Public Home, Explore and Teach are in `249d31b`. Neither release completes Phase 5.

## Frequently Asked Questions — approved release

Route: `/frequently-asked-questions`.

The refreshed FAQ has a compact help-centre hero, local answer search, three topic filters, readable disclosure cards, a no-results message with a reset action, and one contextual Contact action. It uses existing theme tokens and English, French and Spanish copy. Native disclosure elements keep the questions keyboard-operable; result counts are announced politely. Search matches question and answer text without case or accent sensitivity. No search term is submitted to a backend.

All 30 original translated question/answer pairs are unchanged, including certificate completion requirements, instructor approval requirements and the disclaimer that learning does not guarantee employment. Existing public navigation, footer, metadata and contact destination are retained. No authentication, payment, data query, migration, hosted setting or database record is changed.

Desktop uses topic navigation beside the answer list. At narrower widths it becomes a two-column topic picker above a single answer column, with support after the answers. Inputs retain a 16px font on mobile. Cards, headings and labels wrap; disclosure motion respects reduced-motion preferences.

### Verification

- `node scripts/test-phase5-faq.mjs` passes component-render checks for all three locales, topic selection, combined question/answer search, case/accent normalization, reset, no-results messaging and a single Contact action.
- A separate comparison with the pre-refresh content confirms the original 30 translated question/answer pairs are unchanged.
- Focused ESLint passes for the FAQ component and its component-render test. `npm run build` passes, including TypeScript and FAQ prerendering.
- The local route returned HTTP 200 during development compilation. Development uses an explicit localhost Supabase URL with empty backend keys for this static page, not hosted write testing.
- Visual/browser QA remains unverified: Windows Computer Use `get_window_state` timed out after fresh window selection/retry, and the in-app browser connection timed out. Do not describe responsive layout, keyboard interaction, or appearance as browser-verified yet.

The owner approved the FAQ and it was pushed separately to `main` in `2e4b537` on 14 October 2026. Build, lint and component-render checks pass; automated browser layout QA remains unverified as noted above. Temporary `/ui-review/phase5`, unrelated earnings/PWA/media work, and generated TypeScript cache changes are excluded.

## About, Contact/support and Partnerships — 14 October release

Routes: `/about`, `/contact`, `/partner-with-growvelt`.

- About retains the existing multilingual content and all five real team members/photos, with balanced section spacing, readable typography, coordinated image crops and an adaptive team grid. Redundant Explore actions are removed; the final action now opens Contact.
- Contact uses a split photographic hero, three support-channel cards and the existing inquiry form. Email, WhatsApp, telephone, office hours and location are unchanged. Its FAQ link opens the existing help page.
- Partnerships retains all original English, French and Spanish copy, its four partnership types and inquiry form. The hero presents the learning-to-opportunity pathway; the primary action scrolls to its form.
- Scoped styles use the existing theme tokens, mobile single-column sections, wrapping headings and 16px form fields. No notification page, authentication behavior, payment, migration, API handler or hosted setting is changed.
- At the owner's request, repeated “clearer” display wording is replaced with context-specific text on Contact and Teach, and in three local demo-data labels. Existing URL slugs are intentionally preserved. No hosted course record was edited.

### Verification and limitations

`node scripts/test-phase5-public-support-pages.mjs` passes three-locale rendering, one page heading per route, five real team photos, support destinations, inquiry form kinds, the partnership anchor, pathway/process counts and preservation of original About/Partnership copy. It also confirms the inquiry form implementation is unchanged. Focused ESLint and the production build pass, including TypeScript and route prerendering. No forms were submitted and no database/Auth/Storage write tests were performed.

Automated browser visual QA remains blocked: selecting the existing local browser tab was rejected by browser URL policy. No workaround was attempted. Responsive rules have been implemented and reviewed in source, but do not claim mobile/desktop appearance or keyboard operation is browser-verified. Owner review remains useful after deployment.

Read-only local HTTP checks returned 200 for all three routes and the 54,166-byte hero asset. The development process explicitly overrides its Supabase URL to `http://127.0.0.1:54321` with backend secret keys empty; no form submission or hosted write was used for these checks.

### Contact image provenance

`public/images/contact-support-hero.webp` is an AI-generated illustrative portrait, not a named employee. It is decorative and has empty alternative text; the actual About team identities remain unchanged. The image-generation skill produced the original raster; the existing Sharp dependency optimized it to 1200 × 800, 54,166 bytes. No stock licensing or third-party identity claim is introduced.

Generation mode: new image. Prompt: “Use case: photorealistic-natural. Create a premium editorial website hero photograph for Growvelt Learning's Contact/support page. A fictional beautiful adult Black Nigerian woman customer-support professional in her late 20s wearing a comfortable discreet black over-ear headset with microphone, warm confident smile, natural textured hair neatly styled, elegant lilac blouse, sitting at a clean modern desk with a laptop. Bright contemporary office with softly blurred warm off-white and subtle lilac background, soft window daylight, realistic natural skin texture, polished but approachable not glamour or fashion. Waist-up portrait with subject centered, hands naturally resting at the laptop, uncluttered composition, landscape 3:2 framing suitable for cropping into the right half of a split website hero. No words, no logos, no watermark, no other people. This is illustrative photography, not a real employee identity.”

## Resume in this order

1. Confirm the About, Contact/support and Partnerships deployment and owner review; retain the outstanding visual QA limitation. FAQ is already pushed separately.
2. Authentication presentation, preserving redirects, OAuth and email/password flows.
3. Broader dashboard shell, populated cards and role-specific pages, starting from the six-route empty-state checkpoint in `phase5-ui-ux-review.md`.

Notifications remain explicitly excluded until the owner requests them.

Earlier live-commerce operational gates and Phase 6 hardening remain open in the main roadmap checkpoint. This visual work does not authorize live payments or synthetic hosted-data testing.
