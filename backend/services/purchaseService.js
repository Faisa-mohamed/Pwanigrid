const crypto = require("crypto");
const { getDB } = require("../db");
const { issueToken } = require("./tokenService");
const { initiatePayment } = require("./paymentService");
const { sendSms } = require("./smsService");
const { encrypt } = require("../security/vault");
const { logEvent } = require("../security/events");

const TOKEN_VALID_HOURS = 24 * 30;

function pricePerKwh() {
  const p = Number(process.env.KWH_PRICE_KES);
  return p > 0 ? p : 30;
}
const kwhFor = (amountKes) => Math.round((amountKes / pricePerKwh()) * 100) / 100;

// Creates a purchase and starts payment. Safe to call twice with the same idempotencyKey.
async function createPurchase({ phone, meterId, amountKes, idempotencyKey }) {
  const purchases = getDB().collection("purchases");
  const doc = {
    purchaseId: "PP-" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    idempotencyKey,
    phone,
    meterId,
    amountKes,
    kwh: kwhFor(amountKes),
    status: "pending_payment",
    source: "ussd",
    paymentRef: null,
    tokenId: null,
    tokenEnc: null,
    resendCount: 0,
    createdAt: new Date(),
    paidAt: null,
    failureReason: null,
  };
  try {
    await purchases.insertOne(doc);
  } catch (err) {
    if (err.code === 11000) {
      const existing = await purchases.findOne({ idempotencyKey });
      if (existing) return { purchase: existing, duplicate: true, initiated: true };
    }
    throw err;
  }
  try {
    const pay = await initiatePayment({ purchaseId: doc.purchaseId, phone, amountKes });
    await purchases.updateOne({ purchaseId: doc.purchaseId }, { $set: { paymentRef: pay.reference } });
    doc.paymentRef = pay.reference;
    return { purchase: doc, duplicate: false, initiated: true };
  } catch (err) {
    console.error("Payment initiation failed:", err.message);
    await failPurchase(doc.purchaseId, "payment_not_initiated");
    return { purchase: doc, duplicate: false, initiated: false };
  }
}

async function failPurchase(purchaseId, reason) {
  const r = await getDB().collection("purchases").findOneAndUpdate(
    { purchaseId, status: "pending_payment" },
    { $set: { status: "failed", failureReason: reason } },
    { returnDocument: "after" }
  );
  if (r) await logEvent("payment_failed", { purchaseId, meterId: r.meterId, reason });
  return r;
}

// Call ONLY after the payment system has verified the payment.
// The atomic pending_payment -> paid change means only ONE caller can ever issue the token.
async function completePurchase(purchaseId) {
  const purchases = getDB().collection("purchases");
  const won = await purchases.findOneAndUpdate(
    { purchaseId, status: "pending_payment" },
    { $set: { status: "paid", paidAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!won) return { ok: false, alreadyProcessed: true };

  try {
    const { doc, token } = await issueToken({
      meterId: won.meterId,
      kwh: won.kwh,
      expiresAt: new Date(Date.now() + TOKEN_VALID_HOURS * 3600 * 1000),
      createdBy: "ussd-purchase",
      source: "ussd",
      purchaseId,
    });
    await purchases.updateOne({ purchaseId }, { $set: { tokenId: doc.tokenId, tokenEnc: encrypt(token) } });
    try {
      await sendSms(won.phone, `PwaniGrid token for meter ${won.meterId} (${won.kwh} kWh): ${token}`);
    } catch {
      await logEvent("sms_failed", { purchaseId, meterId: won.meterId });
    }
    return { ok: true };
  } catch (err) {
    console.error("Token issue failed:", err.message);
    await purchases.updateOne({ purchaseId }, { $set: { status: "paid_issue_failed" } });
    await logEvent("token_issue_failed", { purchaseId, meterId: won.meterId });
    return { ok: false, error: true };
  }
}

module.exports = { createPurchase, failPurchase, completePurchase, kwhFor };