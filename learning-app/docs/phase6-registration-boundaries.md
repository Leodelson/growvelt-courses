# Phase Six registration request boundaries

25 October 2026. Follows framework/contrast release `96903c8`.

## Scope

Instructor applications, instructor organization creation, and team workspace
creation previously parsed unbounded JSON before verifying the session. These
three routes now keep the same-origin check first, verify the session, then
use the existing streamed JSON object reader. Instructor applications accept
up to 64 KiB; the two name/slug forms accept up to 4 KiB. Limits allow the
existing maximum-length form fields even with escaped Unicode JSON.

Unsupported content types return 415, oversized bodies 413, and malformed or
non-object JSON 400. Parsing failures are private/no-store. Actual bytes are
bounded even when Content-Length is absent or forged. Valid request shapes,
database RPCs, role rules, application approvals and alert scheduling remain
unchanged. Organization failure logging retains the error code without a raw
database message that might contain user-supplied data.

## Verification scope

The extended actual-handler fixture covers all three routes: foreign/sibling
origin rejection, signed-out denial before body consumption, malformed and
oversized input, object-only JSON, maximum-length Unicode, valid submissions,
permission-denied RPC responses, and ignored caller-supplied identity/role
fields. The instructor application GET is tested for verified-session scoping
before its privileged lookup. Failed submissions do not schedule alerts.

These fixtures use fake authenticated clients, not real submitted applications.
Existing SQL permissions remain authoritative; this change neither adds a role
nor bypasses RPC authorization. Production HTTP checks additionally cover the
three routes' sibling-origin denials without successful mutations.

Verification passed: production build and TypeScript, scoped ESLint, API boundary
and streamed JSON fixtures, Auth session propagation, organization foundation
checks, and local production HTTP checks including 13 sibling-origin denials.

This is request-allocation hardening, not distributed per-attempt rate limiting
or a complete audit of all invitation, membership, profile and payment routes.
No hosted migrations, credentials, payment switches, email sends or UI changes
are included. Continue the broader authorization/input review and outstanding
accessibility/production-host checks before the controlled Live checkout gate.
