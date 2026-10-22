require("dotenv").config();
const readline = require("readline");
const { connectDB, getDB } = require("../db");
const { hashPassword } = require("../security/auth");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  await connectDB();
  const username = (await ask("Admin username: ")).trim();
  const password = await ask("Admin password (min 10 characters): ");
  rl.close();
  if (username.length < 3 || password.length < 10) {
    console.log("Username must be 3+ characters and password 10+ characters.");
    process.exit(1);
  }
  await getDB().collection("administrators").insertOne({
    username,
    passwordHash: hashPassword(password),
    role: "admin",
    createdAt: new Date(),
  });
  console.log(`Administrator "${username}" created.`);
  process.exit(0);
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});