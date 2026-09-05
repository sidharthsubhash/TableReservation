const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/restaurant_db';

  try {
    // Attempt connecting to the configured URI with a 2-second timeout
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[MongoDB] Connected to database: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[MongoDB] Local instance unavailable (${error.message}). Initializing embedded in-memory MongoDB database for development/testing...`);
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoMemoryServer = await MongoMemoryServer.create();
        const memUri = mongoMemoryServer.getUri();
        const conn = await mongoose.connect(memUri);
        console.log(`[MongoDB Embedded] Connected to in-memory database: ${memUri}`);
        return conn;
      } catch (memErr) {
        console.error(`[MongoDB Error] Failed to start in-memory database: ${memErr.message}`);
        process.exit(1);
      }
    } else {
      console.error(`[MongoDB Error] Connection failed: ${error.message}`);
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
