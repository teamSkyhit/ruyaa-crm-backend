/**
 * QA Validation: Store Settings — googleReviewUrl + instagramUrl
 *
 * Tests:
 *  1.  GET /settings/store/:id — returns existing settings (auto-creates if missing)
 *  2.  PUT /settings/store/:id — saves googleReviewUrl + instagramUrl
 *  3.  GET /settings/store/:id — fields persist correctly after save
 *  4.  PUT with invalid googleReviewUrl — rejected 400
 *  5.  PUT with invalid instagramUrl   — rejected 400
 *  6.  PUT with empty string for URLs  — accepted (clears the field)
 *  7.  PUT with null for URLs          — accepted (clears the field)
 *  8.  receiptFooter (footerText) saves and persists
 *  9.  Other store fields (name, address, contact, gstin) update via PUT /stores/:id
 * 10.  GET /stores returns store with name, address, contact, gstin
 */

const BASE = 'http://localhost:8000/api';

let passed = 0;
let failed = 0;
let token = '';
let storeId = '';

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function api(method, path, body, tok) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login() {
  const credentials = [
    { email: 'admin@unitrack.local', password: 'Admin@123' },
    { email: 'admin@unitrack.com',   password: 'Admin@123' },
    { email: 'admin@admin.com',      password: 'Admin@123' },
  ];
  for (const creds of credentials) {
    const { status, data } = await api('POST', '/auth/login', creds);
    if (status === 200 && data.data?.token) {
      token = data.data.token;
      return true;
    }
  }
  return false;
}

async function getFirstStore() {
  const { data } = await api('GET', '/stores', null, token);
  const stores = data?.data || [];
  if (stores.length > 0) {
    storeId = stores[0].id;
    return true;
  }
  return false;
}

