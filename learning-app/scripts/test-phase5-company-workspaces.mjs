// UI-only fixtures. All backend dependencies are mocked; no data or payment writes.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url), cache = new Map();
let signedIn = true, role = 'owner', empty = false, noAssignments = false, billingAvailable = true, locale = 'en', adminReads = 0;
const env = { PAYSTACK_MODE: 'test', PAYMENTS_CHECKOUT_ENABLED: 'true' };
const workspace = { workspace_id: 7, name: 'Example Company', slug: 'example-company', workspace_status: 'active', membership_status: 'active', seat_limit: 25, active_member_count: 2, pending_invitation_count: 1 };
const member = { member_id: 'employee', full_name: 'Example Employee', email: 'employee@example.invalid', status: 'active', role: 'member', granted_at: '2026-01-01' };
const course = { course_id: 9, title: 'Spreadsheet skills', price_amount: 100, currency: 'NGN', provider_name: 'Example Academy', instructor_name: 'Example Instructor' };
const purchase = { purchase_id: 11, course_title: course.title, provider_name: course.provider_name, status: 'paid', seat_count: 2, unit_amount_minor: 10000, total_amount_minor: 20000, currency: 'NGN', created_at: 'bad-date' };
const assignment = { assignment_id: 13, assigned_user_id: 'employee', employee_name: member.full_name, employee_email: member.email, course_title: course.title, course_id: 9, course_slug: 'spreadsheet-skills', assignment_status: 'active', enrollment_status: 'active', progress_percent: 50, assigned_at: 'bad-date' };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { URL, process: { env }, exports: mod.exports, require(id) {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
    if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }), redirect() { throw Error('REDIRECT'); }, notFound() { throw Error('NOT_FOUND'); } };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id.endsWith('.css')) return {};
    if (id.endsWith('/language-provider')) return { useLanguage: () => ({ locale }) };
    if (id.endsWith('/supabase/server')) return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'fixture' } : null } }) } }) };
    if (id.endsWith('/supabase/admin')) return { createAdminClient: () => { adminReads++; return { from(table) { assert.equal(table, 'learning_company_paid_course_purchase_attempts'); return { select() { return { in(column, ids) { assert.equal(column, 'purchase_id'); assert.deepEqual(Array.from(ids), [11, 12]); return { order: async () => ({ data: [{ purchase_id: 11, provider_reference: 'CP_EXAMPLE', status: 'succeeded' }], error: null }) }; } }; } }; } }; } };
    if (id.endsWith('/company/workspaces')) return {
      getOwnCompanyWorkspaces: async () => empty ? [] : [{ ...workspace, membership_role: role }],
      getOwnCompanyInvitations: async () => empty ? [] : [{ invitation_id: 2, workspace_name: 'Inviting Company', role: 'member', expires_at: 'bad-date' }],
      getOwnCompanyAssignedCourses: async () => empty ? [] : [{ ...assignment, workspace_name: workspace.name }],
      getCompanyManagement: async () => ({ members: [member], invitations: [{ invitation_id: 3, invited_email: 'invite@example.invalid', role: 'member', status: 'pending', created_at: 'bad-date' }], courses: [course], paidCourses: [course], paidPurchases: [purchase, { ...purchase, purchase_id: 12, status: 'checkout_ready' }], assignments: noAssignments ? [] : [assignment], paidBillingAvailable: billingAvailable }),
    };
    if (id.startsWith('@/') || id.startsWith('.')) { const base = id.startsWith('@/') ? id.replace('@/', '') : path.resolve(path.dirname(file), id); return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts')); }
    return require(id);
  } });
  cache.set(file, mod.exports); return mod.exports;
}
const logic = load('app/lib/company/presentation.ts');
assert.equal(logic.companyDate('bad-date'), 'Date unavailable'); assert.equal(logic.companyDate(null), 'Date unavailable');
assert.equal(logic.displayProgress(Infinity), 0); assert.equal(logic.displayProgress(-5), 0); assert.equal(logic.displayProgress(104), 100);
assert.equal(logic.assignmentState(assignment), 'in_progress');
assert.equal(logic.assignmentState({ ...assignment, enrollment_status: null, progress_percent: 0 }), 'not_started');
assert.equal(logic.assignmentState({ ...assignment, progress_percent: 100 }), 'completed');
assert.equal(logic.assignmentState({ ...assignment, enrollment_status: 'completed', assignment_status: 'cancelled' }), 'cancelled');
assert.equal(logic.billingSnapshot([purchase, { ...purchase, status: 'checkout_ready' }]).paidMinor, 20000);
assert.equal(logic.billingSnapshot([purchase, { ...purchase, status: 'cancelled' }]).seats, 2);
const pages = ['page.tsx', 'billing/page.tsx', 'reports/page.tsx', 'insights/page.tsx'].map(file => load('app/dashboard/company/' + file).default);
const args = () => ({ searchParams: Promise.resolve({ assignment: '13' }) });
for (locale of ['en', 'fr', 'es']) for (const Page of pages) {
  const html = renderToStaticMarkup(await Page(args()));
  assert.equal((html.match(/<h1\b/g) || []).length, 1); assert.doesNotMatch(html, /NaN|undefined|Invalid Date/);
}
let html = renderToStaticMarkup(await pages[0](args()));
assert.match(html, /Invite employee/); assert.match(html, /Assign course/); assert.match(html, /Resume test checkout/);
assert.equal((html.match(/href="\/dashboard\/company\/reports"/g) || []).length, 1);
env.PAYSTACK_MODE = 'live'; html = renderToStaticMarkup(await pages[0](args())); assert.doesNotMatch(html, /Resume test checkout|Continue to secure test checkout/);
env.PAYSTACK_MODE = 'test'; env.PAYMENTS_CHECKOUT_ENABLED = 'false'; assert.doesNotMatch(renderToStaticMarkup(await pages[0](args())), /Resume test checkout/); env.PAYMENTS_CHECKOUT_ENABLED = 'true';
billingAvailable = false; assert.match(renderToStaticMarkup(await pages[0](args())), /paid-learning setup is being activated/); billingAvailable = true;
role = 'member'; adminReads = 0;
html = renderToStaticMarkup(await pages[0](args())); assert.doesNotMatch(html, /Invite employee|Assign course|Remove member|Buy paid learning for employees|Employee reports|Purchase history/);
html = renderToStaticMarkup(await pages[1](args())); assert.doesNotMatch(html, /CP_EXAMPLE|Spreadsheet skills/); assert.equal(adminReads, 0);
assert.match(renderToStaticMarkup(await pages[2](args())), /No assigned learning yet/);
await assert.rejects(() => pages[3](args()), /NOT_FOUND/);
role = 'admin'; assert.match(renderToStaticMarkup(await pages[1](args())), /CP_EXAMPLE/);
role = 'owner'; noAssignments = true; assert.match(renderToStaticMarkup(await pages[2](args())), /No assigned learning yet/); noAssignments = false;
empty = true;
for (const Page of pages.slice(0, 3)) { html = renderToStaticMarkup(await Page(args())); assert.doesNotMatch(html, /NaN|undefined|Invalid Date/); }
await assert.rejects(() => pages[3](args()), /NOT_FOUND/); empty = false;
for (const id of ['0', '-1', 'bad', '9007199254740993', '14']) await assert.rejects(() => pages[3]({ searchParams: Promise.resolve({ assignment: id }) }), /NOT_FOUND/);
signedIn = false; for (const Page of pages) await assert.rejects(() => Page(args()), /REDIRECT/);
const controls = fs.readFileSync('app/components/company/workspace-controls.tsx', 'utf8');
assert.match(controls, /if \(pending \|\| !course \|\| selectedMembers.length === 0\) return/);
assert.match(controls, /if \(checkoutEnabled\)/); assert.match(controls, /member.status === "active" && member.role !== "owner"/);
assert.match(controls, /<ConfirmationDialog title=\{\x60Remove/); assert.match(controls, /onConfirm=\{cancel\}/);
console.log('PASS: company pages, authorized billing reference scope, manager/member/auth guards, Test Mode UI gates, pending/paid totals, report states, dates, bounds and empty states. No external requests.');
