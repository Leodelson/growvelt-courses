# Phase Six management request boundaries

## Scope

Follow-up to registration hardening in `9a2d97a`. Four existing POST routes now
authenticate before reading JSON and use the shared streamed object reader:

- Organization profile: 32 KiB.
- Organization member revocation: 4 KiB.
- Organization invitations: 4 KiB.
- Team workspace invitations: 4 KiB.

Malformed/non-object JSON returns 400, oversized bodies 413, and unsupported
content types 415, with private/no-store responses. Existing forms already send
JSON objects, including an empty object for member revocation without a reason.
Maximum-length Unicode profile and reason fields fit the limits.

## Verification

Actual-handler fixtures pass for origin rejection, signed-out denial before body
access, malformed and oversized input despite forged Content-Length, invalid
resource IDs, permission-denied RPCs, and valid requests. Caller-supplied owner
IDs cannot override the verified session. Denied requests cannot load privileged
invitation email context. Provider calls are mocked; no live invitations sent.

The production build, TypeScript and streamed JSON fixtures pass. Database
function source retains active owner/manager checks tied to auth.uid(), member
ownership restrictions, and supported invitation roles. These checks were read,
not changed or re-applied. Mock RPC tests do not replace a live database audit.

No schema, credentials, payment settings, UI or email delivery behavior changed.
Remaining Phase Six work includes the broader route review, production-host and
accessibility checks, and separately controlled live-payment readiness.
