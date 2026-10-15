# Home and Teach opening update — October 15, 2026

## Scope

- Move the existing muted, autoplaying homepage film above the original hero, directly below the unchanged public navigation. Full-width, square edges, lower-left overlay typography, no text panel, AI caption or playback buttons. New English headline: “Where learning meets opportunity.”
- Add a photographic Teach opening before the original Teach hero. Left-aligned text and rounded brand-purple action over one continuous photograph. English headline: “Talent is everywhere. Opportunity should be, too.”
- The opening action scrolls to the retained teaching introduction; the existing `/teach/apply` action and all application behavior remain untouched and are not duplicated.
- Original hero photos, navigation/search, benefits, process, rights, FAQs, catalog rules, authentication, payments, hosted data, Docker and all unrelated work are unchanged.

## New assets and generation record

Built-in image generation was used, not the API/CLI fallback. This is a new fictional subject, not reused from the prior employer/partnership/teaching imagery. Desktop and mobile are the same fictional woman. No Passage photography was copied. Raw generated originals remain in the task’s generated-images directory.

- `public/images/teach-opening-educator-v1.webp`: 1536×1024, 66,520 bytes.
- `public/images/teach-opening-mobile-v1.webp`: 941×1672, 51,714 bytes. Selected by a native picture source below 780px; separate composition, not an image/text stack. Both use HTML overlay text, never burned-in text.

Desktop generation prompt:

> Use case: photorealistic-natural. Asset type: wide photographic opening background for Growvelt Learning's Teach page, not a screenshot, no UI. Create a NEW fictional beautiful adult Black American woman educator in her early thirties, friendly confident natural smile, shoulder-length natural twists, dark forest-green blouse, no headset, photographed from waist up in a bright understated home teaching workspace. Distinct face, hairstyle and outfit from generic beige-blazer corporate portraits. Warm natural daylight, realistic skin texture, premium editorial photography, professional and approachable, looking at camera. Landscape composition approximately 3:2: place the woman entirely in the RIGHT third, her face centered around 78 percent across and 28 percent down; keep full head and shoulders comfortably inside the frame with generous headroom. The LEFT 52 percent should be quiet warm ivory wall with subtle natural light, no subject, no objects, plenty of clean negative space for a large HTML headline. Desk may appear only at lower right. No writing, no letters, no logos, no watermark, no website or decorative graphics. Opaque photo background. Do not include any text.

Mobile identity-preserving edit prompt (desktop image supplied as edit target):

> Use case: identity-preserve. Edit target: the attached new portrait. Preserve EXACT same fictional Black woman, face, hairstyle (shoulder-length twists), forest-green blouse, natural smile, lighting and warm ivory home workspace. Create a portrait 9:16 art-directed responsive website background from this image. Reframe/outpaint, do not create a new person. Put her HEAD and FACE in the UPPER RIGHT quadrant: face centered 73% across and 19% down, with the entire head visible and ample breathing room. Her shoulders and torso extend along the right edge, not the left. Keep the entire LEFT 58% and especially the LOWER LEFT HALF a quiet warm ivory wall / soft naturally lit neutral background, low detail, for a large dark HTML headline over the image. Head and facial features must stay entirely above the top 35% of the image; lower left empty area must not contain any part of her face. Same premium natural photorealistic editorial photograph. No text, no logos, no watermark, no website UI. Opaque photo.

## Verification

- Production build passed; focused ESLint passed with no warnings after naming the test-only mock components.
- Home-motion, homepage expansion and new public-opening in-memory tests passed. They cover English/French/Spanish rendering, the new section order, retained hero/FAQ/rights/process sections, unique application CTA, mobile source selection, asset budget, muted looping playback and reduced-motion/data-saver behavior.
- Browser checked at 1440px desktop, 768px tablet, 375px phone and 320px small phone. Full-width film confirmed playing (8.375-second media), muted, with no controls. New Teach image loads the mobile composition and keeps text below the face but still over the same photograph; no detached text card. Long French copy was included in layout checks.
- Existing 1px whole-page overflow at 320px from unrelated footer/screen-reader content was not expanded by the openings and is outside this isolated change.
- Browser testing was read-only; no Auth, Storage, payment or database write testing performed. Development server used an explicit localhost Supabase URL with server credentials cleared; no claim is made that a production build rewrites its compile-time public values.

The video-generation provenance remains in `phase5-home-motion-reel.md`. Phase 5 roadmap position and all security/payment gates remain unchanged by this presentation-only update.
