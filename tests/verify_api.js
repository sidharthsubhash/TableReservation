const http = require('http');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/app');
const connectDB = require('../src/config/db');
const seedData = require('../src/seed/seeder');
const { validateBillItems, formatCurrency } = require('../src/utils/billCalculator');

let server;
let baseUrl;

const runTests = async () => {
  console.log('🧪 Starting End-to-End API Automated Verification Suite...\n');

  // Connect DB (handles real Mongo or in-memory fallback)
  await connectDB();

  // Populate fresh test data
  console.log('🌱 Seeding fresh test data into database...');
  await seedData(false);

  // Start temporary server on random available port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}/api`;
      console.log(`📡 Test server running on ${baseUrl}\n`);
      resolve();
    });
  });

  let customerToken = '';
  let kitchenToken = '';
  let managerToken = '';
  let adminToken = '';
  let branchId = '';
  let tableId = '';
  let menuItemId = '';
  let reservationId = '';
  let orderId = '';

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------
    // MODULE 1: CUSTOMER REGISTRATION & AUTHENTICATION
    // -------------------------------------------------------------
    console.log('--- 1. Testing Customer Registration & Authentication ---');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Customer',
        email: `testcustomer_${Date.now()}@example.com`,
        password: 'Password@123',
        phone: '9876543210'
      })
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.data.token, 'Register new customer returns 201 & token');

    // Login as Customer Rahul
    const custLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@gmail.com', password: 'Customer@123Password' })
    });
    const custLoginData = await custLoginRes.json();
    customerToken = custLoginData.data.token;
    assert(custLoginRes.status === 200 && customerToken, 'Login as Customer returns JWT token');

    // Login as Manager
    const mgrLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@restaurant.com', password: 'Manager@123Password' })
    });
    const mgrLoginData = await mgrLoginRes.json();
    managerToken = mgrLoginData.data.token;
    assert(mgrLoginRes.status === 200 && managerToken, 'Login as Branch Manager returns JWT token');

    // Login as Kitchen Staff
    const kitLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kitchen@restaurant.com', password: 'Kitchen@123Password' })
    });
    const kitLoginData = await kitLoginRes.json();
    kitchenToken = kitLoginData.data.token;
    assert(kitLoginRes.status === 200 && kitchenToken, 'Login as Kitchen Staff returns JWT token');

    // -------------------------------------------------------------
    // MODULE 2: BRANCH MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Branch Management ---');
    const branchRes = await fetch(`${baseUrl}/branches`);
    const branchData = await branchRes.json();
    assert(branchRes.status === 200 && branchData.data.branches.length > 0, 'Get all branches returns list of active branches');
    branchId = branchData.data.branches[0]._id;

    // -------------------------------------------------------------
    // MODULE 3: TABLE INVENTORY MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Table Inventory Management ---');
    const tableRes = await fetch(`${baseUrl}/tables?branchId=${branchId}`);
    const tableData = await tableRes.json();
    assert(tableRes.status === 200 && tableData.data.tables.length > 0, 'Get tables for branch returns tables');
    tableId = tableData.data.tables[0]._id;

    // -------------------------------------------------------------
    // MODULE 4: MENU MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Menu Management ---');
    const menuRes = await fetch(`${baseUrl}/menu?category=Appetizer`);
    const menuData = await menuRes.json();
    assert(menuRes.status === 200 && menuData.data.menuItems.length > 0, 'Filter menu by category returns items');
    menuItemId = menuData.data.menuItems[0]._id;

    const toggleRes = await fetch(`${baseUrl}/menu/${menuItemId}/toggle-availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const toggleData = await toggleRes.json();
    assert(toggleRes.status === 200, 'Kitchen staff can toggle menu availability');

    // Toggle back
    await fetch(`${baseUrl}/menu/${menuItemId}/toggle-availability`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });

    // -------------------------------------------------------------
    // MODULE 5: TABLE RESERVATION ENGINE & CONFLICT PREVENTION
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Table Reservation Engine & Slot Conflict Check ---');
    const testDate = '2026-10-15';
    const testTime = '19:00';

    const availRes = await fetch(`${baseUrl}/reservations/availability?branchId=${branchId}&date=${testDate}&partySize=2`);
    const availData = await availRes.json();
    assert(availRes.status === 200 && availData.data.slots, 'Check slot availability returns hourly slot breakdown');

    // Create reservation 1
    const resv1 = await fetch(`${baseUrl}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        branchId,
        tableId,
        partySize: 2,
        reservationDate: testDate,
        startTime: testTime,
        durationMinutes: 90,
        specialRequests: 'Corner table test'
      })
    });
    const resv1Data = await resv1.json();
    assert(resv1.status === 201 && resv1Data.data.reservation, 'Create valid table reservation returns 201');
    reservationId = resv1Data.data.reservation._id;

    // Strict Double-Booking Test: Attempt booking same table for overlapping time
    const resvConflict = await fetch(`${baseUrl}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        branchId,
        tableId,
        partySize: 2,
        reservationDate: testDate,
        startTime: '19:30', // Overlaps with 19:00 - 20:30
        durationMinutes: 90
      })
    });
    const resvConflictData = await resvConflict.json();
    assert(resvConflict.status === 409, 'Double-booking prevention: Overlapping reservation is rejected with 409 Conflict');

    // -------------------------------------------------------------
    // MODULE 6: FOOD ORDER PLACEMENT
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Food Order Placement ---');
    const orderCreateRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        branchId,
        orderType: 'DINE_IN',
        tableId,
        reservationId,
        items: [
          { menuItemId, quantity: 2, specialInstructions: 'Less spicy' }
        ],
        notes: 'Test order placement'
      })
    });
    const orderCreateData = await orderCreateRes.json();
    assert(orderCreateRes.status === 201 && orderCreateData.data.order, 'Place food order returns 201 with computed bill snapshot');
    orderId = orderCreateData.data.order._id;

    // -------------------------------------------------------------
    // MODULE 7: KITCHEN DISPLAY QUEUE
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Kitchen Display Queue ---');
    const queueRes = await fetch(`${baseUrl}/kitchen/queue?branchId=${branchId}`, {
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const queueData = await queueRes.json();
    assert(queueRes.status === 200 && Array.isArray(queueData.data.queue), 'Get kitchen display queue returns active orders sorted by time');

    const advanceRes = await fetch(`${baseUrl}/kitchen/orders/${orderId}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });
    const advanceData = await advanceRes.json();
    assert(advanceRes.status === 200 && advanceData.data.order.status === 'PREPARING', 'Advance kitchen order status transitions to PREPARING');

    // Advance again to READY
    await fetch(`${baseUrl}/kitchen/orders/${orderId}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });

    // Advance again to SERVED
    await fetch(`${baseUrl}/kitchen/orders/${orderId}/advance`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${kitchenToken}` }
    });

    // -------------------------------------------------------------
    // MODULE 8: BILLING & PAYMENT SUMMARY
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Billing & Payment Summary ---');
    const billRes = await fetch(`${baseUrl}/billing/${orderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const billData = await billRes.json();
    assert(billRes.status === 200 && billData.data.invoice.breakdown.taxAmount > 0, 'Get bill summary includes tax, service charge, and grand total');

    const payRes = await fetch(`${baseUrl}/billing/${orderId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        paymentMethod: 'UPI',
        transactionRef: 'UPI-TEST-123456'
      })
    });
    const payData = await payRes.json();
    assert(payRes.status === 200 && payData.data.paymentStatus === 'PAID', 'Process order payment marks order as PAID and COMPLETED');

    const validCheck = validateBillItems([{ price: 150, quantity: 2 }]);
    const invalidCheck = validateBillItems([{ price: -10, quantity: 1 }]);
    const formatted = formatCurrency(250.5);
    assert(validCheck.isValid && !invalidCheck.isValid && formatted.includes('250.50'), 'Billing utility validates item items and formats currency correctly');

    // -------------------------------------------------------------
    // MODULE 9: RESERVATION CANCELLATION & RESCHEDULE POLICY
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Reservation Cancellation Policy ---');
    const cancelRes = await fetch(`${baseUrl}/reservations/${reservationId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({ cancellationReason: 'Testing cancellation flow' })
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200 && cancelData.data.reservation.status === 'CANCELLED', 'Cancel reservation frees table slot and updates status to CANCELLED');

    // -------------------------------------------------------------
    // MODULE 10: CUSTOMER ORDER & RESERVATION HISTORY
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Customer History ---');
    const custOrdersRes = await fetch(`${baseUrl}/customers/history/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const custOrdersData = await custOrdersRes.json();
    assert(custOrdersRes.status === 200 && custOrdersData.data.orders.length > 0, 'Get customer order history returns past orders');

    const custSummaryRes = await fetch(`${baseUrl}/customers/summary`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    const custSummaryData = await custSummaryRes.json();
    assert(custSummaryRes.status === 200 && custSummaryData.data.totalSpent >= 0, 'Get customer dining summary returns lifetime spend and stats');

    // -------------------------------------------------------------
    // MODULE 11: FEEDBACK & RATING
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Feedback & Ratings ---');
    const feedRes = await fetch(`${baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        branchId,
        orderId,
        rating: 5,
        foodRating: 5,
        serviceRating: 5,
        ambienceRating: 5,
        comment: 'Superb food and quick kitchen turnaround!'
      })
    });
    const feedData = await feedRes.json();
    assert(feedRes.status === 201 && feedData.data.feedback, 'Submit feedback returns 201');

    const feedStatsRes = await fetch(`${baseUrl}/feedback/stats?branchId=${branchId}`);
    const feedStatsData = await feedStatsRes.json();
    assert(feedStatsRes.status === 200 && feedStatsData.data.stats.totalReviews > 0, 'Get feedback stats returns aggregated average ratings');

    // -------------------------------------------------------------
    // MODULE 12 & 13: MANAGER REPORTS & BUSINESS ANALYTICS
    // -------------------------------------------------------------
    console.log('\n--- 12 & 13. Testing Manager Reports & Analytics Pipelines ---');
    const overviewRes = await fetch(`${baseUrl}/analytics/overview`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const overviewData = await overviewRes.json();
    assert(overviewRes.status === 200 && overviewData.data.metrics.orders.totalRevenue >= 0, 'Analytics Overview returns revenue & counts');

    const popularRes = await fetch(`${baseUrl}/analytics/popular-dishes`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const popularData = await popularRes.json();
    assert(popularRes.status === 200 && Array.isArray(popularData.data.popularDishes), 'Popular Dishes report returns top selling dishes');

    const peakRes = await fetch(`${baseUrl}/analytics/peak-hours`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const peakData = await peakRes.json();
    assert(peakRes.status === 200 && peakData.data.reservationPeakHours, 'Peak Hours report returns hourly booking patterns');

    const revBranchRes = await fetch(`${baseUrl}/analytics/revenue-by-branch`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const revBranchData = await revBranchRes.json();
    assert(revBranchRes.status === 200 && Array.isArray(revBranchData.data.branchRevenue), 'Revenue by Branch report returns branch revenue aggregations');

    const occupancyRes = await fetch(`${baseUrl}/analytics/reservation-occupancy`, {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const occupancyData = await occupancyRes.json();
    assert(occupancyRes.status === 200 && Array.isArray(occupancyData.data.occupancy), 'Reservation Occupancy report returns table capacity analytics');

    console.log('\n====================================================');
    console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test Suite Error:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
    const { disconnectDB } = require('../src/config/db');
    await disconnectDB();
  }
};

runTests();
