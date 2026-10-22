
const express = require("express");
const crypto = require("crypto");
const { getDB } = require("../db");
const {
  verifySignedToken,
  hashNumericCode,
} = require("../security/tokens");
const { logEvent } = require("../security/events");
const { rateLimit } = require("../security/auth");

const router = express.Router();

async function recordFailure(
  res,
  http,
  reason,
  eventType,
  meterId,
  tokenId
) {
  const db = getDB();

  await db.collection("transactions").insertOne({
    transactionId: crypto.randomUUID(),
    meterId,
    tokenRef: tokenId || null,
    status: "failed",
    reason,
    verificationMethod: "online-backend",
    syncStatus: "not_applicable",
    createdAt: new Date(),
  });

  await logEvent(eventType, {
    meterId,
    tokenId: tokenId || null,
  });

  return res.status(http).json({
    success: false,
    error: reason,
  });
}

router.post("/", rateLimit({ windowMs: 60 * 1000, max: 20 }), async (req, res, next) => {
  try {
    const { token, meterId } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^\d{12}$/.test(token) ||
      typeof meterId !== "string" ||
      !meterId.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "A 12-digit token and meterId are required",
      });
    }

    const db = getDB();
    const now = new Date();

    // Find the token using its hash, not its plaintext code.
    const codeHash = hashNumericCode(token);

    const doc = await db.collection("tokens").findOne({
      codeHash,
    });

    if (!doc || !doc.signedToken) {
      return recordFailure(
        res,
        400,
        "Invalid token",
        "invalid_token",
        meterId.slice(0, 40),
        null
      );
    }

    // Verify the server-side signed token.
    const payload = verifySignedToken(doc.signedToken);

    if (
      !payload ||
      payload.tid !== doc.tokenId ||
      payload.code !== token ||
      payload.mid !== doc.meterId ||
      payload.kwh !== doc.kwh
    ) {
      return recordFailure(
        res,
        400,
        "Invalid token signature or record",
        "invalid_token",
        meterId.slice(0, 40),
        doc.tokenId
      );
    }

    // The token must belong to the requested meter.
    if (payload.mid !== meterId || doc.meterId !== meterId) {
      return recordFailure(
        res,
        403,
        "Token is for a different meter",
        "wrong_meter",
        meterId.slice(0, 40),
        doc.tokenId
      );
    }

    const meter = await db.collection("meters").findOne({ meterId });

    if (!meter || meter.status !== "active") {
      return recordFailure(
        res,
        409,
        "Meter is not active",
        "inactive_meter",
        meterId,
        doc.tokenId
      );
    }

    if (doc.status === "redeemed") {
      return recordFailure(
        res,
        409,
        "Token already used",
        "duplicate_redemption",
        meterId,
        doc.tokenId
      );
    }

    if (doc.status === "revoked") {
      return recordFailure(
        res,
        409,
        "Token was revoked",
        "revoked_token",
        meterId,
        doc.tokenId
      );
    }

    if (
      doc.status !== "unused" ||
      (doc.expiresAt && doc.expiresAt <= now) ||
      (payload.exp !== 0 && payload.exp <= Math.floor(now.getTime() / 1000))
    ) {
      return recordFailure(
        res,
        410,
        "Token has expired or is not redeemable",
        "expired_token",
        meterId,
        doc.tokenId
      );
    }

    // Atomic update: only one request can redeem the token.
    const won = await db.collection("tokens").findOneAndUpdate(
      {
        tokenId: doc.tokenId,
        codeHash,
        meterId,
        status: "unused",
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $set: {
          status: "redeemed",
          redeemedAt: now,
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!won) {
      return recordFailure(
        res,
        409,
        "Token already used or no longer valid",
        "duplicate_redemption",
        meterId,
        doc.tokenId
      );
    }

    await db.collection("transactions").insertOne({
      transactionId: crypto.randomUUID(),
      meterId,
      tokenRef: won.tokenId,
      status: "success",
      reason: null,
      kwh: won.kwh,
      verificationMethod: "online-backend",
      syncStatus: "not_applicable",
      createdAt: now,
    });

    await logEvent("token_redeemed", {
      meterId,
      tokenId: won.tokenId,
    });

    return res.json({
      success: true,
      kwh: won.kwh,
      meterId,
      tokenId: won.tokenId,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
