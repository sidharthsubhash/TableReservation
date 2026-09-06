const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/app');
const connectDB = require('../src/config/db');
const seedData = require('../src/seed/seeder');

const runTests = async () => {
  console.log('🧪 Running Payment Order Ownership & Authorization Test Suite...\n');

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
    // Customer A (Rahul)
    const custALogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@gmail.com', password: 'Customer@123Password' })
    });
    const custAData = await custALogin.json();
    const tokenA = custAData.data.token;

    // Customer B (Priya)
    const custBLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@gmail.com', password: 'Customer@123Password' })
    });
    const custBData = await custBLogin.json();
    const tokenB = custBData.data.token;

    // Manager
    const mgrLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@restaurant.com', password: 'Manager@123Password' })
    });
    const mgrData = await mgrLogin.json();
    const managerToken = mgrData.data.token;

    // Get branch and menu item
    const branchesRes = await fetch(`${baseUrl}/branches`);
    const branchesData = await branchesRes.json();
    const branchId = branchesData.data.branches[0]._id;

    const menuRes = await fetch(`${baseUrl}/menu`);
    const menuData = await menuRes.json();
    const menuItemId = menuData.data.menuItems[0]._id;

    // Helper to create an order for a customer token
    const createOrderForCustomer = async (token) => {
      const res = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
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
    // TEST 1: Customer A pays own order
    // -------------------------------------------------------------
    console.log('--- TEST 1: Customer A pays own order ---');
    const orderA1 = await createOrderForCustomer(tokenA);
    const res1 = await fetch(`${baseUrl}/billing/${orderA1}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data1 = await res1.json();
    assert(
      res1.status === 200 && data1.data?.paymentStatus === 'PAID',
      'Customer A can successfully pay for their own order',
      JSON.stringify(data1)
    );

    // -------------------------------------------------------------
    // TEST 2: Customer B attempts to pay Customer A\'s order
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Customer B attempts to pay Customer A\'s order ---');
    const orderA2 = await createOrderForCustomer(tokenA);
    const res2 = await fetch(`${baseUrl}/billing/${orderA2}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data2 = await res2.json();
    assert(
      res2.status === 403,
      'Customer B is rejected with 403 Forbidden when attempting to pay Customer A\'s order',
      JSON.stringify(data2)
    );

    // -------------------------------------------------------------
    // TEST 3: Unauthenticated payment attempt
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Unauthenticated payment attempt ---');
    const res3 = await fetch(`${baseUrl}/billing/${orderA2}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data3 = await res3.json();
    assert(
      res3.status === 401,
      'Unauthenticated request is rejected with 401 Unauthorized',
      JSON.stringify(data3)
    );

    // -------------------------------------------------------------
    // TEST 4: Non-existent order
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Non-existent order ---');
    const fakeOrderId = '609d1b48d50a2ec89d020000';
    const res4 = await fetch(`${baseUrl}/billing/${fakeOrderId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data4 = await res4.json();
    assert(
      res4.status === 404,
      'Non-existent order ID is rejected with 404 Not Found',
      JSON.stringify(data4)
    );

    // -------------------------------------------------------------
    // TEST 5: Owner attempts to pay an already-paid order
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Owner attempts to pay already-paid order ---');
    // orderA1 is already paid in TEST 1
    const res5 = await fetch(`${baseUrl}/billing/${orderA1}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data5 = await res5.json();
    assert(
      res5.status === 400 && data5.message?.includes('already paid'),
      'Paying an already-paid order is rejected with 400 Bad Request',
      JSON.stringify(data5)
    );

    // -------------------------------------------------------------
    // TEST 6: Owner attempts to pay a cancelled order
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Owner attempts to pay cancelled order ---');
    const orderA3 = await createOrderForCustomer(tokenA);
    // Cancel the order
    await fetch(`${baseUrl}/orders/${orderA3}/cancel`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`
      }
    });

    const res6 = await fetch(`${baseUrl}/billing/${orderA3}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ paymentMethod: 'CARD' })
    });
    const data6 = await res6.json();
    assert(
      res6.status === 400 && data6.message?.includes('cancelled'),
      'Paying a cancelled order is rejected with 400 Bad Request',
      JSON.stringify(data6)
    );

    // -------------------------------------------------------------
    // TEST 7: Privileged manager/admin payment settlement
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Privileged manager/admin payment settlement ---');
    const orderA4 = await createOrderForCustomer(tokenA);
    const res7 = await fetch(`${baseUrl}/billing/${orderA4}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`
      },
      body: JSON.stringify({ paymentMethod: 'CASH' })
    });
    const data7 = await res7.json();
    assert(
      res7.status === 200 && data7.data?.paymentStatus === 'PAID',
      'Branch Manager can legitimately settle payment for an order at billing desk',
      JSON.stringify(data7)
    );

    console.log(`\n====================================================`);
    console.log(`📊 PAYMENT AUTHORIZATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
