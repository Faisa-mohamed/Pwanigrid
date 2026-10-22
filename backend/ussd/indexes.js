const { getDB } = require("../db");

async function ensureUssdIndexes() {
  const db = getDB();
  await db.collection("customers").createIndex({ phone: 1 }, { unique: true });
  await db.collection("ussdSessions").createIndex({ sessionId: 1 }, { unique: true });
  await db.collection("ussdSessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("purchases").createIndex({ purchaseId: 1 }, { unique: true });
  await db.collection("purchases").createIndex({ idempotencyKey: 1 }, { unique: true });
  await db.collection("purchases").createIndex({ phone: 1, createdAt: -1 });
  await db.collection("simulatedSms").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.log("USSD indexes ready");
}

module.exports = { ensureUssdIndexes };