/**
 * Post-fix validation script
 * Tests: BUG-002, BUG-003, BUG-007 (live API)
 * Run: node scripts/validate-fixes.js
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
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function check(label, condition, extra = '') {
  if (condition) {
    console.log(`  [PASS] ${label}${extra ? ' | ' + extra : ''}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}${extra ? ' | ' + extra : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n=================================================');
  console.log('  Bug Fix Validation — UniTrack Backend');
  console.log('=================================================\n');

  // Login
  const lr = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@unitrack.local', password: 'Admin@123' }),
  });
  check('Admin login succeeds', lr.status === 200, `status=${lr.status}`);
  if (lr.status !== 200) { console.log('Cannot proceed without auth.'); return; }
  const token = lr.body.data.token;
  const H = { Authorization: 'Bearer ' + token };

  // ─── BUG-002: Notification Auth ───────────────────────────────────────────
  console.log('\n--- BUG-002: Notification Auth & Scoping ---');

  const noAuth = await request('/notifications');
  check('No-auth returns 401', noAuth.status === 401, `got ${noAuth.status}`);

  const withAuth = await request('/notifications', { headers: H });
  check('Valid token returns 200', withAuth.status === 200, `got ${withAuth.status}`);
  check('Returns array', Array.isArray(withAuth.body.data));
  check('success:true present', withAuth.body.success === true);

  // ─── BUG-003: Stock check at consolidation ────────────────────────────────
  console.log('\n--- BUG-003: Consolidation stock re-check ---');

  // Get stores and counters
  const storeRes = await request('/stores', { headers: H });
  const stores = storeRes.body.data || [];
  const counterRes = await request('/counters', { headers: H });
  const counters = counterRes.body.data || [];
  const prodRes = await request('/products?limit=1&grouped=false', { headers: H });
  const products = prodRes.body.data?.data || prodRes.body.data || [];

  if (!stores.length || !counters.length || !products.length) {
    console.log('  [SKIP] No store/counter/product data available for consolidation test');
  } else {
    // Try to consolidate a fake orderId — should get 404 (not crash)
    const fakeConsolidate = await request('/orders/consolidate', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        orderIds: ['00000000-0000-0000-0000-000000000001'],
        billingCounterId: counters[0].id,
        storeId: stores[0].id,
      }),
    });
    check(
      'Consolidation with non-existent orders returns 404/400 (not 500)',
      fakeConsolidate.status === 404 || fakeConsolidate.status === 400,
      `got ${fakeConsolidate.status}`
    );
  }

  // ─── BUG-007: Idempotency on createSale ──────────────────────────────────
  console.log('\n--- BUG-007: Sale Creation Idempotency ---');

  const product = products[0];
  const store = stores[0];

  if (!product || !store) {
    console.log('  [SKIP] No product/store data for idempotency test');
  } else {
    const price = parseFloat(String(product.price || product.mrp || product.salePrice || 100));
    const idKey = 'validate-fix-' + Date.now();
    const saleBody = JSON.stringify({
      items: [{ productId: product.id, quantity: 1 }],
      storeId: store.id,
      payments: [{ method: 'CASH', amount: price }],
    });

    const r1 = await request('/sales', {
      method: 'POST',
      headers: { ...H, 'X-Idempotency-Key': idKey },
      body: saleBody,
    });
    const firstCallSuccess = r1.status === 200 || r1.status === 201;
    check('First call creates sale (200/201)', firstCallSuccess, `status=${r1.status}`);

    if (firstCallSuccess && !r1.body.idempotent) {
      const r2 = await request('/sales', {
        method: 'POST',
        headers: { ...H, 'X-Idempotency-Key': idKey },
        body: saleBody,
      });
      check('Replay returns 200 (not 201)', r2.status === 200, `got ${r2.status}`);
      check('Replay has idempotent:true', r2.body.idempotent === true, `got ${r2.body.idempotent}`);
      check(
        'Receipt number returned on replay',
        typeof r2.body.data?.saleNumber === 'string',
        `saleNumber=${r2.body.data?.saleNumber}`
      );
    } else if (r1.body.idempotent) {
      console.log('  [INFO] First call was already idempotent replay (key reused from prior run)');
    }
  }

  // ─── BUG-001: PIN endpoint (structural check) ─────────────────────────────
  console.log('\n--- BUG-001: PIN Login (structural check) ---');
  const pinRes = await request('/auth/login-pin', {
    method: 'POST',
    body: JSON.stringify({ pin: '000000', counterId: counters[0]?.id }),
  });
  check('Invalid PIN returns 401 (not 500)', pinRes.status === 401 || pinRes.status === 400, `got ${pinRes.status}`);
  check('Error message present', typeof pinRes.body.error === 'string');

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n=================================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('=================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Validation script error:', e.message);
  process.exit(1);
});
