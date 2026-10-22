const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "..", "keys");
fs.mkdirSync(dir, { recursive: true });

if (fs.existsSync(path.join(dir, "private.pem"))) {
  console.log("Keys already exist. Delete the keys folder first if you really want new ones.");
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
fs.writeFileSync(path.join(dir, "private.pem"), privateKey.export({ type: "pkcs8", format: "pem" }));
fs.writeFileSync(path.join(dir, "public.pem"), publicKey.export({ type: "spki", format: "pem" }));
console.log("Keys created in backend/keys (private.pem stays on the backend only).");