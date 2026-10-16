// Isolated rendering and mocked handler tests: no database, Storage or provider calls.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
let approved = true, role = 'owner', empty = false, verified = 'pending', locale = 'en';
let profileSaved = true;
const organization = { organization_id: 9, name: 'Example Training Academy', slug: 'example-academy', organization_status: 'active', membership_status: 'active' };
const profile = { headline: 'Practical business training', description: 'A'.repeat(100), contact_email: 'training@example.invalid', logo_storage_path: null, cover_storage_path: null };
const member = { member_id: 'example', full_name: 'Example Instructor', email: 'instructor@example.invalid', role: 'instructor', status: 'active', granted_at: '2026-01-01' };
const course = { course_id: 1, title: 'Spreadsheet skills', instructor_name: 'Example Instructor', status: 'published' };
const verification = () => ({ organization_id: 9, status: verified, reviewed_at: null, contact_email: 'training@example.invalid', verification_statement: 'Example statement for an isolated fixture.' });
const payout = { payout_profile_id: 1, status: 'active', provider_domain: 'test', account_name: 'EXAMPLE', bank_name: 'Example bank', account_last4: '0000', recipient_code: 'RCP_EXAMPLE', disabled_at: null };

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(js, { URL, exports: mod.exports, require(id) {
    if (id === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {}, push() {} }), notFound() { throw Error('NOT_FOUND'); }, redirect() { throw Error('REDIRECT'); } };
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id.endsWith('/language-provider')) return { useLanguage: () => ({ locale }) };
    if (id.endsWith('/instructor/authorization')) return { isApprovedInstructor: async () => approved };
    if (id.endsWith('/instructor/organizations')) return {
      getOwnInstructorOrganizations: async () => empty ? [] : [{ ...organization, membership_role: role }],
      getOwnInstructorOrganizationInvitations: async () => empty ? [] : [{ invitation_id: 2, organization_name: 'Example invitation', expires_at: 'bad-date', role: 'instructor' }],
      getOwnInstructorOrganizationVerifications: async () => [verification()],
      getOwnInstructorOrganizationProfiles: async () => profileSaved ? [{ organization_id: 9, ...profile }] : [],
      getOwnInstructorOrganizationProfileBranding: async () => profileSaved ? profile : null,
      getInstructorOrganizationManagement: async () => ({ members: [member], courses: empty ? [] : [course], invitations: [{ invitation_id: 3, invited_email: 'invite@example.invalid', created_at: 'bad-date', status: 'pending', role: 'instructor' }] }),
    };
    if (id.endsWith('/instructor/provider-insights')) return { getOwnProviderOrganizationInsights: async () => ({ courses: empty ? [] : [{ courseId: 1, title: course.title, status: 'published', enrolledLearnerCount: 2, activeLearnerCount: 1, completedLearnerCount: 1, completionRate: 50, issuedCertificateCount: 1, paidOrderCount: 1, reversedOrderCount: 1, grossSalesMinor: 10000, lastEnrolledAt: null, lastSaleAt: 'bad-date' }], totalEnrolledLearners: 2, totalCompletedLearners: 1, overallCompletionRate: 50, totalIssuedCertificates: 1, totalGrossSalesMinor: 10000 }) };
    if (id.endsWith('/instructor/payout-profile')) return { getOwnInstructorPayoutProfiles: async () => empty ? [] : [payout, { ...payout, payout_profile_id: 2, status: 'disabled', provider_domain: 'live', disabled_at: 'bad-date' }] };
    if (id.endsWith('/supabase/server')) return { createClient: async () => ({ storage: { from() { throw Error('Unexpected Storage request'); } } }) };
    if (id.endsWith('/supabase/browser')) return { createClient() { throw Error('Unexpected backend request'); } };
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? id.replace('@/', '') : path.resolve(path.dirname(file), id);
      return load(base + (fs.existsSync(base + '.tsx') ? '.tsx' : '.ts'));
    }
    return require(id);
  } });
  cache.set(file, mod.exports);
  return mod.exports;
}

