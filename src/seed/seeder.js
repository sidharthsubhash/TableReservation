const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const Reservation = require('../models/Reservation');
const Order = require('../models/Order');
const Feedback = require('../models/Feedback');
const { calculateBill } = require('../utils/billCalculator');

const seedData = async (exitOnComplete = true) => {
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('Connecting to database for seeding...');
      await connectDB();
    }

    console.log('Clearing existing database collections...');
    await Promise.all([
      User.deleteMany(),
      Branch.deleteMany(),
      Table.deleteMany(),
      MenuItem.deleteMany(),
      Reservation.deleteMany(),
      Order.deleteMany(),
      Feedback.deleteMany()
    ]);

    console.log('Creating Restaurant Branches...');
    const branches = await Branch.create([
      {
        name: 'The Royal Feast - Koramangala',
        code: 'KOR01',
        address: {
          street: '80 Feet Road, 4th Block',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560034'
        },
        phone: '+91 80 4123 4567',
        email: 'koramangala@royalfeast.com',
        totalSeatingCapacity: 80,
        openingTime: '11:00',
        closingTime: '23:30',
        isActive: true
      },
      {
        name: 'The Royal Feast - Indiranagar',
        code: 'IND02',
        address: {
          street: '100 Feet Road, HAL 2nd Stage',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560038'
        },
        phone: '+91 80 4987 6543',
        email: 'indiranagar@royalfeast.com',
        totalSeatingCapacity: 100,
        openingTime: '11:30',
        closingTime: '23:30',
        isActive: true
      },
      {
        name: 'The Royal Feast - Whitefield',
        code: 'WHT03',
        address: {
          street: 'ITPL Main Road, EPIP Zone',
          city: 'Bangalore',
          state: 'Karnataka',
          zipCode: '560066'
        },
        phone: '+91 80 4555 7890',
        email: 'whitefield@royalfeast.com',
        totalSeatingCapacity: 60,
        openingTime: '12:00',
        closingTime: '23:00',
        isActive: true
      }
    ]);

    const korBranch = branches[0];
    const indBranch = branches[1];

    console.log('Creating User Accounts for all roles...');
    const users = await User.create([
      {
        name: 'System Administrator',
        email: 'admin@restaurant.com',
        password: 'Admin@123Password',
        role: 'admin',
        phone: '+91 99000 11111',
        address: 'HQ, Bangalore'
      },
      {
        name: 'Koramangala Branch Manager',
        email: 'manager@restaurant.com',
        password: 'Manager@123Password',
        role: 'manager',
        phone: '+91 99000 22222',
        address: 'Koramangala, Bangalore',
        branchId: korBranch._id
      },
      {
        name: 'Head Chef Suresh',
        email: 'kitchen@restaurant.com',
        password: 'Kitchen@123Password',
        role: 'kitchen_staff',
        phone: '+91 99000 33333',
        address: 'Bangalore',
        branchId: korBranch._id
      },
      {
        name: 'Rahul Sharma',
        email: 'rahul@gmail.com',
        password: 'Customer@123Password',
        role: 'customer',
        phone: '+91 98888 44444',
        address: 'HSR Layout, Bangalore'
      },
      {
        name: 'Priya Patel',
        email: 'priya@gmail.com',
        password: 'Customer@123Password',
        role: 'customer',
        phone: '+91 97777 55555',
        address: 'Indiranagar, Bangalore'
      }
    ]);

    const customerRahul = users[3];
    const customerPriya = users[4];

    console.log('Creating Restaurant Tables...');
    const tables = await Table.create([
      // Koramangala Tables
      { branchId: korBranch._id, tableNumber: 'T-01', capacity: 2, location: 'window_side', description: 'Window-side romantic 2-seater' },
      { branchId: korBranch._id, tableNumber: 'T-02', capacity: 2, location: 'indoor', description: 'Cozy indoor 2-seater' },
      { branchId: korBranch._id, tableNumber: 'T-03', capacity: 4, location: 'indoor', description: 'Standard family 4-seater' },
      { branchId: korBranch._id, tableNumber: 'T-04', capacity: 4, location: 'outdoor', description: 'Outdoor garden 4-seater' },
      { branchId: korBranch._id, tableNumber: 'T-05', capacity: 6, location: 'indoor', description: 'Large group 6-seater' },
      { branchId: korBranch._id, tableNumber: 'T-06', capacity: 8, location: 'private_dining', description: 'VIP Private Dining Room' },
      { branchId: korBranch._id, tableNumber: 'T-07', capacity: 4, location: 'rooftop', description: 'Scenic rooftop table' },

      // Indiranagar Tables
      { branchId: indBranch._id, tableNumber: 'IND-01', capacity: 2, location: 'indoor', description: 'Indoor 2-seater' },
      { branchId: indBranch._id, tableNumber: 'IND-02', capacity: 4, location: 'rooftop', description: 'Rooftop table with skyline view' },
      { branchId: indBranch._id, tableNumber: 'IND-03', capacity: 6, location: 'indoor', description: 'Family dining table' }
    ]);

    console.log('Creating Menu Items across Categories...');
    const menuItems = await MenuItem.create([
      // Appetizers
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Crispy Paneer Tikka',
        description: 'Cottage cheese cubes marinated in spiced hung curd and chargrilled in tandoor',
        category: 'Appetizer',
        dietary: 'veg',
        price: 340,
        preparationTimeMinutes: 15,
        isAvailable: true,
        imageUrl: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        calories: 380
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Murgh Malai Kebab',
        description: 'Succulent chicken tenders marinated with cream, cheese, and mild spices',
        category: 'Appetizer',
        dietary: 'non-veg',
        price: 420,
        preparationTimeMinutes: 20,
        isAvailable: true,
        imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
        calories: 450
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Truffle Mushroom Bruschetta',
        description: 'Toasted sourdough topped with sautéed wild mushrooms, herbs and truffle oil',
        category: 'Appetizer',
        dietary: 'vegan',
        price: 360,
        preparationTimeMinutes: 12,
        isAvailable: true,
        imageUrl: 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&q=80',
        calories: 280
      },

      // Main Course
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Butter Chicken Grand Royal',
        description: 'Slow-cooked roasted chicken in a velvety aromatic tomato and butter gravy',
        category: 'Main Course',
        dietary: 'non-veg',
        price: 480,
        preparationTimeMinutes: 20,
        isAvailable: true,
        isSpecial: true,
        imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
        calories: 580
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Paneer Butter Masala',
        description: 'Rich cottage cheese simmered in smooth, creamy cashew tomato makhani',
        category: 'Main Course',
        dietary: 'veg',
        price: 390,
        preparationTimeMinutes: 18,
        isAvailable: true,
        imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
        calories: 510
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Dal Makhani Gold',
        description: 'Black lentils slow cooked overnight on charcoal with churned white butter',
        category: 'Main Course',
        dietary: 'veg',
        price: 320,
        preparationTimeMinutes: 15,
        isAvailable: true,
        imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
        calories: 420
      },

      // Breads & Rice
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Hyderabadi Dum Biryani',
        description: 'Fragrant basmati rice layered with spiced marinated chicken and saffron',
        category: 'Breads & Rice',
        dietary: 'non-veg',
        price: 450,
        preparationTimeMinutes: 25,
        isAvailable: true,
        isSpecial: true,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
        calories: 620
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Garlic Butter Naan',
        description: 'Fresh tandoori leavened flatbread brushed with roasted garlic and butter',
        category: 'Breads & Rice',
        dietary: 'veg',
        price: 80,
        preparationTimeMinutes: 8,
        isAvailable: true,
        calories: 190
      },

      // Desserts & Beverages
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Saffron Pistachio Kulfi Falooda',
        description: 'Traditional slow-reduced milk kulfi with vermicelli, rose syrup and basil seeds',
        category: 'Dessert',
        dietary: 'veg',
        price: 240,
        preparationTimeMinutes: 10,
        isAvailable: true,
        calories: 340
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Sizzling Chocolate Brownie with Gelato',
        description: 'Warm walnut fudge brownie served sizzling with Belgian chocolate sauce',
        category: 'Dessert',
        dietary: 'egg',
        price: 290,
        preparationTimeMinutes: 10,
        isAvailable: true,
        calories: 480
      },
      {
        branchIds: [korBranch._id, indBranch._id],
        name: 'Fresh Mint Mojito',
        description: 'Refreshing blend of fresh mint leaves, lime juice, brown sugar and soda',
        category: 'Beverage',
        dietary: 'vegan',
        price: 180,
        preparationTimeMinutes: 5,
        isAvailable: true,
        calories: 110
      }
    ]);

    console.log('Creating Sample Table Reservations...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const startDT1 = new Date(`${tomorrowStr}T19:30:00.000Z`);
    const endDT1 = new Date(`${tomorrowStr}T21:00:00.000Z`);

    const reservation1 = await Reservation.create({
      customerId: customerRahul._id,
      branchId: korBranch._id,
      tableId: tables[2]._id, // Table T-03 (4 seater)
      partySize: 3,
      reservationDate: tomorrowStr,
      timeSlot: {
        startTime: '19:30',
        endTime: '21:00'
      },
      startDateTime: startDT1,
      endDateTime: endDT1,
      status: 'CONFIRMED',
      specialRequests: 'Window side seating if possible, celebrating anniversary'
    });

    console.log('Creating Sample Orders...');
    const sampleItems = [
      { menuItemId: menuItems[0]._id, name: menuItems[0].name, price: menuItems[0].price, quantity: 2, itemStatus: 'SERVED' },
      { menuItemId: menuItems[3]._id, name: menuItems[3].name, price: menuItems[3].price, quantity: 1, itemStatus: 'SERVED' },
      { menuItemId: menuItems[7]._id, name: menuItems[7].name, price: menuItems[7].price, quantity: 3, itemStatus: 'SERVED' }
    ];

    const bill1 = calculateBill(sampleItems, { taxRate: 5, serviceChargeRate: 5, discountPercent: 10 });

    const order1 = await Order.create({
      orderNumber: `ORD-${Date.now()}-1001`,
      orderType: 'DINE_IN',
      customerId: customerRahul._id,
      branchId: korBranch._id,
      reservationId: reservation1._id,
      tableId: tables[2]._id,
      items: sampleItems,
      status: 'COMPLETED',
      billing: {
        ...bill1,
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        paidAt: new Date(),
        transactionRef: 'UPI-RAHUL-987654'
      },
      estimatedPrepTimeMinutes: 25,
      notes: 'Please serve starters first'
    });

    // Kitchen queue active order (PLACED)
    const kitchenQueueItems = [
      { menuItemId: menuItems[1]._id, name: menuItems[1].name, price: menuItems[1].price, quantity: 1, itemStatus: 'PENDING' },
      { menuItemId: menuItems[6]._id, name: menuItems[6].name, price: menuItems[6].price, quantity: 2, itemStatus: 'PENDING' }
    ];
    const bill2 = calculateBill(kitchenQueueItems, { taxRate: 5, serviceChargeRate: 5 });

    const order2 = await Order.create({
      orderNumber: `ORD-${Date.now()}-1002`,
      orderType: 'DINE_IN',
      customerId: customerPriya._id,
      branchId: korBranch._id,
      tableId: tables[0]._id,
      items: kitchenQueueItems,
      status: 'PLACED',
      billing: {
        ...bill2,
        paymentStatus: 'UNPAID',
        paymentMethod: 'PENDING'
      },
      estimatedPrepTimeMinutes: 25,
      notes: 'Make biryani medium spicy'
    });

    console.log('Creating Sample Feedback...');
    await Feedback.create({
      customerId: customerRahul._id,
      branchId: korBranch._id,
      orderId: order1._id,
      reservationId: reservation1._id,
      rating: 5,
      foodRating: 5,
      serviceRating: 5,
      ambienceRating: 4,
      comment: 'Exceptional food quality! The Butter Chicken and Paneer Tikka were out of this world. Great hospitality.',
      isPublic: true
    });

    console.log('====================================================');
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('====================================================');

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Seeder Error:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedData(true);
}

module.exports = seedData;
