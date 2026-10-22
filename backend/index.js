require("dotenv").config();

const express = require("express");
const { connectDB, getDB } = require("./db");
const { ensureUssdIndexes } = require("./ussd/indexes");
const { loadKeys } = require("./security/tokens");
const { requireAdmin } = require("./security/auth");

for (const name of ["MONGODB_URI", "JWT_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "5kb" }));

app.get("/api/health", async (req, res) => {
  await getDB().command({ ping: 1 });
  res.json({ status: "ok", service: "PwaniGrid API", database: "connected", time: new Date().toISOString() });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/ussd", require("./routes/ussd"));
app.use("/api/redeem", require("./routes/redeem"));
app.use("/api/meters", requireAdmin, require("./routes/meters"));
app.use("/api/tokens", requireAdmin, require("./routes/tokens"));
app.use("/api", requireAdmin, require("./routes/reports"));

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Central error handler: never leak internal details
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 5000;


(async () => {
  console.log("STEP 1: Loading cryptographic keys");
  loadKeys();
  console.log("STEP 1 PASSED");

  console.log("STEP 2: Connecting to MongoDB");
  await connectDB();
  console.log("STEP 2 PASSED");

  console.log("STEP 3: Preparing USSD indexes");
  await ensureUssdIndexes();
  console.log("STEP 3 PASSED");

  app.listen(PORT, () => {
    console.log(`PwaniGrid API running on http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error("Startup failed:", err);
  process.exit(1);
});
