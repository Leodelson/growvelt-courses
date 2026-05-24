# Growvelt Courses Edge Functions Setup

These functions run in Supabase, not in the browser. Keep these values as Supabase secrets only.

## Functions

- `send-registration-email`: sends a confirmation email to the student and an admin notification.
- `create-paystack-transaction`: creates a Paystack checkout transaction and returns the Paystack payment URL.
- `verify-paystack-transaction`: confirms Paystack payment after the student returns from Paystack.

## Required Supabase Secrets

Set these in Supabase Dashboard > Edge Functions > Secrets:

```text
ADMIN_EMAIL=admin@growvelt.com
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=Growvelt Courses <courses@growvelt.com>

PAYSTACK_SECRET_KEY=your_paystack_test_or_live_secret_key
PAYSTACK_CURRENCY=NGN
SITE_URL=https://courses.growvelt.com
```

Required per-course pricing:

```text
COURSE_PRICES_JSON={"Data Analysis":"360000","Data Analysis with Excel":"0","Excel for Data Analysis":"0","Business Analysis":"240000","Data Science":"480000","Power BI for Business Analysis":"0","SQL for Data Analytics":"0","Python for Data Analysis":"0","Python":"0","R for Data Analysis":"0","Web Development":"0","Cybersecurity":"0","Social Media Marketing":"180000","Graphics Design":"150000","Basic Computer Literacy":"0","Microsoft Word":"0","Microsoft PowerPoint":"0","Google Drive":"0","Other":"0"}
```

Use your Paystack test secret key first. Switch to your live secret key only after test payments work.

Replace every `0` with the real course amount before taking live payments. Also update the public display prices in `supabase-config.js` so the registration page shows the same course prices.

## Deploy

From the project folder, deploy each function:

```bash
supabase functions deploy send-registration-email
supabase functions deploy create-paystack-transaction
supabase functions deploy verify-paystack-transaction
```

After deployment, test the registration form:

1. Submit `registration.html`.
2. Confirm the row appears in `course_registrations`.
3. Confirm the student and admin emails arrive.
4. Click "Continue to Paystack".
5. Complete Paystack test payment.
6. Confirm the row updates to `payment_status = paid`.
