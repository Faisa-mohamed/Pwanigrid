const { getDB } = require("../db");
const { maskPhone } = require("../ussd/phone");

// SIMULATION ONLY: messages go to a collection that expires after 1 hour.
async function sendSms(phone, message) {
  if ((process.env.SMS_MODE || "simulation") === "simulation") {
    await getDB().collection("simulatedSms").insertOne({
      phone,
      message,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    console.log(`[SIMULATED SMS] to ${maskPhone(phone)} (content hidden)`);
    return { simulated: true };
  }
  throw new Error("Real SMS provider is not configured");
}

module.exports = { sendSms };