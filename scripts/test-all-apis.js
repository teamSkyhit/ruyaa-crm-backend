/**
 * Comprehensive API Testing Script
 * Tests all endpoints and checks for latency issues
 * 
 * Usage: node scripts/test-all-apis.js
 * 
 * Prerequisites:
 * 1. Backend server must be running on http://localhost:8000
 * 2. Database must be seeded with test data
 * 3. Get admin token by logging in first
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000/api';
let authToken = '';

// Test results
const results = {
  passed: [],
  failed: [],
  slow: [], // APIs taking > 500ms
  errors: [],
};

// Helper function to make API calls
async function apiCall(method, endpoint, body = null, token = null) {
  const startTime = Date.now();
  const url = `${BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    return {
      status: response.status,
      data,
      duration,
      success: response.ok,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      status: 0,
      error: error.message,
      duration,
      success: false,
    };
  }
}

// Test function
async function test(name, method, endpoint, body = null, expectedStatus = 200) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${endpoint}`);
  
  const result = await apiCall(method, endpoint, body, authToken);
  
  if (result.success && result.status === expectedStatus) {
    if (result.duration > 500) {
      results.slow.push({
        name,
        endpoint,
        duration: result.duration,
      });
      console.log(`   ⚠️  SLOW: ${result.duration}ms (expected < 500ms)`);
    } else {
      results.passed.push({
        name,
        endpoint,
        duration: result.duration,
      });
      console.log(`   ✅ PASSED: ${result.duration}ms`);
    }
  } else {
    results.failed.push({
      name,
      endpoint,
      status: result.status,
      error: result.error || result.data?.error || result.data?.message,
    });
    console.log(`   ❌ FAILED: Status ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (result.data?.error) {
      console.log(`   Error: ${result.data.error}`);
    }
  }
}

// Main test suite
async function runTests() {
  console.log('🚀 Starting Comprehensive API Tests...\n');
  console.log('='.repeat(60));

  // Step 1: Login to get token
  console.log('\n📝 Step 1: Authentication');
  console.log('-'.repeat(60));
  
  const loginResult = await apiCall('POST', '/auth/login', {
    email: 'admin@unitrack.local',
    password: 'Admin@123',
  });

  if (!loginResult.success || !loginResult.data?.data?.token) {
    console.error('❌ Failed to login. Cannot proceed with tests.');
    console.error('Please ensure:');
    console.error('1. Backend server is running');
    console.error('2. Database is seeded');
    console.error('3. Admin user exists with email: admin@unitrack.local');
    process.exit(1);
  }

  authToken = loginResult.data.data.token;
  console.log('✅ Login successful');

  // Step 2: Test all endpoints
  console.log('\n📋 Step 2: Testing All Endpoints');
  console.log('-'.repeat(60));

  // Health Check
  await test('Health Check', 'GET', '/');

  // Products
  await test('Get All Products', 'GET', '/products');
  const productsResult = await apiCall('GET', '/products', null, authToken);
  if (productsResult.success && productsResult.data?.data?.length > 0) {
    const product = productsResult.data.data[0];
    const barcode = product.barcode;
    if (barcode) {
      // Use /find/:query endpoint for barcode lookup
      await test('Get Product by Barcode', 'GET', `/products/find/${barcode}`);
    }
  }
  // Search requires query parameter
  await test('Search Products', 'GET', '/products/search?query=iPhone', null, 200);

  // Categories
  await test('Get All Categories', 'GET', '/categories');

  // Stores
  await test('Get All Stores', 'GET', '/stores');
  const storesResult = await apiCall('GET', '/stores', null, authToken);
  if (storesResult.success && storesResult.data?.data?.length > 0) {
    const storeId = storesResult.data.data[0].id;
    await test('Get Store by ID', 'GET', `/stores/${storeId}`);
  }

  // Counters
  await test('Get All Counters', 'GET', '/counters');

  // Stock Transfers
  await test('Get All Stock Transfers', 'GET', '/stock-transfers');

  // Store Inventory
  if (storesResult.success && storesResult.data?.data?.length > 0) {
    const storeId = storesResult.data.data[0].id;
    await test('Get Store Inventory', 'GET', `/store-inventory/store/${storeId}`);
  }

  // Shifts
  await test('Get All Shifts', 'GET', '/shifts');
  const shiftsResult = await apiCall('GET', '/shifts', null, authToken);
  if (shiftsResult.success && shiftsResult.data?.data?.length > 0) {
    const shiftId = shiftsResult.data.data[0].id;
    await test('Get Shift by ID', 'GET', `/shifts/${shiftId}`);
    // Get counterId from shift for current shift test
    const counterId = shiftsResult.data.data[0].counterId;
    if (counterId) {
      await test('Get Current Shift', 'GET', `/shifts/current?counterId=${counterId}`);
    }
  }

  // Sales
  await test('Get All Sales', 'GET', '/sales');
  const salesResult = await apiCall('GET', '/sales?limit=5', null, authToken);
  if (salesResult.success && salesResult.data?.data?.length > 0) {
    const saleId = salesResult.data.data[0].id;
    await test('Get Sale by ID', 'GET', `/sales/${saleId}`);
    const saleNumber = salesResult.data.data[0].saleNumber;
    if (saleNumber) {
      await test('Get Receipt by Number', 'GET', `/sales/receipt/${saleNumber}`);
    }
  }

  // Payments - Get payments by sale ID
  const salesForPayments = await apiCall('GET', '/sales?limit=5', null, authToken);
  if (salesForPayments.success && salesForPayments.data?.data?.length > 0) {
    const saleId = salesForPayments.data.data[0].id;
    await test('Get Payments by Sale ID', 'GET', `/payments/sale/${saleId}`);
  }

  // Reports
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  await test('Sales Report', 'GET', `/reports/sales?startDate=${lastWeek}&endDate=${today}`);
  await test('GST Report', 'GET', `/reports/gst?startDate=${lastWeek}&endDate=${today}`);
  await test('Payment Mode Report', 'GET', `/reports/payment-mode?startDate=${lastWeek}&endDate=${today}`);
  await test('Inventory Report', 'GET', `/reports/inventory`);
  await test('Cash Reconciliation Report', 'GET', `/reports/cash-reconciliation?startDate=${lastWeek}&endDate=${today}`);
  await test('Counter-wise Report', 'GET', `/reports/counter-wise?startDate=${lastWeek}&endDate=${today}`);

  // Returns
  await test('Get All Returns', 'GET', '/returns');

  // Dashboard
  await test('Get Dashboard Metrics', 'GET', '/dashboard/metrics');
  await test('Get Low Stock Alert', 'GET', '/dashboard/low-stock');

  // Activity Logs
  await test('Get Activity Logs', 'GET', '/activity');

  // Users
  await test('Get All Users', 'GET', '/users');

  // Shelves
  await test('Get All Shelves', 'GET', '/shelves');

  // Step 3: Performance Tests
  console.log('\n⚡ Step 3: Performance Tests');
  console.log('-'.repeat(60));
  
  // Test with larger datasets
  await test('Get All Products (Large Dataset)', 'GET', '/products?limit=100');
  await test('Get All Sales (Large Dataset)', 'GET', '/sales?limit=100');
  await test('Sales Report (Large Date Range)', 'GET', `/reports/sales?startDate=2024-01-01&endDate=${today}`);

  // Step 4: Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Slow (>500ms): ${results.slow.length}`);
  
  if (results.slow.length > 0) {
    console.log('\n⚠️  Slow APIs:');
    results.slow.forEach((item) => {
      console.log(`   - ${item.name}: ${item.duration}ms`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach((item) => {
      console.log(`   - ${item.name}: ${item.error || `Status ${item.status}`}`);
    });
  }

  // Calculate average response time
  if (results.passed.length > 0) {
    const avgDuration = results.passed.reduce((sum, item) => sum + item.duration, 0) / results.passed.length;
    console.log(`\n📈 Average Response Time: ${avgDuration.toFixed(2)}ms`);
  }

  console.log('\n' + '='.repeat(60));
  
  if (results.failed.length === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});

