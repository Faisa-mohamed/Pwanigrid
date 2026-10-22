
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let privateKey;
let publicKey;

function loadKeys() {
  const priv = path.resolve(
    process.env.PRIVATE_KEY_PATH || "./keys/private.pem"
  );
  const pub = path.resolve(
    process.env.PUBLIC_KEY_PATH || "./keys/public.pem"
  );

  privateKey = crypto.createPrivateKey(fs.readFileSync(priv));
  publicKey = crypto.createPublicKey(fs.readFileSync(pub));

  console.log("Signing key type:", privateKey.asymmetricKeyType);

  if (privateKey.asymmetricKeyType !== "rsa") {
    throw new Error("Expected an RSA private key");
  }
}

// Base64 URL-safe encoding.
const toB64 = (data) =>
  Buffer.from(data).toString("base64url");

// Generate a 12-digit numeric customer code.
function generateNumericCode() {
  return crypto
    .randomInt(0, 1_000_000_000_000)
    .toString()
    .padStart(12, "0");
}

// Store a hash of the customer code instead of plaintext.
function hashNumericCode(code) {
  if (typeof code !== "string" || !/^\d{12}$/.test(code)) {
    throw new Error("Code must contain exactly 12 digits");
  }

  return crypto.createHash("sha256").update(code).digest("hex");
}

// Create a signed token. The private key stays on the backend.
function createSignedToken({ meterId, kwh, expiresAt, code }) {
  if (!privateKey) {
    throw new Error("Token signing keys have not been loaded");
  }

  if (typeof code !== "string" || !/^\d{12}$/.test(code)) {
    throw new Error("Customer code must contain exactly 12 digits");
  }

  if (typeof meterId !== "string" || meterId.length === 0) {
    throw new Error("A valid meter ID is required");
  }

  if (typeof kwh !== "number" || !Number.isFinite(kwh) || kwh <= 0) {
    throw new Error("kWh must be a positive number");
  }

  const payload = {
    v: 1,
    tid: crypto.randomBytes(16).toString("hex"),
    code,
    mid: meterId,
    kwh,
    iat: Math.floor(Date.now() / 1000),
    exp: expiresAt
      ? Math.floor(expiresAt.getTime() / 1000)
      : 0,
  };

  const body = toB64(JSON.stringify(payload));

  // RSA with SHA-256.
  const signature = crypto.sign(
    "sha256",
    Buffer.from(body, "utf8"),
    privateKey
  );

  return {
    token: `PG1.${body}.${toB64(signature)}`,
    payload,
  };
}

// Verify the signed token using the public key.
function verifySignedToken(token) {
  if (
    !publicKey ||
    typeof token !== "string" ||
    token.length > 2000
  ) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3 || parts[0] !== "PG1") {
    return null;
  }

  try {
    const ok = crypto.verify(
      "sha256",
      Buffer.from(parts[1], "utf8"),
      publicKey,
      Buffer.from(parts[2], "base64url")
    );

    if (!ok) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    if (
      payload.v !== 1 ||
      typeof payload.tid !== "string" ||
      typeof payload.mid !== "string" ||
      typeof payload.code !== "string" ||
      !/^\d{12}$/.test(payload.code) ||
      typeof payload.kwh !== "number" ||
      !Number.isFinite(payload.kwh) ||
      payload.kwh <= 0 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  loadKeys,
  generateNumericCode,
  hashNumericCode,
  createSignedToken,
  verifySignedToken,
};
