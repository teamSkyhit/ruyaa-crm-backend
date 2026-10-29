/**
 * E2E: Counter → Store → User → PIN login flow
 * Run: node scripts/validate-counter-pin-flow.js
 */
const http = require('http');
const BASE = 'http://localhost:8000/api';

function request(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

let passed = 0, failed = 0;
function check(label, condition, extra = '') {
  if (condition) { console.log(`  [PASS] ${label}${extra ? ' | ' + extra : ''}`); passed++; }
  else           { console.log(`  [FAIL] ${label}${extra ? ' | ' + extra : ''}`); failed++; }
}

async function run() {
  console.log('\n=================================================');
  console.log('  Counter → User → PIN Flow Validation');
  console.log('=================================================\n');

  // ── Admin login ────────────────────────────────────────────────────────────
  const lr = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@unitrack.local', password: 'Admin@123' }),
  });
  check('Admin login', lr.status === 200, `status=${lr.status}`);
  if (lr.status !== 200) { console.log('Cannot proceed.'); return; }
  const token = lr.body.data.token;
  const H = { Authorization: 'Bearer ' + token };

  // ── Get a store and counter ────────────────────────────────────────────────
  console.log('\n--- Setup: Get store + counter ---');
  const storesRes = await request('/stores', { headers: H });
  check('GET /stores returns 200', storesRes.status === 200);
  const stores = storesRes.body.data || [];
  if (stores.length === 0) { console.log('  [SKIP] No stores — create a store first'); process.exit(0); }
  const store = stores[0];
  console.log(`  Using store: ${store.name} (${store.id})`);

  const countersRes = await request(`/counters?storeId=${store.id}`, { headers: H });
  check('GET /counters returns 200', countersRes.status === 200);
  const counters = countersRes.body.data || [];
  if (counters.length === 0) { console.log('  [SKIP] No counters for store — create one first'); process.exit(0); }
  const counter = counters[0];
  console.log(`  Using counter: ${counter.name} (${counter.id})`);

  // ── Create a test user assigned to the store ───────────────────────────────
  console.log('\n--- User: create with storeId ---');
  const testEmail = `e2e-pin-test-${Date.now()}@test.local`;
  const createRes = await request('/users', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      name: 'E2E PIN Cashier',
      email: testEmail,
      password: 'Test@1234',
      role: 'USER',
      storeId: store.id,
    }),
  });
  check('Create user with storeId returns 201', createRes.status === 201, `status=${createRes.status}`);
  check('storeId preserved in response', createRes.body.data?.storeId === store.id);
  const testUser = createRes.body.data;

  // ── GET /users?storeId filter ──────────────────────────────────────────────
  console.log('\n--- Users: storeId filter ---');
  const filteredRes = await request(`/users?storeId=${store.id}`, { headers: H });
  check('GET /users?storeId returns 200', filteredRes.status === 200);
  const inStore = (filteredRes.body.data || []).some((u) => u.id === testUser.id);
  check('New user appears in store-filtered list', inStore);
  const outOfStore = (filteredRes.body.data || []).every((u) => u.storeId === store.id);
  check('All users in filtered list belong to the store', outOfStore);

  // ── Set PIN for test user ──────────────────────────────────────────────────
  console.log('\n--- PIN: set for store user ---');
  const TEST_PIN = '741852';
  const setPinRes = await request(`/users/${testUser.id}/pin`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ pin: TEST_PIN }),
  });
  check('SET PIN returns 200', setPinRes.status === 200, `status=${setPinRes.status}`);

  // Verify PIN shown as true in users list
  const usersAfterPin = await request(`/users?storeId=${store.id}`, { headers: H });
  const pinUser = (usersAfterPin.body.data || []).find((u) => u.id === testUser.id);
  check('pin boolean is true after set', pinUser?.pin === true);

  // ── PIN login via counter ──────────────────────────────────────────────────
  console.log('\n--- POS: login via PIN + counterId ---');
  const pinLoginRes = await request('/auth/login-pin', {
    method: 'POST',
    body: JSON.stringify({ pin: TEST_PIN, counterId: counter.id }),
  });
  check('PIN login returns 200', pinLoginRes.status === 200, `status=${pinLoginRes.status}`);
  check('Token returned', typeof pinLoginRes.body.data?.token === 'string');
  check('Correct user returned', pinLoginRes.body.data?.user?.id === testUser.id);

  // Wrong PIN → 401
  const wrongPinRes = await request('/auth/login-pin', {
    method: 'POST',
    body: JSON.stringify({ pin: '000000', counterId: counter.id }),
  });
  check('Wrong PIN returns 401', wrongPinRes.status === 401, `status=${wrongPinRes.status}`);

  // Cross-store: create another store and try using PIN there
  if (stores.length >= 2) {
    const otherStore = stores[1];
    const otherCountersRes = await request(`/counters?storeId=${otherStore.id}`, { headers: H });
    const otherCounters = otherCountersRes.body.data || [];
    if (otherCounters.length > 0) {
      const otherCounter = otherCounters[0];
      const crossStoreRes = await request('/auth/login-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: TEST_PIN, counterId: otherCounter.id }),
      });
      check(
        'PIN from store A rejected at counter of store B (401)',
        crossStoreRes.status === 401,
        `status=${crossStoreRes.status}`
      );
    } else {
      console.log('  [SKIP] No counter in second store for cross-store PIN test');
    }
  } else {
    console.log('  [SKIP] Only one store — cross-store test skipped');
  }

  // ── Update user storeId ────────────────────────────────────────────────────
  console.log('\n--- User: update storeId ---');
  const updateStoreRes = await request(`/users/${testUser.id}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ storeId: null }),
  });
  check('Clear storeId returns 200', updateStoreRes.status === 200, `status=${updateStoreRes.status}`);
  check('storeId is null after clear', updateStoreRes.body.data?.storeId === null);

  // ── Cleanup: delete test user ──────────────────────────────────────────────
  await request(`/users/${testUser.id}`, { method: 'DELETE', headers: H });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('=================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Validation error:', e.message);
  process.exit(1);
});
