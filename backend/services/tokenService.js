
const { getDB } = require("../db");
const {
  generateNumericCode,
  hashNumericCode,
  createSignedToken,
} = require("../security/tokens");
const { logEvent } = require("../security/events");

class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function issueToken({
  meterId,
  kwh,
  expiresAt,
  createdBy,
  source = "admin",
  purchaseId = null,
}) {
  const db = getDB();

  const meter = await db.collection("meters").findOne({ meterId });

  if (!meter) {
    throw new ServiceError(404, "Meter not found");
  }

  if (meter.status !== "active") {
    throw new ServiceError(409, "Meter is deactivated");
  }

  // The database must have a unique index on codeHash.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateNumericCode();
    const codeHash = hashNumericCode(code);

    const { token: signedToken, payload } = createSignedToken({
      meterId,
      kwh,
      expiresAt,
      code,
    });

    const doc = {
      tokenId: payload.tid,
      codeHash,
      signedToken,
      meterId,
      kwh,
      status: "unused",
      createdAt: new Date(),
      createdBy,
      expiresAt: expiresAt || null,
      redeemedAt: null,
      revokedAt: null,
      source,
      purchaseId,
    };

    try {
      await db.collection("tokens").insertOne(doc);

      await logEvent("admin_action", {
        action: "generate_token",
        meterId,
        tokenId: doc.tokenId,
        admin: createdBy,
      });

      // Return the numeric code once. Do not return the signed token.
      const { codeHash: hiddenHash, signedToken: hiddenSignedToken, ...safeDoc } = doc;

      return {
        doc: safeDoc,
        token: code,
      };
    } catch (error) {
      if (error.code === 11000 && attempt < 4) {
        continue;
      }

      throw error;
    }
  }

  throw new ServiceError(
    503,
    "Could not generate a unique token. Please try again."
  );
}

module.exports = { issueToken, ServiceError };
