
const express = require("express");
const { getDB } = require("../db");
const { hashNumericCode } = require("../security/tokens");
const { logEvent } = require("../security/events");
const { issueToken, ServiceError } = require("../services/tokenService");

const router = express.Router();

const escapeRegex = (s) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function statusFilter(status, now) {
  if (status === "unused") {
    return {
      status: "unused",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
  }

  if (status === "expired") {
    return {
      $or: [
        { status: "expired" },
        { status: "unused", expiresAt: { $lte: now } },
      ],
    };
  }

  if (status === "redeemed" || status === "revoked") {
    return { status };
  }

  return {};
}

// Create a numeric customer token.
router.post("/", async (req, res, next) => {
  try {
    const { meterId, kwh, expiresInHours } = req.body || {};

    if (typeof meterId !== "string" || !meterId.trim()) {
      return res.status(400).json({
        error: "meterId is required",
      });
    }

    if (
      typeof kwh !== "number" ||
      !Number.isFinite(kwh) ||
      kwh <= 0 ||
      kwh > 10000
    ) {
      return res.status(400).json({
        error: "kwh must be a number between 0 and 10000",
      });
    }

    let expiresAt = null;

    if (
      expiresInHours !== undefined &&
      expiresInHours !== null &&
      expiresInHours !== ""
    ) {
      if (
        typeof expiresInHours !== "number" ||
        !Number.isFinite(expiresInHours) ||
        expiresInHours < 1 ||
        expiresInHours > 8760
      ) {
        return res.status(400).json({
          error: "expiresInHours must be 1 to 8760",
        });
      }

      expiresAt = new Date(
        Date.now() + expiresInHours * 3600 * 1000
      );
    }

    // Do not issue credit until payment/authorization is verified.
    // This route assumes that authorization is enforced by your
    // existing application before this handler is reached.

    const { doc, token } = await issueToken({
      meterId: meterId.trim(),
      kwh,
      expiresAt,
      createdBy: req.admin.username,
    });

    return res.status(201).json({
      ...doc,
      token,
    });
  } catch (error) {
    if (error instanceof ServiceError) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    next(error);
  }
});

// List tokens without exposing numeric codes, hashes, or signed tokens.
router.get("/", async (req, res, next) => {
  try {
    const now = new Date();
    const filter = statusFilter(req.query.status, now);

    if (typeof req.query.meterId === "string" && req.query.meterId) {
      filter.meterId = req.query.meterId;
    }

    if (
      typeof req.query.search === "string" &&
      req.query.search.trim()
    ) {
      const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");

      filter.$and = [
        {
          $or: [
            { tokenId: rx },
            { meterId: rx },
          ],
        },
      ];

      // Numeric code lookup is intentionally not supported in the list.
    }

    const list = await getDB()
      .collection("tokens")
      .find(filter, {
        projection: {
          codeHash: 0,
          signedToken: 0,
        },
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return res.json(
      list.map((t) =>
        t.status === "unused" &&
        t.expiresAt &&
        t.expiresAt <= now
          ? { ...t, status: "expired" }
          : t
      )
    );
  } catch (error) {
    next(error);
  }
});
// Retrieve a signed token for authorized device provisioning.
router.get("/:tokenId/signed-token", async (req, res, next) => {
  try {
    const record = await getDB().collection("tokens").findOne(
      { tokenId: req.params.tokenId },
      {
        projection: {
          _id: 0,
          tokenId: 1,
          meterId: 1,
          kwh: 1,
          status: 1,
          signedToken: 1,
        },
      }
    );

    if (!record) {
      return res.status(404).json({ error: "Token record not found" });
    }

    if (!record.signedToken) {
      return res.status(404).json({ error: "Signed token not found" });
    }

    // Do not expose a token that is no longer usable.
    if (record.status !== "unused") {
      return res.status(409).json({
        error: "Only unused tokens can be provisioned",
        status: record.status,
      });
    }

    return res.json(record);
  } catch (error) {
    next(error);
  }
});

// Revoke an unused, unexpired token.
router.post("/:tokenId/revoke", async (req, res, next) => {
  try {
    const now = new Date();

    const token = await getDB()
      .collection("tokens")
      .findOneAndUpdate(
        {
          tokenId: req.params.tokenId,
          status: "unused",
          $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $set: {
            status: "revoked",
            revokedAt: now,
          },
        },
        {
          returnDocument: "after",
          projection: {
            codeHash: 0,
            signedToken: 0,
          },
        }
      );

    if (!token) {
      return res.status(409).json({
        error: "Only unused, unexpired tokens can be revoked",
      });
    }

    await logEvent("admin_action", {
      action: "revoke_token",
      tokenId: token.tokenId,
      meterId: token.meterId,
      admin: req.admin.username,
    });

    return res.json(token);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
