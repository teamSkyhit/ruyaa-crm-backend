/**
 * E2E validation: PIN endpoint + Device management endpoints
 * Run: node scripts/validate-pin-devices.js
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
  console.log('  PIN + Device Management Validation');
  console.log('=================================================\n');

  // ── Login ──────────────────────────────────────────────────────────────────
  const lr = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@unitrack.local', password: 'Admin@123' }),
  });
  check('Admin login', lr.status === 200, `status=${lr.status}`);
  if (lr.status !== 200) { console.log('Cannot proceed without auth.'); return; }
  const token = lr.body.data.token;
  const H = { Authorization: 'Bearer ' + token };

  // ── Users list (includes pin boolean) ─────────────────────────────────────
  console.log('\n--- Users API (pin field) ---');
  const usersRes = await request('/users', { headers: H });
  check('GET /users returns 200', usersRes.status === 200, `status=${usersRes.status}`);
  check('Response is array', Array.isArray(usersRes.body.data));
  if (Array.isArray(usersRes.body.data) && usersRes.body.data.length > 0) {
    const firstUser = usersRes.body.data[0];
    check('pin field is boolean (not hash)', typeof firstUser.pin === 'boolean', `pin=${firstUser.pin}`);
    check('passwordHash not exposed', firstUser.passwordHash === undefined);

    const targetUser = usersRes.body.data[0];

    // ── Set PIN ──────────────────────────────────────────────────────────────
    console.log('\n--- PIN Endpoint: PUT /api/users/:id/pin ---');

    // Invalid PIN (too short)
    const badPin = await request(`/users/${targetUser.id}/pin`, {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ pin: '12' }),
    });
    check('Short PIN returns 400', badPin.status === 400, `status=${badPin.status}`);

    // Invalid PIN (non-numeric)
    const alphaPin = await request(`/users/${targetUser.id}/pin`, {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ pin: 'abcd' }),
    });
    check('Non-numeric PIN returns 400', alphaPin.status === 400, `status=${alphaPin.status}`);

    // Valid 6-digit PIN
    const validPin = await request(`/users/${targetUser.id}/pin`, {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ pin: '123456' }),
    });
    check('Valid 6-digit PIN returns 200', validPin.status === 200, `status=${validPin.status}`);
    check('Success message present', validPin.body.success === true);

    // Valid 4-digit PIN (boundary)
    const fourDigit = await request(`/users/${targetUser.id}/pin`, {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ pin: '9999' }),
    });
    check('Valid 4-digit PIN returns 200', fourDigit.status === 200, `status=${fourDigit.status}`);

    // Non-existent user
    const ghostPin = await request('/users/00000000-0000-0000-0000-000000000001/pin', {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ pin: '1234' }),
    });
    check('Non-existent user returns 404', ghostPin.status === 404, `status=${ghostPin.status}`);

    // Verify PIN set reflected in users list
    const usersAfter = await request('/users', { headers: H });
    const updatedUser = (usersAfter.body.data || []).find((u) => u.id === targetUser.id);
    check('pin boolean is now true after set', updatedUser?.pin === true, `pin=${updatedUser?.pin}`);
  }

  // ── No-auth for PIN endpoint ───────────────────────────────────────────────
  console.log('\n--- PIN Endpoint: Auth guard ---');
  const noAuthPin = await request('/users/some-id/pin', {
    method: 'PUT',
    body: JSON.stringify({ pin: '1234' }),
  });
  check('No-auth PUT /pin returns 401', noAuthPin.status === 401, `status=${noAuthPin.status}`);

  // ── Device Management: GET /settings/devices ──────────────────────────────
  console.log('\n--- Device Management: GET /api/settings/devices ---');
  const devicesRes = await request('/settings/devices', { headers: H });
  check('GET /settings/devices returns 200', devicesRes.status === 200, `status=${devicesRes.status}`);
  check('Returns array of devices', Array.isArray(devicesRes.body.data));

  // ── Device Settings: GET + PUT /settings/device/:id ──────────────────────
  console.log('\n--- Device Settings: GET + PUT /api/settings/device/:id ---');
  const testDeviceId = 'e2e-test-device-001';

  const getDevice = await request(`/settings/device/${testDeviceId}`, { headers: H });
  check('GET /settings/device creates if absent (200)', getDevice.status === 200, `status=${getDevice.status}`);
  check('deviceId matches', getDevice.body.data?.deviceId === testDeviceId);

  const updateDevice = await request(`/settings/device/${testDeviceId}`, {
    method: 'PUT',
    headers: H,
    body: JSON.stringify({ deviceName: 'E2E Test Terminal', deviceType: 'BILLING' }),
  });
  check('PUT /settings/device returns 200', updateDevice.status === 200, `status=${updateDevice.status}`);
  check('deviceName saved correctly', updateDevice.body.data?.deviceName === 'E2E Test Terminal');

  // Verify it appears in list
  const devicesAfter = await request('/settings/devices', { headers: H });
  const found = (devicesAfter.body.data || []).find((d) => d.deviceId === testDeviceId);
  check('Updated device appears in device list', !!found, `found=${!!found}`);
  check('Device list reflects updated name', found?.deviceName === 'E2E Test Terminal');

  // No-auth guard
  const noAuthDevices = await request('/settings/devices');
  check('No-auth GET /settings/devices returns 401', noAuthDevices.status === 401, `status=${noAuthDevices.status}`);

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