async function run() {
  console.log('\n========================================');
  console.log('  Store Settings QR URLs — QA Validation');
  console.log('========================================\n');

  // Auth
  const loggedIn = await login();
  assert('Login succeeds', loggedIn, 'Check admin credentials');
  if (!loggedIn) { summary(); return; }

  // Store
  const hasStore = await getFirstStore();
  assert('At least one store exists', hasStore);
  if (!hasStore) { summary(); return; }
  console.log(`  ℹ️  Using storeId: ${storeId}\n`);

  // ── Test 1: GET returns settings (auto-creates if missing)
  console.log('── Test 1: GET store settings');
  const { status: s1, data: d1 } = await api('GET', `/settings/store/${storeId}`, null, token);
  assert('GET returns 200', s1 === 200, `got ${s1}`);
  assert('Response has success:true', d1.success === true);
  assert('Response has data object', typeof d1.data === 'object' && d1.data !== null);

  // ── Test 2: PUT saves googleReviewUrl + instagramUrl + receiptFooter
  console.log('\n── Test 2: PUT valid QR URLs and footer');
  const GOOGLE_URL = 'https://g.page/r/test-review-link';
  const INSTA_URL  = 'https://instagram.com/teststore';
  const FOOTER     = 'Thank You! Come Again';
  const { status: s2, data: d2 } = await api('PUT', `/settings/store/${storeId}`, {
    googleReviewUrl: GOOGLE_URL,
    instagramUrl:    INSTA_URL,
    receiptFooter:   FOOTER,
  }, token);
  assert('PUT returns 200', s2 === 200, `got ${s2}`);
  assert('PUT response success:true', d2.success === true);
  assert('googleReviewUrl saved correctly', d2.data?.googleReviewUrl === GOOGLE_URL, `got "${d2.data?.googleReviewUrl}"`);
  assert('instagramUrl saved correctly',    d2.data?.instagramUrl === INSTA_URL,       `got "${d2.data?.instagramUrl}"`);
  assert('receiptFooter saved correctly',   d2.data?.receiptFooter === FOOTER,         `got "${d2.data?.receiptFooter}"`);

  // ── Test 3: GET confirms persistence
  console.log('\n── Test 3: GET confirms persistence');
  const { data: d3 } = await api('GET', `/settings/store/${storeId}`, null, token);
  assert('googleReviewUrl persists', d3.data?.googleReviewUrl === GOOGLE_URL);
  assert('instagramUrl persists',    d3.data?.instagramUrl === INSTA_URL);
  assert('receiptFooter persists',   d3.data?.receiptFooter === FOOTER);

  // ── Test 4: Invalid googleReviewUrl rejected
  console.log('\n── Test 4: Invalid googleReviewUrl → 400');
  const { status: s4, data: d4 } = await api('PUT', `/settings/store/${storeId}`, {
    googleReviewUrl: 'not-a-url',
  }, token);
  assert('Invalid googleReviewUrl returns 400', s4 === 400, `got ${s4}`);
  assert('Error message present', typeof d4.error === 'string');

  // ── Test 5: Invalid instagramUrl rejected
  console.log('\n── Test 5: Invalid instagramUrl → 400');
  const { status: s5, data: d5 } = await api('PUT', `/settings/store/${storeId}`, {
    instagramUrl: 'instagram.com/nohttps',
  }, token);
  assert('Invalid instagramUrl returns 400', s5 === 400, `got ${s5}`);
  assert('Error message present', typeof d5.error === 'string');

  // ── Test 6: Empty string clears URL (accepted)
  console.log('\n── Test 6: Empty string clears URL');
  const { status: s6, data: d6 } = await api('PUT', `/settings/store/${storeId}`, {
    googleReviewUrl: '',
    instagramUrl:    '',
  }, token);
  assert('Empty string returns 200', s6 === 200, `got ${s6}`);
  // Empty string or null both acceptable for "cleared"
  assert('googleReviewUrl cleared (null or empty)', d6.data?.googleReviewUrl == null || d6.data?.googleReviewUrl === '');
  assert('instagramUrl cleared (null or empty)',    d6.data?.instagramUrl == null || d6.data?.instagramUrl === '');

  // ── Test 7: null clears URL
  console.log('\n── Test 7: null clears URL');
  // First re-set the URLs
  await api('PUT', `/settings/store/${storeId}`, { googleReviewUrl: GOOGLE_URL, instagramUrl: INSTA_URL }, token);
  const { status: s7, data: d7 } = await api('PUT', `/settings/store/${storeId}`, {
    googleReviewUrl: null,
    instagramUrl:    null,
  }, token);
  assert('null returns 200', s7 === 200, `got ${s7}`);
  assert('googleReviewUrl null after clear', d7.data?.googleReviewUrl == null);
  assert('instagramUrl null after clear',    d7.data?.instagramUrl == null);

  // ── Test 8: receiptFooter length limit (edge: 1 char, 200 chars, 201 chars) — backend is Text so no DB limit, just confirm it saves
  console.log('\n── Test 8: receiptFooter edge cases');
  const longFooter = 'A'.repeat(200);
  const { data: d8 } = await api('PUT', `/settings/store/${storeId}`, { receiptFooter: longFooter }, token);
  assert('200-char footer saves', d8.data?.receiptFooter === longFooter);

  // ── Test 9: Store core fields via PUT /stores/:id
  console.log('\n── Test 9: PUT /stores/:id updates name/address/contact/gstin');
  const { status: s9, data: d9 } = await api('PUT', `/stores/${storeId}`, {
    name:    'QA Test Store',
    address: '123 Test Street',
    contact: '+91 99999 99999',
    gstin:   'QATEST123456789',
  }, token);
  assert('PUT /stores returns 200', s9 === 200, `got ${s9} — ${JSON.stringify(d9)}`);
  if (s9 === 200) {
    const storeData = d9.data || d9;
    assert('name updated', storeData.name === 'QA Test Store');
    assert('address updated', storeData.address === '123 Test Street');
    assert('contact updated', storeData.contact === '+91 99999 99999');
    assert('gstin updated', storeData.gstin === 'QATEST123456789');
  }

  // ── Test 10: GET /stores returns those fields
  console.log('\n── Test 10: GET /stores includes name/address/contact/gstin');
  const { data: d10 } = await api('GET', '/stores', null, token);
  const store = (d10?.data || []).find(s => s.id === storeId);
  assert('Store present in list', !!store);
  if (store) {
    assert('name field present', typeof store.name === 'string');
    assert('address field present', store.address !== undefined);
    assert('contact field present', store.contact !== undefined);
    assert('gstin field present', store.gstin !== undefined);
  }

  summary();
}

function summary() {
  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
