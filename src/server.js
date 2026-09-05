const dotenv = require('dotenv');

// Load environment variables before importing app and db
dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const User = require('./models/User');
const seedData = require('./seed/seeder');

const PORT = process.env.PORT || 5000;

// Start server function
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Auto-seed if database is completely empty (for immediate plug-and-play)
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 Empty database detected! Auto-populating initial sample data...');
      await seedData(false);
    }
  } catch (seedErr) {
    console.warn(`[Auto-Seed Warning]: ${seedErr.message}`);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n===============================================================`);
    console.log(`🚀 Restaurant Reservation & Food Ordering API is RUNNING!`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`📖 API Health: http://localhost:${PORT}/api/health`);
    console.log(`===============================================================`);
    console.log(`🔑 Pre-configured Test Accounts:`);
    console.log(`   👑 Admin:          admin@restaurant.com   / Admin@123Password`);
    console.log(`   👔 Branch Manager: manager@restaurant.com / Manager@123Password`);
    console.log(`   🍳 Kitchen Staff:  kitchen@restaurant.com / Kitchen@123Password`);
    console.log(`   👤 Customer 1:     rahul@gmail.com        / Customer@123Password`);
    console.log(`   👤 Customer 2:     priya@gmail.com        / Customer@123Password`);
    console.log(`===============================================================\n`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error(`💥 [Unhandled Rejection Error]: ${err.message}`);
    server.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error(`💥 [Uncaught Exception Error]: ${err.message}`);
    process.exit(1);
  });
};

startServer();
