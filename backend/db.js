const { MongoClient } = require("mongodb");

let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "pwanigrid");

  await db.collection("administrators").createIndex({ username: 1 }, { unique: true });
  await db.collection("meters").createIndex({ meterId: 1 }, { unique: true });
  await db.collection("tokens").createIndex({ tokenId: 1 }, { unique: true });
  await db.collection("tokens").createIndex({ meterId: 1, status: 1 });
  await db.collection("tokens").createIndex({ createdAt: -1 });
  await db.collection("transactions").createIndex({ transactionId: 1 }, { unique: true });
  await db.collection("transactions").createIndex({ meterId: 1, createdAt: -1 });
  await db.collection("securityEvents").createIndex({ createdAt: -1 });
  await db.collection("securityEvents").createIndex({ type: 1 });

  console.log("MongoDB connected, indexes ready");
  return db;
}

function getDB() {
  if (!db) throw new Error("Database not connected");
  return db;
}

module.exports = { connectDB, getDB };