const express = require("express");
const crypto = require("crypto");
const { getDB } = require("../db");
const { handleUssd } = require("../ussd/handler");
const { normalizePhone, maskPhone } = require("../ussd/phone");
const { requireAdmin, rateLimit } = require("../security/auth");
const { logEvent } = require("../security/events");
const { completePurchase, failPurchase } = require("../services/purchaseService");
const { simulationEnabled } = require("../services/paymentService");

const router = express.Router();
const SAFE = { projection: { tokenEnc: 0, idempotencyKey: 0 } };

// ---- Provider callback (Africa's Talking style: form fields, plain-text reply) ----
function providerAuth(req, res, next) {
  const secret = process.env.USSD_CALLBACK_SECRET || "";
  const a = Buffer.from(secret);
  const b = Buffer.from(String(req.query.key || ""));
  const keyOk = secret.length >= 24 && a.length === b.length && crypto.timingSafeEqual(a, b);
  const allowed = (process.env.USSD_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = String(req.ip || "").replace(/^::ffff:/, "");
  const ipOk = allowed.length === 0 || allowed.includes(ip);
  if (!keyOk || !ipOk) {
    logEvent("ussd_unauthorized_callback", { ip }).catch(() => {});
    return res.status(403).type("text/plain").send("END Forbidden");
  }
  next();
}

router.post("/callback", rateLimit({ windowMs: 60 * 1000, max: 600 }), providerAuth, async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body || {};
    const r = await handleUssd({ sessionId, phoneNumber, text });
    res.type("text/plain").send(`${r.type} ${r.message}`);
  } catch (err) {
    console.error("USSD callback failed:", err.message);
    res.type("text/plain").send("END Service temporarily unavailable. Please try again.");
  }
});

// ---- Simulator: admin-only AND only when USSD_MODE=simulation ----
// (It lets the caller pretend to be any phone, so it must never be open.)
router.post(
  "/simulate",
  requireAdmin,
  (req, res, next) =>
    process.env.USSD_MODE === "simulation" ? next() : res.status(403).json({ error: "Simulation is disabled" }),
  async (req, res) => {
    const { sessionId, phoneNumber, text } = req.body || {};
    res.json(await handleUssd({ sessionId, phoneNumber, text }));
  }
);

// ---- Admin tools ----
router.use("/admin", requireAdmin);
router.use("/dev", requireAdmin);

router.post("/admin/customers", async (req, res) => {
  const { phone: rawPhone, meterId } = req.body || {};
  const phone = normalizePhone(rawPhone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number" });
  if (typeof meterId !== "string") return res.status(400).json({ error: "meterId is required" });
  const db = getDB();
  if (!(await db.collection("meters").findOne({ meterId }))) {
    return res.status(404).json({ error: "Meter not found" });
  }
  try {
    await db.collection("customers").insertOne({
      phone, meterId, status: "pending_pin", pinHash: null,
      failedPins: 0, lockedUntil: null, createdAt: new Date(), createdBy: req.admin.username,
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "This phone is already registered" });
    throw err;
  }
  await logEvent("admin_action", { action: "authorize_customer", meterId, phone: maskPhone(phone), admin: req.admin.username });
  res.status(201).json({ phone: maskPhone(phone), meterId, status: "pending_pin" });
});

router.post("/admin/customers/unlock", async (req, res) => {
  const phone = normalizePhone((req.body || {}).phone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number" });
  const r = await getDB().collection("customers").updateOne({ phone }, { $set: { failedPins: 0, lockedUntil: null } });
  if (!r.matchedCount) return res.status(404).json({ error: "Customer not found" });
  await logEvent("admin_action", { action: "unlock_customer", phone: maskPhone(phone), admin: req.admin.username });
  res.json({ ok: true });
});

router.get("/admin/purchases", async (req, res) => {
  const filter = {};
  if (["pending_payment", "paid", "failed", "paid_issue_failed"].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const list = await getDB().collection("purchases").find(filter, SAFE).sort({ createdAt: -1 }).limit(200).toArray();
  res.json(list.map((p) => ({ ...p, phone: maskPhone(p.phone) })));
});

// ---- Development-only helpers ----
router.post("/dev/payments/:purchaseId/confirm", async (req, res) => {
  if (!simulationEnabled()) return res.status(403).json({ error: "Payment simulation is disabled" });
  const { purchaseId } = req.params;
  const result = (req.body || {}).result;
  if (!/^PP-[0-9A-F]{8}$/.test(purchaseId) || !["success", "failed"].includes(result)) {
    return res.status(400).json({ error: "Valid purchaseId and result (success|failed) required" });
  }
  const purchases = getDB().collection("purchases");
  if (!(await purchases.findOne({ purchaseId }))) return res.status(404).json({ error: "Purchase not found" });
  if (result === "failed") await failPurchase(purchaseId, "payment_declined");
  else await completePurchase(purchaseId);
  const p = await purchases.findOne({ purchaseId }, SAFE);
  res.json({ simulated: true, purchaseId, status: p.status, tokenIssued: !!p.tokenId });
});

router.get("/dev/sms", async (req, res) => {
  if ((process.env.SMS_MODE || "simulation") !== "simulation") return res.status(403).json({ error: "Disabled" });
  const phone = normalizePhone(req.query.phone);
  if (!phone) return res.status(400).json({ error: "Enter a valid Kenyan phone number" });
  const list = await getDB().collection("simulatedSms").find({ phone }).sort({ createdAt: -1 }).limit(5).toArray();
  res.json(list.map(({ message, createdAt }) => ({ message, createdAt })));
});

module.exports = router;