const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/app');
const connectDB = require('../src/config/db');
const seedData = require('../src/seed/seeder');

const runTests = async () => {
  console.log('🧪 Running Registration Role Escalation Verification Suite...\n');

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
    // -------------------------------------------------------------
    // TEST 1: Normal registration (no role supplied)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Normal registration ---');
    const res1 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Customer One',
        email: 'customer1@example.com',
        password: 'password123'
      })
    });
    const data1 = await res1.json();
    assert(
      res1.status === 201 && data1.data?.user?.role === 'customer',
      'Normal registration creates user with role "customer"',
      JSON.stringify(data1)
    );

    // -------------------------------------------------------------
    // TEST 2: Attempt to register as admin (public route)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Attempt to register as admin (public route) ---');
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fake Admin',
        email: 'fakeadmin@example.com',
        password: 'password123',
        role: 'admin'
      })
    });
    const data2 = await res2.json();
    assert(
      res2.status === 201 && data2.data?.user?.role === 'customer' && data2.data?.user?.role !== 'admin',
      'Public attempt to register as "admin" is overridden and assigned role "customer"',
      JSON.stringify(data2)
    );

    // -------------------------------------------------------------
    // TEST 3: Attempt to register as manager (public route)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Attempt to register as manager (public route) ---');
    const res3 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fake Manager',
        email: 'fakemanager@example.com',
        password: 'password123',
        role: 'manager'
      })
    });
    const data3 = await res3.json();
    assert(
      res3.status === 201 && data3.data?.user?.role === 'customer' && data3.data?.user?.role !== 'manager',
      'Public attempt to register as "manager" is overridden and assigned role "customer"',
      JSON.stringify(data3)
    );

    // -------------------------------------------------------------
    // TEST 4: Attempt to register as kitchen_staff (public route)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Attempt to register as kitchen staff (public route) ---');
    const res4 = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Fake Kitchen',
        email: 'fakekitchen@example.com',
        password: 'password123',
        role: 'kitchen_staff'
      })
    });
    const data4 = await res4.json();
    assert(
      res4.status === 201 && data4.data?.user?.role === 'customer' && data4.data?.user?.role !== 'kitchen_staff',
      'Public attempt to register as "kitchen_staff" is overridden and assigned role "customer"',
      JSON.stringify(data4)
    );

    // -------------------------------------------------------------
    // TEST 5: Existing login for normally registered customer
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Existing login for normally registered customer ---');
    const res5 = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer1@example.com',
        password: 'password123'
      })
    });
    const data5 = await res5.json();
    assert(
      res5.status === 200 && data5.data?.token && data5.data?.user?.email === 'customer1@example.com',
      'Normally registered customer can successfully login and receives valid JWT',
      JSON.stringify(data5)
    );

    // -------------------------------------------------------------
    // TEST 6: Existing elevated-role functionality
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Existing elevated-role functionality ---');
    // 6a: Seeded Admin login
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@restaurant.com',
        password: 'Admin@123Password'
      })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data?.token;
    assert(
      adminLoginRes.status === 200 && adminLoginData.data?.user?.role === 'admin' && !!adminToken,
      'Seeded Administrator can log in with role "admin"',
      JSON.stringify(adminLoginData)
    );

    // 6b: Authenticated Admin can legitimately create staff with elevated role
    const staffRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Legitimate Sous Chef',
        email: 'souschef@restaurant.com',
        password: 'Staff@123Password',
        role: 'kitchen_staff'
      })
    });
    const staffData = await staffRes.json();
    assert(
      staffRes.status === 201 && staffData.data?.user?.role === 'kitchen_staff',
      'Authenticated Admin can register staff with elevated role "kitchen_staff"',
      JSON.stringify(staffData)
    );

    // 6c: Seeded Manager login
    const mgrLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@restaurant.com',
        password: 'Manager@123Password'
      })
    });
    const mgrLoginData = await mgrLoginRes.json();
    assert(
      mgrLoginRes.status === 200 && mgrLoginData.data?.user?.role === 'manager',
      'Seeded Manager can log in with role "manager"',
      JSON.stringify(mgrLoginData)
    );

    console.log(`\n====================================================`);
    console.log(`📊 ROLE ESCALATION FIX SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
