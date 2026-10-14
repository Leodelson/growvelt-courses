# Phase 5 — homepage discovery and employer/partnership sections

14 October 2026. Follow-up to the public redesign in `249d31b` and support-page release `09398d2`. This slice does not complete Phase 5.

## Scope

- The public navigation search now asks **“What would you like to learn?”**, with matching French and Spanish questions. Its existing GET `/learn?q=` behavior is unchanged.
- A goal-based skill finder has four accessible toggle buttons. Each selection presents four tool/skill search links. These are explicitly labelled suggestions, not available-course listings or popularity claims.
- A study-routine planner offers 10-, 20- and 30-minute sessions, displays the corresponding total for three sessions per week, and suggests review/practice/reflection allocations. It is a browser-local illustration, not saved account progress or a course-completion estimate. It makes no backend requests or writes.
- A dedicated **“Are you hiring?”** section uses the requested corporate woman image and a single primary Growvelt Careers action. It uses the existing Careers root destination (`https://www.growvelt.com`), consistent with the current footer's Post a job link; it does not bypass employer sign-in or submit a job.
- Partnerships gets its own illustrated section, with a Black man and a white man collaborating and one link to the existing partnership page. The former small careers/partnership connection row is removed, so it does not repeat those actions.
- Existing hero, subject categories, actual published-course shelf, learning journey, teaching/company cards, guide videos, FAQs, footer, SEO, navigation and authentication destinations remain. The course query and its private/unpublished-course protections are untouched. No sample listings, fabricated testimonials, platform statistics or empty filler shelves are introduced.
- New scoped styles use the current light/dark tokens, wrapping layouts, single-column mobile sections, large interactive targets and reduced-motion support. No notification page, payment code, cart, database, Supabase setting, Careers codebase or Docker environment is changed.

## Verification

`node scripts/test-phase5-home-expansion.mjs` checks all three locales, the question-style prompt, all four goal selections and encoded query destinations, all three session options and allocation arithmetic, one employer action, one partnership action, preserved FAQ/guide count, the real-data-only course shelf contract and both assets below 100 KB each. It uses only in-memory fixtures and does not submit forms or write data. Focused ESLint passes.

Both production builds pass, including TypeScript and page generation. A local production server returned HTTP 200 with the new question prompt and both editorial sections. Browser checks at 1440, 768, 375 and 320px viewport settings found no horizontal overflow or off-screen main headings, buttons, links or images. The browser's current dark appearance was visually reviewed, including both image crops. Actual browser clicks verified the web-development goal updates its search suggestions and the 30-minute session updates to 90 minutes per week with a 5/20/5 allocation. Mobile review identified a clipped placeholder and wrapped session choice; placeholder typography and a three-column session selector address those cases while retaining 16px typed input text. The final stylesheet rebuild passes, but its last mobile visual recheck and translated browser review remain unverified: a language change while the server was stopped for rebuilding reached a browser-generated connection-error page; browser URL policy then blocked access to that `data:` page, including the normal navigation retry after the server restarted. No alternate browser/control mechanism was used to bypass it. Viewport overrides were reset. Light appearance and translated visual layouts should not be described as browser-verified merely from component tests. All three locales and the FAQ/support-page regression suites pass their component checks; no backend writes were performed.

## Image provenance

Both are new images made with the built-in image-generation tool under the imagegen skill, inspected before integration. They depict fictional people, not named customers, employees or partners, and are decorative (`alt=""`). Originals remain in the generated-images directory. Existing Sharp was used only for responsive asset sizing and WebP compression; no new dependency was installed.

- `public/images/home-hiring-corporate-woman.webp`: 1200 × 800, 56,164 bytes.
- `public/images/home-partnership-collaboration.webp`: 1200 × 800, 77,172 bytes.

Hiring prompt: “Use case: photorealistic-natural. Asset type: editorial website photo for an Are you hiring section. A fictional beautiful adult Black American corporate woman in her early 30s, warm confident natural smile, elegant cream blazer over a simple blouse, neatly styled natural dark hair, seated at a tidy modern office desk with laptop. Waist-up portrait with face clearly visible and hands naturally near laptop, subject centered for flexible website cropping. Bright soft window daylight, realistic skin and fabric texture, softly blurred neutral contemporary office, polished approachable business photography, landscape 3:2 composition. No text, logos, watermark, badges, or other people. Not a real customer or testimonial.”

Partnership prompt: “Use case: photorealistic-natural. Asset type: editorial website photograph for a learning partnership section. Two fictional adult male business professionals, one Black man and one white man, in smart casual corporate clothing, sitting side by side at a meeting table collaboratively reviewing a laptop and a simple unmarked notebook. Natural friendly engaged expressions, candid three-quarter view, looking at their shared work rather than posing at the camera. Bright modern office with soft daylight and understated warm neutral background. Both faces visible, realistic skin and fabric textures, tasteful premium business photography, landscape 3:2 composition with both people comfortably inside the frame. No text, logos, watermark, handshake pose, badges or other people. Not real customers or an actual partnership claim.”

## Resume

After deployment review, continue the remaining Phase 5 authentication presentation and broader dashboard groups from the six-route checkpoint in `phase5-ui-ux-review.md`. Notifications remain excluded. A multi-course cart is future product work: it needs a separate order, entitlement, coupon, payment and refund design and is not a UI-only change. Earlier live-commerce gates and Phase 6 hardening remain open.
