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

The owner approved the FAQ and explicitly requested its isolated push on 14 October 2026. Build, lint and component-render checks pass; automated browser layout QA remains unverified as noted above. Do not include temporary `/ui-review/phase5`, unrelated earnings/PWA/media work, or generated TypeScript cache changes in its commit.

## Resume in this order

1. Push the owner-approved FAQ separately; keep automated mobile/desktop visual checks visible as a follow-up.
2. About.
3. Contact/support, preserving form submission and support destinations.
4. Partnerships, preserving its content and working form.
5. Authentication presentation, preserving redirects, OAuth and email/password flows.
6. Broader dashboard shell, populated cards and role-specific pages, starting from the six-route empty-state checkpoint in `phase5-ui-ux-review.md`.

Earlier live-commerce operational gates and Phase 6 hardening remain open in the main roadmap checkpoint. This visual work does not authorize live payments or synthetic hosted-data testing.
