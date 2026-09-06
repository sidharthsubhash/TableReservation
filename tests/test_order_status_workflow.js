const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/app');
const connectDB = require('../src/config/db');
const seedData = require('../src/seed/seeder');

const runTests = async () => {
  console.log('🧪 Running Order Status Workflow & State Machine Test Suite...\n');

  await connectDB();
  await seedData(false);

  const server = http.createServer(app);
  let baseUrl;

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api`;
      console.log(`📡 Test server running on ${baseUrl}\n`);
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  const assert = (condition, message, details = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message} - Details: ${details}`);
      failed++;
    }
  };

  try {
    // 1. Get Tokens
    // Customer (Rahul)
    const custLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@gmail.com', password: 'Customer@123Password' })
    });
    const custData = await custLogin.json();
    const customerToken = custData.data.token;

    // Kitchen Staff
    const kitchenLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kitchen@restaurant.com', password: 'Kitchen@123Password' })
    });
    const kitchenData = await kitchenLogin.json();
    const kitchenToken = kitchenData.data.token;

    // Manager
    const mgrLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@restaurant.com', password: 'Manager@123Password' })
    });
    const mgrData = await mgrLogin.json();
    const managerToken = mgrData.data.token;

    // Get a branch and menu item to create orders
    const branchesRes = await fetch(`${baseUrl}/branches`);
    const branchesData = await branchesRes.json();
    const branchId = branchesData.data.branches[0]._id;

    const menuRes = await fetch(`${baseUrl}/menu`);
    const menuData = await menuRes.json();
    const menuItemId = menuData.data.menuItems[0]._id;

    // Helper to create a new order
    const createNewOrder = async () => {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`
        },
        body: JSON.stringify({
          branchId,
          orderType: 'TAKEAWAY',
          items: [{ menuItemId, quantity: 1 }]
        })
      });
      const data = await res.json();
      return data.data.order._id;
    };

    // -------------------------------------------------------------
    // SEQUENTIAL VALID LIFECYCLE TESTS (1 - 4)
    // -------------------------------------------------------------
    console.log('--- TEST 1: PLACED -> PREPARING ---');
    const order1 = await createNewOrder();
    const res1 = await fetch(`${baseUrl}/orders/${order1}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`
      },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const data1 = await res1.json();
    assert(
      res1.status === 200 && data1.data?.order?.status === 'PREPARING',
      'Order status successfully advanced: PLACED -> PREPARING',
      JSON.stringify(data1)
    );

    console.log('\n--- TEST 2: PREPARING -> READY ---');
    const res2 = await fetch(`${baseUrl}/orders/${order1}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`
      },
      body: JSON.stringify({ status: 'READY' })
    });
    const data2 = await res2.json();
    assert(
      res2.status === 200 && data2.data?.order?.status === 'READY',
      'Order status successfully advanced: PREPARING -> READY',
      JSON.stringify(data2)
    );

    console.log('\n--- TEST 3: READY -> SERVED ---');
    const res3 = await fetch(`${baseUrl}/orders/${order1}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`
      },
      body: JSON.stringify({ status: 'SERVED' })
    });
    const data3 = await res3.json();
    assert(
      res3.status === 200 && data3.data?.order?.status === 'SERVED',
      'Order status successfully advanced: READY -> SERVED',
      JSON.stringify(data3)
    );

    console.log('\n--- TEST 4: SERVED -> COMPLETED ---');
    const res4 = await fetch(`${baseUrl}/orders/${order1}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    const data4 = await res4.json();
    assert(
      res4.status === 200 && data4.data?.order?.status === 'COMPLETED',
      'Order status successfully advanced: SERVED -> COMPLETED',
      JSON.stringify(data4)
    );

    // -------------------------------------------------------------
    // INVALID TRANSITION TESTS (5 - 8) -> Expect 409 Conflict
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: PLACED -> COMPLETED (Illegal jump) ---');
    const order2 = await createNewOrder();
    const res5 = await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    const data5 = await res5.json();
    assert(
      res5.status === 409,
      'Attempting PLACED -> COMPLETED is rejected with 409 Conflict',
      JSON.stringify(data5)
    );

    console.log('\n--- TEST 6: PLACED -> READY (Illegal skip) ---');
    const res6 = await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`
      },
      body: JSON.stringify({ status: 'READY' })
    });
    const data6 = await res6.json();
    assert(
      res6.status === 409,
      'Attempting PLACED -> READY is rejected with 409 Conflict',
      JSON.stringify(data6)
    );

    console.log('\n--- TEST 7: READY -> PREPARING (Illegal backwards regression) ---');
    // Advance order2 from PLACED -> PREPARING -> READY
    await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'READY' })
    });

    const res7 = await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kitchenToken}`
      },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const data7 = await res7.json();
    assert(
      res7.status === 409,
      'Attempting backwards regression READY -> PREPARING is rejected with 409 Conflict',
      JSON.stringify(data7)
    );

    console.log('\n--- TEST 8: COMPLETED -> PREPARING (Terminal state mutation) ---');
    // Advance order2 to SERVED then COMPLETED
    await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kitchenToken}` },
      body: JSON.stringify({ status: 'SERVED' })
    });
    await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${managerToken}` },
      body: JSON.stringify({ status: 'COMPLETED' })
    });

    const res8 = await fetch(`${baseUrl}/orders/${order2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const data8 = await res8.json();
    assert(
      res8.status === 409,
      'Attempting transition from terminal COMPLETED state is rejected with 409 Conflict',
      JSON.stringify(data8)
    );

    // -------------------------------------------------------------
    // TEST 9: Customer Unauthorized Status Change
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Customer attempts to directly change an order status ---');
    const order3 = await createNewOrder();
    const res9 = await fetch(`${baseUrl}/orders/${order3}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ status: 'PREPARING' })
    });
    const data9 = await res9.json();
    assert(
      res9.status === 403,
      'Customer attempting status update is rejected with 403 Forbidden',
      JSON.stringify(data9)
    );

    // -------------------------------------------------------------
    // TEST 10: Kitchen 1-Click Order Advancement Workflow
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Kitchen 1-click order advancement workflow ---');
    const order4 = await createNewOrder();
    // Step 1: PLACED -> PREPARING
    const kAdv1 = await fetch(`${baseUrl}/kitchen/orders/${order4}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const kData1 = await kAdv1.json();

    // Step 2: PREPARING -> READY
    const kAdv2 = await fetch(`${baseUrl}/kitchen/orders/${order4}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const kData2 = await kAdv2.json();

    // Step 3: READY -> SERVED
    const kAdv3 = await fetch(`${baseUrl}/kitchen/orders/${order4}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const kData3 = await kAdv3.json();

    // Step 4: SERVED -> COMPLETED
    const kAdv4 = await fetch(`${baseUrl}/kitchen/orders/${order4}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const kData4 = await kAdv4.json();

    // Step 5: Advance past COMPLETED -> Expected 409 Conflict
    const kAdv5 = await fetch(`${baseUrl}/kitchen/orders/${order4}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const kData5 = await kAdv5.json();

    assert(
      kAdv1.status === 200 && kData1.data?.order?.status === 'PREPARING' &&
      kAdv2.status === 200 && kData2.data?.order?.status === 'READY' &&
      kAdv3.status === 200 && kData3.data?.order?.status === 'SERVED' &&
      kAdv4.status === 200 && kData4.data?.order?.status === 'COMPLETED' &&
      kAdv5.status === 409,
      'Kitchen 1-click advance workflow successfully steps through all phases and returns 409 when terminal',
      JSON.stringify(kData5)
    );

    console.log(`\n====================================================`);
    console.log(`📊 ORDER WORKFLOW SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
