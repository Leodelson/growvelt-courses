# Phase 5 — homepage motion reel

Initially added below the existing hero. The October 15 follow-up moves the reel directly below navigation and above the retained hero, at full width, with lower-left overlay copy. See `phase5-public-opening-update.md`. Existing hero, navigation, search, images, sections, links, catalog eligibility, authentication and payment behavior are preserved. No database migration, hosted data changes, Docker changes or Careers changes.

## Source and edit record

User-approved AI footage from their signed-in Canva account, generated with included allowance; no subscription, trial or purchase made. Thread: https://www.canva.com/ai/thread/e9076a15-535b-4e08-8055-c372a2a5e1f0 . Canva's applicable usage conditions still apply; AI generation is not a guarantee against third-party claims. Scenes are not presented as actual learners, staff or testimonials. At the user's request, the visible AI-scene label and play/pause controls were removed on October 15, 2026.

Four source clips, approximately six seconds each:

1. Classroom teaching: fictional adult Black woman with adult learners. Export `c7dc02e9-fab0-414a-90b9-2fd32d5087b4.mp4`.
2. Remote teaching: fictional adult white woman wearing headphones, smiling while teaching at a laptop in her home office. Export `7ce52def-3864-4101-a318-b40da3ec678e.mp4`.
3. Career preparation: fictional adult Black woman at her laptop. Export `uri_ifs___V_J6OQLw2sSvmEn-_r5hixzqkLXTpzIuB-RjkqkhTc5PE.mp4`.
4. Partnership: fictional adult Black and white male professionals collaborating. Export `uri_ifs___V_LvS9Zc-0YwuYXUu6Rf2PSh_23l1epozZ2Y7etw1KOeg.mp4`.

Raw exports remain in the user's Downloads, not committed. Reproduce with `scripts/build-home-motion-reel.mjs`, passing a local FFmpeg binary and the source directory. The temporary imageio-ffmpeg tool is outside the repository; no application dependency was added.

Each excerpt starts at 0.4s and lasts 2.4s; 0.4s cross-dissolves between scenes. A final dissolve into the first clip's opening 0.4s joins the loop to its starting frame. Classroom source has its top 84 pixels cropped to remove unwanted generated website-like text. All clips normalized to 1280×720, 24fps, H.264/yuv420p, faststart, **no audio track**. Final duration 8.375s; MP4 873,917 bytes; poster 45,944 bytes.

## Playback and safety

- Local versioned assets only; no Canva player, tracking embed or expiring signed URL in the app.
- Poster displayed before playback; media source assigned only when in view and motion is allowed.
- Muted inline looping video starts automatically in view, without visible controls or a label below the reel. Caption spacing no longer reserves room for the removed control.
- Reduced-motion and data-saver preferences suppress automatic loading/playback.
- Offscreen and hidden tabs pause; playback resumes automatically when visible and permitted. Blocked autoplay retains the poster.
- English, French and Spanish presentation copy.

## Verification

`scripts/test-phase5-home-motion.mjs`: in-memory lifecycle tests cover lazy loading, muted/inline/loop, poster, locale rendering, absence of controls/AI label, reduced-motion, data-saver, autoplay rejection, automatic pause/resume on tab visibility and cleanup. `scripts/test-phase5-home-expansion.mjs`: existing homepage regression checks, plus placement after hero/before Subjects. No test writes to Auth, Storage or the database.

Production build passed (Next.js 16.3.0); focused ESLint passed without warnings. Existing homepage expansion, FAQ and public support-page tests passed. Browser playback and manual pause passed with no browser console errors. Layout checked at 1440, 768, 375 and 320px; reel controls and title do not overlap. The 320px whole-page measurement has a pre-existing 1px overflow associated with footer/screen-reader elements, not the new reel; unrelated footer code was not changed. Final caption contrast and spacing rechecked after the final build. Desktop proof is kept in the task visualization directory, not shipped as an app asset.

Remaining Phase 5 work is unchanged; notifications remain excluded and security/payment gates are not altered by this visual addition.
