import { createClient } from "@supabase/supabase-js";

const action = process.argv[2];
const expectedConfirmation = action === "activate" ? "ACTIVATE_PHASE1A_TEST_FIXTURE" : "CLOSE_PHASE1A_TEST_FIXTURE";
if (!['activate','close'].includes(action)) throw new Error("Use: node scripts/manage-phase1a-test-fixture.mjs activate|close");
if (process.env.PHASE1A_FIXTURE_CONFIRMATION !== expectedConfirmation) throw new Error(`Set PHASE1A_FIXTURE_CONFIRMATION=${expectedConfirmation} to continue.`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase URL and service credential are required.");
const host = new URL(url).hostname;
const target = process.env.PHASE1A_FIXTURE_TARGET;
const isLocal = host === "127.0.0.1" || host === "localhost";
const projectRef = host.endsWith(".supabase.co") ? host.split(".")[0] : "local";
if (target !== projectRef || (!isLocal && projectRef !== "qtcpjcaoptdunuefwvgc")) throw new Error(`Refusing unconfirmed fixture target: ${projectRef}`);

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let result;
if (action === "activate") {
  const courseId = Number(process.env.PHASE1A_FIXTURE_COURSE_ID);
  const testerId = process.env.PHASE1A_FIXTURE_TESTER_ID;
  const operatorId = process.env.PHASE1A_FIXTURE_OPERATOR_ID;
  const expiresAt = process.env.PHASE1A_FIXTURE_EXPIRES_AT;
  if (!Number.isSafeInteger(courseId) || !testerId || !operatorId || !expiresAt) throw new Error("Course, tester, operator, and expiry inputs are required.");
  result = await supabase.rpc("activate_paystack_test_fixture", {
    p_course_id: courseId,
    p_tester_id: testerId,
    p_operator_id: operatorId,
    p_expires_at: expiresAt,
    p_declaration_version: "2026-08-v1",
    p_rights_basis: process.env.PHASE1A_FIXTURE_RIGHTS_BASIS ?? "original",
  });
} else {
  const fixtureId = Number(process.env.PHASE1A_FIXTURE_ID);
  const operatorId = process.env.PHASE1A_FIXTURE_OPERATOR_ID;
  const reason = process.env.PHASE1A_FIXTURE_CLOSE_REASON;
  if (!Number.isSafeInteger(fixtureId) || !operatorId || !reason) throw new Error("Fixture, operator, and close reason are required.");
  result = await supabase.rpc("close_paystack_test_fixture", { p_fixture_id: fixtureId, p_operator_id: operatorId, p_reason: reason });
}
if (result.error) throw new Error(`Fixture ${action} failed: ${result.error.code ?? "database_error"}`);
console.log(`PASS Phase 1A fixture ${action} on ${projectRef}.`, result.data);
