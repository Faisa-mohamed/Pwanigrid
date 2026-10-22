const { getDB } = require("../db");

async function logEvent(type, details = {}) {
  await getDB().collection("securityEvents").insertOne({
    type,
    ...details,
    createdAt: new Date(),
  });
}

module.exports = { logEvent };