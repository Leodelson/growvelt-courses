# Phase 5 — public discovery experience

14 October 2026. The owner authorized an isolated production push of this public redesign. Vercel deployment readiness and post-deployment visual acceptance remain separate checks. Dashboard progress is explicitly recorded in `phase5-ui-ux-review.md` and paused at the owner's request.

Release scope includes the public pages/header, localized copy, their required shared `EmptyState` component, the shared body minimum-width correction, and these progress notes. Dashboard page integrations, the development-only review route, earnings/PWA/media work, and earlier unrelated documentation changes remain local and are excluded.

## Scope and design

- Home `/`: original split headline/photo composition, six subject entry points, an optional shelf of genuine published courses, a three-step learning explanation, distinct teaching/team paths, compact guides and FAQs.
- Explore `/learn`: calmer heading, one shared header search with “I want to learn…” placeholder, category/level/access/sort controls, query summary, compact course cards, and balanced empty state.
- Teach `/teach`: original instructor hero, three benefits, application/course-review process, preserved content-rights guidance, FAQs, and a single application action.
- Shared public navigation: approved theme-aware logo unchanged, prominent GET search to `/learn?q=…`, four product links, desktop language/auth controls, and one mobile-menu trigger with Escape, focus trap, focus restoration, and body scroll locking. Other public pages using this header receive the same navigation. Their bodies are not redesigned.
- English, French, and Spanish copy; light/dark design tokens, fluid typography, narrow-screen layout rules and reduced-motion support. Exact visual fit and interaction verification must not be asserted without browser testing.

Reviewed [Coursera](https://www.coursera.org/) and [Udemy](https://www.udemy.com/) for search prominence and subject-led discovery. Growvelt uses its own composition, copy, approved logos, existing photographs and course data. No competitor assets, testimonials, ratings, scale claims or fake course listings were added. Repeated standalone landing-page marketing blocks are consolidated; standard navigation/footer links remain available.

## Functional and data boundaries

Existing public eligibility RPCs, search normalization, filter/sort values, pagination, saved-course behavior, course destinations and review restrictions are preserved. The shared dashboard catalog retains its existing search field and layout branch. Homepage courses are optional: failures omit the shelf rather than substituting fixtures. Existing video guides remain available through a collapsed links panel, not heavy autoplay embeds. SEO organization JSON-LD, canonical metadata, teaching rights guidance and existing footer content remain.

No migration, Auth template, production configuration, payment, Docker, Careers or security-roadmap changes are part of this slice. Local visual-serving processes explicitly blank service-role/secret keys. Public response checks use existing anonymous read-only catalog queries; no Auth/Storage/database write testing is authorized or performed.

## Review and verification

Review locally at `http://127.0.0.1:3010/`, `/learn`, and `/teach`. The separate development-only `/ui-review/phase5` route remains the dashboard empty-state reference and must stay out of eventual production commits.

TypeScript and the final production build passed. Focused ESLint passed without warnings after fixing the menu focus-restoration ref capture. HTTP checks returned rendered content for Home, Explore, Teach, a Data Analytics filter and a deliberately unmatched search. Each rendered page has one main and one footer; Explore's streamed HTML includes its loading fallback and final replacement, each with a header. The unmatched query produced the empty state, the category query returned a genuine matching course, and the homepage rendered three genuine course links.

The first catalog request failed because sandbox networking denied the anonymous Supabase fetch (`EACCES`). An approved read-only retry against the existing Courses project succeeded; the preview process was restarted with network permission and private service keys disabled. No catalog eligibility or database changes were made to fix that environment limitation. A concurrent dev/build attempt briefly locked generated `next-env.d.ts` on Windows; stopping the preview and rerunning the final build succeeded.

Direct browser visual/interaction testing is blocked in the current session because the available Browser skill's `scripts/browser-client.mjs` runtime is missing. Do not claim the new public pages have passed viewport, theme, keyboard or screenshot checks. These checks remain required before final visual acceptance/deployment: 320/375/768/1080/1280/1440px, long French/Spanish navigation, dark mode, one visible search input, search/reset/filter interactions, empty results, menu focus/Escape, FAQ disclosure, image crops, and no horizontal overflow. The responsive loading skeleton is aligned with the new four-filter catalog layout.
