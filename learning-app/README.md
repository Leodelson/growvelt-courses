# Growvelt Learning

Phase 1A visual application shell for the future Growvelt Learning product.

This application uses Supabase SSR authentication for email/password and Google Sign-In. It intentionally contains no course, enrollment, payment, storage, video, PWA, analytics, or learner-data integration. All displayed course and learner content is local mock data in `app/lib/mock-data.ts`.

Copy `.env.example` to `.env.local` and add only the Supabase project URL and publishable key. Never place a service-role key or Google OAuth credentials in this application.