const logic = load('app/lib/instructor/provider-workspaces.ts');
assert.equal(logic.providerDate(null), 'Date unavailable');
assert.equal(logic.providerDate('bad-date'), 'Date unavailable');
assert.match(logic.providerDate('2026-10-16T23:30:00-03:00'), /17 Oct 2026/);
assert.equal(logic.providerSetupChecklist(null, false).filter(item => item.complete).length, 0);
assert.equal(logic.providerSetupChecklist(profile, true).filter(item => item.complete).length, 2);
const files = ['organizations/page.tsx', 'organizations/[organizationId]/profile/page.tsx', 'organizations/[organizationId]/insights/page.tsx', 'payout-profile/page.tsx'];
const pages = files.map(file => load('app/dashboard/instructor/' + file).default);
const args = () => ({ params: Promise.resolve({ organizationId: '9' }) });
for (locale of ['en', 'fr', 'es']) {
  for (const Page of pages) {
    const html = renderToStaticMarkup(await Page(args()));
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(html, /NaN|undefined|Invalid Date/);
  }
}
let html = renderToStaticMarkup(await pages[0](args()));
assert.match(html, /Invite instructor/); assert.match(html, /Remove member/); assert.match(html, /Cancel invitation/);
assert.doesNotMatch(html, /Create organization<\/button>/);
role = 'instructor';
html = renderToStaticMarkup(await pages[0](args()));
assert.doesNotMatch(html, /Invite instructor<\/button>|Remove member<\/button>|Cancel invitation<\/button>|Manage provider profile/);
await assert.rejects(() => pages[1](args()), /NOT_FOUND/);
assert.match(renderToStaticMarkup(await pages[2](args())), /course enrollments/);
role = 'owner';
for (verified of ['pending', 'rejected', 'verified']) {
  html = renderToStaticMarkup(await pages[1](args()));
  for (const anchor of ['provider-details', 'provider-branding', 'provider-verification']) {
    assert.match(html, new RegExp(`id="${anchor}"`)); assert.match(html, new RegExp(`href="#${anchor}"`));
  }
  assert.equal(html.includes('Preview provider profile'), verified === 'verified');
  assert.equal(html.includes('Submit for verification'), false); // Existing rejected/pending/verified fixture states.
  assert.equal(html.includes('Resubmit verification'), verified === 'rejected');
  assert.match(html, /aria-label="Change logo"/);
  assert.doesNotMatch(html, /class="provider-manager-logo" aria-hidden/);
}
profileSaved = false;
assert.match(renderToStaticMarkup(await pages[1](args())), /before adding a cover image/);
empty = true;
assert.match(renderToStaticMarkup(await pages[0](args())), /Create organization<\/button>/);
assert.match(renderToStaticMarkup(await pages[3](args())), /No active Test recipient/);
assert.doesNotMatch(renderToStaticMarkup(await pages[3](args())), /Disable current profile/);
empty = false;
html = renderToStaticMarkup(await pages[3](args()));
assert.match(html, /Account ending in 0000 · Live Mode/); assert.match(html, /RCP_EXAMPLE/);
approved = false;
for (const Page of pages) await assert.rejects(() => Page(args()), /REDIRECT/);
approved = true;
for (const Page of [pages[1], pages[2]]) await assert.rejects(() => Page({ params: Promise.resolve({ organizationId: '-1' }) }), /NOT_FOUND/);

// Exercise payout handlers only against an in-memory fake transport and form.
const source = fs.readFileSync('app/components/instructor/payout-profile-form.tsx', 'utf8');
let request = null, resets = 0, refreshes = 0;
const handlerModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
  exports: handlerModule.exports,
  fetch: async (url, options) => { request = { url, ...options }; return { ok: true }; },
  FormData: class { constructor(form) { assert.equal(form.fixture, true); } get(name) { return name === 'accountNumber' ? '0000000000' : 'EXAMPLE'; } },
  require(id) {
    if (id === 'react') return { ...React, useState: value => [value, () => {}] };
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() { refreshes++; } }) };
    if (id.startsWith('@/')) return new Proxy({}, { get: (_, key) => ({ default: () => null, [key]: () => null })[key] });
    return require(id);
  },
});
function find(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) { const result = find(child, predicate); if (result) return result; }
  return null;
}
const tree = handlerModule.exports.PayoutProfileForm({ hasActiveProfile: true });
assert.equal(request, null);
const form = find(tree, element => element.type === 'form');
const event = { preventDefault() {}, currentTarget: { fixture: true, reset() { resets++; } } };
const result = form.props.onSubmit(event); event.currentTarget = null; await result;
assert.equal(resets, 1); assert.equal(refreshes, 1); assert.equal(request.method, 'POST');
assert.equal(request.credentials, 'same-origin');
request = null;
find(tree, element => element.type === 'button' && element.props.children === 'Disable current profile').props.onClick();
assert.equal(request, null, 'Opening disable confirmation must not send DELETE');
assert.match(source, /onConfirm=\{disable\}/); assert.match(source, /method: "DELETE", credentials: "same-origin"/);
console.log('PASS: provider pages, owner/member and approval guards, verification states, saved checklist/anchors, masked payout history, invalid dates and mocked payout form reset/confirmation. No external requests.');
