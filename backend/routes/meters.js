const express = require("express");
const crypto = require("crypto");
const { getDB } = require("../db");
const { logEvent } = require("../security/events");

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.post("/", async (req, res) => {
  const { name, location } = req.body || {};
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80) {
    return res.status(400).json({ error: "Meter name must be 2 to 80 characters" });
  }
  const meters = getDB().collection("meters");
  for (let i = 0; i < 5; i++) {
    const meter = {
      meterId: `PG-${crypto.randomInt(100000, 999999)}`,
      name: name.trim(),
      location: typeof location === "string" ? location.trim().slice(0, 120) : "",
      status: "active",
      createdAt: new Date(),
    };
    try {
      await meters.insertOne(meter);
      await logEvent("admin_action", {
        action: "register_meter",
        meterId: meter.meterId,
        admin: req.admin.username,
      });
      return res.status(201).json(meter);
    } catch (err) {
      if (err.code !== 11000) throw err; // retry only on duplicate meterId
    }
  }
  res.status(500).json({ error: "Could not generate a unique meter ID" });
});

router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.status === "active" || req.query.status === "inactive") {
    filter.status = req.query.status;
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ meterId: rx }, { name: rx }, { location: rx }];
  }
  const list = await getDB()
    .collection("meters")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  res.json(list);
});

router.get("/:meterId", async (req, res) => {
  const meter = await getDB().collection("meters").findOne({ meterId: req.params.meterId });
  if (!meter) return res.status(404).json({ error: "Meter not found" });
  res.json(meter);
});

router.patch("/:meterId/status", async (req, res) => {
  const { status } = req.body || {};
  if (status !== "active" && status !== "inactive") {
    return res.status(400).json({ error: "Status must be active or inactive" });
  }
  const meter = await getDB()
    .collection("meters")
    .findOneAndUpdate(
      { meterId: req.params.meterId },
      { $set: { status } },
      { returnDocument: "after" }
    );
  if (!meter) return res.status(404).json({ error: "Meter not found" });
  await logEvent("admin_action", {
    action: `meter_${status}`,
    meterId: meter.meterId,
    admin: req.admin.username,
  });
  res.json(meter);
});

router.get("/:meterId/history", async (req, res) => {
  const db = getDB();
  const { meterId } = req.params;
  const [tokens, transactions] = await Promise.all([
    db.collection("tokens").find({ meterId }).sort({ createdAt: -1 }).limit(100).toArray(),
    db.collection("transactions").find({ meterId }).sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  res.json({ tokens, transactions });
});

module.exports = router;