const express = require("express");
const { getDB } = require("../db");

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/dashboard", async (req, res) => {
  const db = getDB();
  const now = new Date();
  const tokens = db.collection("tokens");
  const [meters, total, redeemed, unused, expired, failed, alerts, recent] = await Promise.all([
    db.collection("meters").countDocuments(),
    tokens.countDocuments(),
    tokens.countDocuments({ status: "redeemed" }),
    tokens.countDocuments({
      status: "unused",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }),
    tokens.countDocuments({
      $or: [{ status: "expired" }, { status: "unused", expiresAt: { $lte: now } }],
    }),
    db.collection("transactions").countDocuments({ status: "failed" }),
    db.collection("securityEvents").countDocuments({ type: { $ne: "admin_action" } }),
    db.collection("transactions").find().sort({ createdAt: -1 }).limit(10).toArray(),
  ]);
  res.json({
    totalMeters: meters,
    totalTokens: total,
    redeemedTokens: redeemed,
    unusedTokens: unused,
    expiredTokens: expired,
    failedRedemptions: failed,
    securityAlerts: alerts,
    recentTransactions: recent,
  });
});

router.get("/transactions", async (req, res) => {
  const filter = {};
  if (req.query.status === "success" || req.query.status === "failed") {
    filter.status = req.query.status;
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ transactionId: rx }, { meterId: rx }, { tokenRef: rx }];
  }
  const list = await getDB()
    .collection("transactions")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  res.json(list);
});

router.get("/security-events", async (req, res) => {
  const filter = {};
  if (typeof req.query.type === "string" && req.query.type) filter.type = req.query.type;
  const list = await getDB()
    .collection("securityEvents")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  res.json(list);
});

module.exports = router;