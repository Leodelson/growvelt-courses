import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const require = createRequire(import.meta.url), cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(`../app/lib/email/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: mod.exports, URL, AbortSignal, require: id => id === "server-only" ? {} : id.endsWith("site-urls.mjs") ? { learningAbsoluteUrl: path => `https://www.growvelt.com${path}` } : id.startsWith("./") ? load(id.slice(2)) : require(id) });
  cache.set(name, mod.exports); return mod.exports;
}
const audience = load("email-center-audience");
const usageTools = load("email-center-provider-usage");
const usagePayload = { object: "usage", emails: { daily: { used: 9, limit: 100 }, monthly: { used: 138, limit: 3000 } }, contacts: { used: 592, limit: 1000 }, segments: { used: 3, limit: 3 } };
assert.equal(usageTools.hasEmailCenterProviderHeadroom(usageTools.parseEmailCenterProviderUsage(usagePayload)), true);
assert.equal(usageTools.hasEmailCenterProviderHeadroom({ ...usageTools.parseEmailCenterProviderUsage(usagePayload), checkedAt: Date.now() - 6000 }), false);
assert.equal(usageTools.hasEmailCenterProviderHeadroom(usageTools.parseEmailCenterProviderUsage({ ...usagePayload, emails: { ...usagePayload.emails, daily: { used: 75, limit: 100 } } })), false);
assert.throws(() => usageTools.parseEmailCenterProviderUsage({ ...usagePayload, emails: { ...usagePayload.emails, daily: { used: 1, limit: null } } }), /free provider allowance/);
let usageReads = 0;
const ids = [1, 2, 3, 4, 5].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const [operator, learner, teacher, other, contactId] = ids;
const account = { userId: learner, email: "learner@example.invalid", confirmed: true, marketingOptIn: true };
const contact = { id: contactId, email: account.email, unsubscribed: false };
const complete = contacts => ({ complete: true, contacts });
const planInput = { segmentId: audience.LEARNING_EMAIL_SEGMENT_ID, accounts: [account], providerCatalog: complete([contact]), segment: complete([]) };
assert.deepEqual([...audience.planLearningAudienceSync(planInput).addContactIds], [contactId]);
assert.equal(audience.verifyLearningBroadcastAudience({ ...planInput, segment: complete([contact]) }).recipients, 1);
assert.throws(() => audience.planLearningAudienceSync({ ...planInput, segmentId: "a8776ea3-0012-4c55-a887-1c0153466738" }), /reserved Growvelt/);
assert.throws(() => audience.verifyLearningBroadcastAudience({ ...planInput, segment: complete([{ id: other, email: "careers@example.invalid", unsubscribed: false }]), providerCatalog: complete([contact, { id: other, email: "careers@example.invalid", unsubscribed: false }]) }), /membership/);
assert.throws(() => audience.planLearningAudienceSync({ ...planInput, providerCatalog: { complete: false, contacts: [contact] } }), /complete/);
const suppressed = { ...contact, unsubscribed: true };
const suppressionPlan = audience.planLearningAudienceSync({ ...planInput, providerCatalog: complete([suppressed]), segment: complete([suppressed]) });
assert.deepEqual([...suppressionPlan.addContactIds], []);
assert.deepEqual([...suppressionPlan.removeContactIds], [contactId]);
assert.throws(() => audience.verifyLearningBroadcastAudience({ ...planInput, providerCatalog: complete([suppressed]) }), /No eligible/);
assert.equal(audience.planLearningAudienceSync({ ...planInput, providerCatalog: complete([]) }).requiresContactImportApproval, true);
assert.deepEqual([...audience.planLearningAudienceSync({ ...planInput, accounts: [{ ...account, marketingOptIn: false }], segment: complete([contact]) }).removeContactIds], [contactId]);
const fullCatalog = Array.from({ length: 1000 }, (_, n) => ({ id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`, email: `existing-${n}@example.invalid`, unsubscribed: false }));
assert.throws(() => audience.planLearningAudienceSync({ ...planInput, providerCatalog: complete(fullCatalog) }), /shared free contact allowance/);
assert.throws(() => audience.planLearningAudienceSync({ ...planInput, providerCatalog: complete([contact, { ...contact, id: other }]) }), /inconsistent/);

const db = new PGlite();
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create table profiles(id uuid primary key,account_type text);
    create table instructor_profiles(user_id uuid,approval_status text);
    create table learning_company_workspaces(id bigint primary key,status text);
    create table learning_company_memberships(user_id uuid,workspace_id bigint,status text,role text);
    create table learning_email_preferences(user_id uuid primary key references auth.users,marketing_opt_in boolean not null default false,changed_at timestamptz not null default now(),unsubscribe_token uuid not null unique default gen_random_uuid());
    insert into auth.users(id,email,email_confirmed_at) values('${operator}','admin@growvelt.com',now()),('${learner}','learner@example.invalid',now()),('${teacher}','teacher@example.invalid',now()),('${other}','other@example.invalid',null);
    insert into profiles values('${operator}','admin'),('${learner}','learner'),('${teacher}','learner'),('${other}','learner');`);
  for (const migration of ["20261107000000_add_learning_email_center_drafts.sql", "20261108000000_add_learning_email_consent_and_budget_controls.sql"]) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const setPreference = (user, value) => query("select set_learning_email_preference($1,$2,'settings') as result", [user, value]);
  await setPreference(learner, true); await setPreference(learner, true);
  assert.equal((await query("select count(*)::int as n from learning_email_consent_events"))[0].n, 1, "same-state retry is idempotent");
  const token = (await query("select unsubscribe_token from learning_email_preferences where user_id=$1", [learner]))[0].unsubscribe_token;
  await query("select unsubscribe_learning_email_token($1)", [token]);
  let consent = (await query("select * from learning_email_consent_sync where user_id=$1", [learner]))[0];
  assert.equal(consent.opted_in, false); assert.equal(Number(consent.version), 2); assert.equal(Number(consent.synchronized_version), 0);
  await setPreference(learner, true);
  consent = (await query("select * from learning_email_consent_sync where user_id=$1", [learner]))[0];
  assert.equal(Number(consent.version), 3, "re-consent records a new version without asserting provider resubscription");
  await query("select unsubscribe_learning_email_token($1)", [contactId]);
  assert.equal((await query("select count(*)::int as n from learning_email_consent_events"))[0].n, 3, "unknown token does not mutate consent");
  await assert.rejects(setPreference(other, true), /Confirmed Learning/);
  assert.equal((await query("select mark_learning_email_consent_synchronized($1,1,true) as value", [learner]))[0].value, false, "stale provider completion cannot acknowledge newer consent");
  const marketingDraft = "20000000-0000-4000-8000-000000000001";
  const marketingDocument = { sender: "learning", mode: "marketing", audience: "specific", recipients: [learner], subject: "Learning news", headline: "", message: "A Learning update for you.", personalized: false, buttonText: "", buttonUrl: "", bell: false };
  await query("select save_learning_email_center_draft($1,$2,0,$3)", [operator, marketingDraft, marketingDocument]);
  await query("select review_learning_email_center_draft($1,$2,1)", [operator, marketingDraft]);
  await assert.rejects(query("select claim_learning_email_center_attempt($1,$2,1,'broadcast')", [operator, marketingDraft]), /synchronization pending/);
  assert.equal((await query("select mark_learning_email_consent_synchronized($1,3,true) as value", [learner]))[0].value, true);
  assert.equal((await query("select claim_learning_email_center_attempt($1,$2,1,'broadcast') as value", [operator, marketingDraft]))[0].value, true);
  await db.exec(`create function reject_consent_event_fixture() returns trigger language plpgsql as $$ begin raise exception 'fixture audit failure'; end $$;
    create trigger reject_consent_event_fixture before insert on learning_email_consent_events for each row execute function reject_consent_event_fixture();`);
  await assert.rejects(setPreference(learner, false), /fixture audit failure/);
  assert.equal((await query("select marketing_opt_in from learning_email_preferences where user_id=$1", [learner]))[0].marketing_opt_in, true, "failed audit atomically rolls back preference/outbox changes");
  await db.exec("drop trigger reject_consent_event_fixture on learning_email_consent_events");

  const base = { sender: "support", mode: "transactional", audience: "specific", recipients: [learner, teacher], subject: "Learning account help", headline: "", message: "We reviewed your account request.", personalized: false, buttonText: "", buttonUrl: "", bell: false };
  async function reviewedDraft(n) {
    const id = `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    await query("select save_learning_email_center_draft($1,$2,0,$3)", [operator, id, base]);
    await query("select review_learning_email_center_draft($1,$2,1)", [operator, id]); return id;
  }
  const database = {
    rpc: async (name, args) => {
      const names = { claim_learning_email_center_attempt: ["p_actor", "p_id", "p_revision", "p_target_key"], reserve_learning_email_center_budget: ["p_actor", "p_id", "p_revision", "p_target_key"], complete_learning_email_center_attempt: ["p_actor", "p_id", "p_target_key", "p_state", "p_provider_id"], read_learning_email_consent_sync: ["p_user_id"], claim_learning_email_segment: ["p_holder", "p_kind"], release_learning_email_segment: ["p_holder"], mark_learning_email_consent_synchronized: ["p_user_id", "p_version", "p_opt_in", "p_contact_id", "p_email"] }[name];
      if (!names) throw new Error("Unexpected RPC");
      try { return { data: (await query(`select ${name}(${names.map((_, n) => "$" + (n + 1)).join(",")}) as value`, names.map(key => args[key])))[0].value, error: null }; }
      catch (error) { return { data: null, error }; }
    },
    from(table) {
      const filters = []; let fields;
      const builder = { select(value) { fields = value; return builder; }, eq(key, value) { filters.push([key, value]); return builder; },
        async maybeSingle() {
          if (!["learning_email_center_drafts", "learning_email_center_targets", "learning_email_center_attempts"].includes(table)) throw new Error("Unexpected table");
          const rows = await query(`select ${fields} from ${table} where ${filters.map(([key], n) => `${key}=$${n + 1}`).join(" and ")}`, filters.map(([, value]) => value));
          return { data: rows[0] ?? null, error: null };
        } }; return builder;
    },
  };
  const synchronize = load("email-center-consent-worker").synchronizeLearningConsent;
  const membership = new Set(), consentRequests = [];
  const providerTeacherId = "40000000-0000-4000-8000-000000000001";
  const teacherContact = { id: providerTeacherId, email: "teacher@example.invalid", unsubscribed: false };
  const knownContacts = new Map([[teacherContact.email, teacherContact]]);
  let membershipHook = null;
  const consentProvider = load("email-center-consent-provider").createLearningConsentProvider({ key: "re_fixture_marketing", enabled: true, pace: async () => undefined,
    request: async (url, init) => {
      consentRequests.push({ url, method: init.method });
      const path = new URL(url).pathname;
      if (init.method === "GET" && path.endsWith("/segments")) {
        const contactId = path.split("/")[2];
        return Response.json({ has_more: false, data: [{ id: "a8776ea3-0012-4c55-a887-1c0153466738" }, ...(membership.has(contactId) ? [{ id: audience.LEARNING_EMAIL_SEGMENT_ID }] : [])] });
      }
      if (init.method === "GET") {
        const contact = knownContacts.get(decodeURIComponent(path.slice("/contacts/".length)));
        return contact ? Response.json(contact) : new Response(null, { status: 404 });
      }
      assert.match(path, new RegExp(`/segments/${audience.LEARNING_EMAIL_SEGMENT_ID}$`));
      assert.equal(init.body, undefined, "membership sync never writes global subscription fields");
      const contactId = path.split("/")[2];
      if (init.method === "POST") membership.add(contactId);
      else { assert.equal(init.method, "DELETE"); membership.delete(contactId); }
      if (membershipHook) await membershipHook(init.method);
      return Response.json({ id: contactId });
    },
  });
  await assert.rejects(synchronize({ database, provider: consentProvider, userId: teacher }), /activation/);
  await setPreference(teacher, true);
  const syncInput = { database, provider: consentProvider, userId: teacher, enabled: true };
  const competing = await Promise.all([synchronize(syncInput), synchronize(syncInput)]);
  assert.ok(competing.some(result => result.state === "synchronized"));
  assert.ok(competing.some(result => result.state === "busy" || result.state === "up_to_date"));
  assert.equal(membership.has(providerTeacherId), true);
  assert.equal(consentRequests.filter(row => row.method === "POST").length, 1);
  await setPreference(teacher, false); await synchronize(syncInput);
  assert.equal(membership.has(providerTeacherId), false, "opt-out removes Learning membership only");
  teacherContact.unsubscribed = true;
  await setPreference(teacher, true);
  assert.equal((await synchronize(syncInput)).state, "globally_suppressed");
  assert.equal(membership.has(providerTeacherId), false);
  assert.equal(teacherContact.unsubscribed, true, "local re-consent cannot undo global unsubscribe");
  teacherContact.unsubscribed = false; // fake external state only, never a transport operation
  await setPreference(teacher, false); await synchronize(syncInput); await setPreference(teacher, true);
  membershipHook = async method => { if (method === "POST") { membershipHook = null; await setPreference(teacher, false); } };
  assert.equal((await synchronize(syncInput)).state, "stale");
  assert.equal(membership.has(providerTeacherId), false, "new opt-out compensates a stale add before releasing ownership");
  await synchronize(syncInput);
  await setPreference(teacher, true);
  membershipHook = async () => { throw new Error("lost provider response"); };
  assert.equal((await synchronize(syncInput)).state, "needs_review");
  assert.equal((await synchronize(syncInput)).state, "busy", "uncertain remote write retains non-expiring lease");
  const held = (await query("select holder from learning_email_segment_lease"))[0].holder;
  assert.notEqual(held, null);
  membershipHook = null;
  // Fixture-only reconciliation after verifying the fake provider state.
  assert.equal(await consentProvider.isMember(providerTeacherId), true);
  await query("select release_learning_email_segment($1)", [held]);
  await synchronize(syncInput);
  const newTeacherId = "40000000-0000-4000-8000-000000000002";
  knownContacts.set("new-teacher@example.invalid", { id: newTeacherId, email: "new-teacher@example.invalid", unsubscribed: false });
  await query("update auth.users set email='new-teacher@example.invalid' where id=$1", [teacher]);
  assert.equal((await synchronize(syncInput)).state, "synchronized");
  assert.equal(membership.has(providerTeacherId), false, "confirmed email change removes the old provider membership");
  assert.equal(membership.has(newTeacherId), true);
  const beforeMissing = consentRequests.length;
  await setPreference(learner, false); await setPreference(learner, true);
  assert.equal((await synchronize({ ...syncInput, userId: learner })).state, "awaiting_contact_import");
  assert.ok(consentRequests.slice(beforeMissing).every(row => row.method === "GET"), "missing contacts are not silently imported");
  const worker = load("email-center-account-worker").deliverLearningAccountNotice;
  let sends = 0;
  const transport = load("email-center-resend").createEmailCenterResendTransport({
    transactionalKey: "re_fixture_transactional", senders: { support: "support@growvelt.com" }, verifiedDomains: ["growvelt.com"], allowProviderWrites: true,
    request: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer re_fixture_transactional");
      if (url === "https://api.resend.com/usage") { usageReads++; assert.equal(init.method, "GET"); assert.equal(init.redirect, "error"); return Response.json(usagePayload); }
      sends++; assert.equal(url, "https://api.resend.com/emails"); assert.deepEqual(JSON.parse(init.body).to, ["learner@example.invalid"]); assert.match(init.headers["Idempotency-Key"], /^learning-center-/); return Response.json({ id: contactId });
    },
  });
  const draftId = await reviewedDraft(1);
  const input = { database, transport, actorId: operator, draftId, revision: 1, targetUserId: learner };
  await assert.rejects(worker(input), /activation/);
  assert.equal((await worker({ ...input, enabled: true })).state, "budget_blocked");
  assert.equal(sends, 0, "default budget prevents provider access");
  assert.equal(usageReads, 0, "closed local allowance does not query shared usage");
  await query("update learning_email_center_budget_policy set daily_limit=1,monthly_limit=2,approved_by=$1,updated_at=now(),approved_until=now()+interval '10 minutes'", [operator]);
  const second = await reviewedDraft(2);
  const run = { ...input, draftId: second, enabled: true };
  await assert.rejects(worker({ ...run, revision: 2 }), /saved review/);
  await assert.rejects(worker({ ...run, targetUserId: other }), /saved review/);
  assert.equal((await worker(run)).state, "accepted");
  assert.equal((await worker(run)).state, "already_claimed");
  assert.equal(sends, 1);
  const third = await reviewedDraft(3);
  assert.equal((await worker({ ...run, draftId: third })).state, "budget_blocked");
  assert.equal(sends, 1, "daily allowance is enforced across campaigns");
  assert.equal((await query("select count(*)::int as n from learning_email_center_budget_reservations"))[0].n, 1);
  const fourth = await reviewedDraft(4);
  await query("update learning_email_center_budget_policy set daily_limit=2,approved_until=now()-interval '1 second'");
  assert.equal((await worker({ ...run, draftId: fourth })).state, "budget_blocked", "expired allocation is closed");
  await query("update learning_email_center_budget_policy set daily_limit=3,monthly_limit=1,updated_at=now(),approved_until=now()+interval '10 minutes'");
  const fifth = await reviewedDraft(5);
  assert.equal((await worker({ ...run, draftId: fifth })).state, "budget_blocked", "monthly allowance is enforced independently");
  await query("update learning_email_center_budget_policy set daily_limit=10,monthly_limit=10");
  const lost = await reviewedDraft(6);
  const uncertain = { ...run, draftId: lost, transport: { ...transport, sendTransactional: async () => { sends++; throw new Error("uncertain provider response"); } } };
  assert.equal((await worker(uncertain)).state, "needs_review");
  assert.equal((await worker(uncertain)).state, "already_claimed");
  assert.equal(sends, 2, "uncertain provider response never sends again on retry");
  const stranded = await reviewedDraft(7);
  const brokenDatabase = { ...database, rpc: async (name, args) => name === "complete_learning_email_center_attempt" ? { data: null, error: new Error("fixture database down") } : database.rpc(name, args) };
  await assert.rejects(worker({ ...run, draftId: stranded, database: brokenDatabase }), /database review/);
  assert.equal((await worker({ ...run, draftId: stranded })).state, "already_claimed");
  assert.equal(sends, 3, "acceptance followed by audit-write failure never sends twice");
  const noUsage = await reviewedDraft(8);
  assert.equal((await worker({ ...run, draftId: noUsage, transport: { ...transport, readSharedUsage: async () => { throw new Error("provider usage unavailable"); } } })).state, "budget_blocked");
  assert.equal(sends, 3, "unverified shared usage blocks sending even with a local reservation");
  const lowUsage = await reviewedDraft(9);
  assert.equal((await worker({ ...run, draftId: lowUsage, transport: { ...transport, readSharedUsage: async () => usageTools.parseEmailCenterProviderUsage({ ...usagePayload, emails: { ...usagePayload.emails, monthly: { used: 2750, limit: 3000 } } }) } })).state, "budget_blocked");
  assert.equal(sends, 3, "shared monthly headroom is preserved");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(setPreference(teacher, true), /permission denied/);
    await assert.rejects(query("select * from learning_email_consent_sync"), /permission denied/);
    await assert.rejects(query("select * from learning_email_center_budget_policy"), /permission denied/);
    await assert.rejects(query("select mark_learning_email_consent_synchronized($1,3,true)", [learner]), /permission denied/);
    await db.exec("reset role");
  }
  console.log("PASS local consent/audience/budget/worker integration: versioned audit/outbox, unsubscribe/re-consent, Learning-only exact membership, global suppression, closed caps, one accepted fake send, duplicate protection, cross-campaign allowance, expiry and private grants. No hosted/provider calls.");
} finally { await db.close(); }
