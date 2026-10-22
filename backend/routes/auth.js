const express = require("express");
const { getDB } = require("../db");
const { verifyPassword, createSession, requireAdmin, rateLimit } = require("../security/auth");
const { logEvent } = require("../security/events");

const router = express.Router();

router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required" });
  }
  const admin = await getDB().collection("administrators").findOne({ username });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    await logEvent("failed_login", { username: username.slice(0, 50), ip: req.ip });
    return res.status(401).json({ error: "Wrong username or password" });
  }
  await logEvent("admin_action", { action: "login", admin: admin.username });
  res.json({ token: createSession(admin), username: admin.username });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ username: req.admin.username, role: req.admin.role });
});

module.exports = router;