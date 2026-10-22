const crypto = require("crypto");

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(":");
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

const sign = (body) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(body).digest("base64url");

function createSession(admin) {
  const payload = {
    sub: String(admin._id),
    username: admin.username,
    role: admin.role,
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8 hours
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [body, sig] = token.split(".");
  if (!body || !sig) return res.status(401).json({ error: "Login required" });

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return res.status(401).json({ error: "Invalid session" });
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return res.status(401).json({ error: "Session expired" });
    if (payload.role !== "admin") return res.status(403).json({ error: "Not allowed" });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
}

// Simple in-memory limiter (fine for a prototype)
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}

module.exports = { hashPassword, verifyPassword, createSession, requireAdmin, rateLimit };