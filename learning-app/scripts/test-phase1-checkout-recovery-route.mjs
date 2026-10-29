// Route-level recovery fixtures. All provider and database operations are mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { classifyPaystackCheckoutRecovery, PaystackVerificationError } from '../app/lib/payments/paystack-core.ts';

const require = createRequire(import.meta.url);
const source = fs.readFileSync('app/api/payments/paystack/initialize/route.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const reference = `GL-${'A'.repeat(32)}`;
const callbackUrl = 'https://learn.growvelt.com/payments/paystack/callback';

async function runScenario(scenario) {
  const calls = { orders: 0, verifications: 0, providerStarts: 0, failures: 0, reconciliations: 0, pendingMarks: 0 };
  const order = { order_id: 12, order_reference: reference, payment_attempt_id: 15, amount_minor: 10000, currency: 'NGN' };
  const query = table => ({
    select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; },
    async maybeSingle() {
      if (table === 'learning_orders') return { data: { id: 12, order_reference: reference, status: 'payment_pending' }, error: null };
      if (table === 'learning_payment_attempts') return { data: { status: 'pending', paystack_domain: 'live', initialized_at: scenario.initializedAt ?? '2026-10-27T10:00:00.000Z' }, error: null };
      throw Error(`Unexpected table ${table}`);
    },
  });
  const admin = {
    from: query,
    async rpc(name) {
      if (name === 'initialize_paystack_live_learning_order') {
        calls.orders++;
        return scenario.duplicate && calls.orders === 1 ? { data: null, error: { code: '23505' } } : { data: [order], error: null };
      }
      if (name === 'fail_paystack_live_learning_attempt') { calls.failures++; return { error: null }; }
      if (name === 'mark_paystack_live_learning_attempt_pending') { calls.pendingMarks++; return { error: null }; }
      if (name === 'reconcile_own_paystack_learning_payment') { calls.reconciliations++; return { data: [{ outcome: 'already_processed' }], error: null }; }
      throw Error(`Unexpected RPC ${name}`);
    },
  };
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, { exports: loadedModule.exports, URL, console, process: { env: {} }, require(id) {
    if (id === 'next/server') return require('next/server');
    if (id.endsWith('/supabase/server')) return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'learner-fixture', email: 'learner@example.invalid' } } }) } }) };
    if (id.endsWith('/supabase/admin')) return { createAdminClient: () => admin };
    if (id.endsWith('/security/request-origin')) return { isSameOriginRequest: () => true };
    if (id.endsWith('/payments/paystack-config')) return { paystackCallbackForRequest: () => callbackUrl };
    if (id.endsWith('/email/payment-notifications')) return { getOrderNotificationContext: async () => null, sendPaymentNotification: async () => {} };
    if (id.endsWith('/payments/paystack')) return {
      classifyPaystackCheckoutRecovery,
      PaystackVerificationError,
      getPaystackConfig: () => ({ mode: 'live', callbackUrl, liveLearnerCheckoutEnabled: true }),
      getPaystackTestConfig: () => { throw Error('Test checkout must not be used'); },
      initializePaystackLiveTransaction: async () => { calls.providerStarts++; return { authorizationUrl: 'https://checkout.paystack.com/fixture' }; },
      initializePaystackTestTransaction: async () => { throw Error('Test checkout must not be used'); },
      verifyPaystackTransaction: async () => {
        calls.verifications++;
        if (scenario.verificationError) throw new PaystackVerificationError(scenario.verificationError);
        return { status: scenario.verifiedStatus, reference, domain: 'live', transactionId: '123', amountMinor: 10000, requestedAmountMinor: 10000, feesMinor: 0, currency: 'NGN', paidAt: null };
      },
    };
    return require(id);
  } });
  const request = new Request('https://learn.growvelt.com/api/payments/paystack/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: 42 }) });
  const response = await loadedModule.exports.POST(request);
  return { status: response.status, body: await response.json(), calls };
}

const fresh = await runScenario({ duplicate: false });
assert.equal(fresh.status, 200);
assert.equal(fresh.calls.providerStarts, 1);
assert.equal(fresh.calls.pendingMarks, 1);

const recent = await runScenario({ duplicate: true, verifiedStatus: 'abandoned', initializedAt: new Date(Date.now() - 60_000).toISOString() });
assert.equal(recent.status, 409);
assert.match(recent.body.message, /30 minutes after you started checkout/);
assert.equal(recent.calls.providerStarts, 0);
assert.equal(recent.calls.failures, 0);

for (const status of ['abandoned', 'failed']) {
  const stale = await runScenario({ duplicate: true, verifiedStatus: status });
  assert.equal(stale.status, 200);
  assert.equal(stale.calls.failures, 1);
  assert.equal(stale.calls.orders, 2);
  assert.equal(stale.calls.providerStarts, 1);
}

const pending = await runScenario({ duplicate: true, verifiedStatus: 'pending' });
assert.equal(pending.status, 409);
assert.equal(pending.calls.providerStarts, 0);
assert.equal(pending.calls.failures, 0);

for (const reason of ['not_found', 'configuration', 'temporary', 'inconclusive']) {
  const uncertain = await runScenario({ duplicate: true, verificationError: reason });
  assert.equal(uncertain.status, 409);
  assert.equal(uncertain.body.reason, reason);
  assert.equal(uncertain.calls.providerStarts, 0);
  assert.equal(uncertain.calls.failures, 0);
}

const paid = await runScenario({ duplicate: true, verifiedStatus: 'success' });
assert.equal(paid.status, 200);
assert.equal(paid.body.outcome, 'already_processed');
assert.equal(paid.calls.reconciliations, 1);
assert.equal(paid.calls.providerStarts, 0);
assert.equal(paid.calls.failures, 0);

console.log('PASS: fresh checkout, abandoned/failed cooldown and retry, pending and uncertain verification, and verified-payment recovery without external requests.');
