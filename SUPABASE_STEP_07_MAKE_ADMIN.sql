-- Growvelt Learning - Step 07 Make One User Admin
-- Run this in Supabase SQL Editor after you have signed up once on Growvelt Learning.
-- Replace the email below with the email address you used to sign up.
--
-- Purpose:
-- 1. Promote one existing Growvelt Learning user to admin.
-- 2. Keep this separate from normal schema/policy files for safety.
--
-- IMPORTANT:
-- Change 'your-email@example.com' before running.

update public.profiles
set
  account_type = 'admin',
  onboarding_status = 'complete',
  updated_at = now()
where lower(email) = lower('your-email@example.com');

-- Confirm the admin user exists.
select id, full_name, email, account_type, onboarding_status
from public.profiles
where lower(email) = lower('your-email@example.com');
