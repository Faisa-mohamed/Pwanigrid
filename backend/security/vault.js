const crypto = require("crypto");

function key() {
  const hex = process.env.TOKEN_ENC_KEY || "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("TOKEN_ENC_KEY must be 64 hex characters");
  return Buffer.from(hex, "hex");
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

function decrypt(blob) {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// Keyed hash, used to recognise repeated USSD requests without storing PINs
function hmac(text) {
  return crypto.createHmac("sha256", key()).update(text).digest("hex");
}

module.exports = { encrypt, decrypt, hmac };