const { getDB } = require("../db");
const { hashPassword, verifyPassword } = require("../security/auth");
const { hmac, decrypt } = require("../security/vault");
const { logEvent } = require("../security/events");
const { normalizePhone, maskPhone } = require("./phone");
const { makeLimiter } = require("./limits");
const { createPurchase, kwhFor } = require("../services/purchaseService");
const { simulationEnabled } = require("../services/paymentService");
const { sendSms } = require("../services/smsService");

const MAX_PIN_TRIES = 3;
const LOCK_MINUTES = 30;
const MAX_RESENDS = 5;
const AMOUNTS = [50, 100, 200, 500];

const allowRequest = makeLimiter({ windowMs: 60 * 1000, max: 30 });
const allowNewSession = makeLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

const GUEST = "Welcome to PwaniGrid\n1. Register\n2. Help";
const MENU = "PwaniGrid\n1. Balance\n2. Buy electricity\n3. Get my token\n4. Transaction status\n5. Help\n0. Exit";
const BUY_MENU = "Buy electricity\n1. KES 50\n2. KES 100\n3. KES 200\n4. KES 500\n0. Back";
const HELP = "PwaniGrid help:\nTokens arrive by SMS.\nForgot PIN or no token? Visit your PwaniGrid agent.";

const con = (message) => ({ type: "CON", message });
const end = (message) => ({ type: "END", message });
const fit = (r) => ({ type: r.type, message: r.message.slice(0, 182) }); // USSD screen limit
const tail = (s) => String(s).slice(-3);
const sessionSeconds = () => Math.max(30, Number(process.env.USSD_SESSION_SECONDS) || 120);

function tokenLabel(p, t, now) {
  if (p.status === "pending_payment") return "awaiting payment";
  if (p.status === "failed") return "payment failed";
  if (p.status === "paid_issue_failed") return "paid, token delayed";
  if (!t) return "paid";
  if (t.status === "redeemed") return "token used";
  if (t.status === "revoked") return "token revoked";
  if (t.expiresAt && t.expiresAt <= now) return "token expired";
  return "token ready";
}

// One step of the menu. Returns { res, state, data }.
async function step(session, input) {
  const db = getDB();
  const customers = db.collection("customers");
  const { phone } = session;
  const data = session.data || {};
  const now = new Date();
  const customer = await customers.findOne({ phone });
  const stay = (message, state, d = data) => ({ res: con(message), state, data: d });
  const finish = (message) => ({ res: end(message), state: "ENDED", data: {} });

  if (customer && customer.status === "disabled") {
    return finish("This number cannot use PwaniGrid. Contact your agent.");
  }
  const active = customer && customer.status === "active";

  switch (session.state) {
    case "START": {
      if (!customer || customer.status === "pending_pin") return stay(GUEST, "GUEST_MENU", {});
      if (customer.lockedUntil && customer.lockedUntil > now) {
        return finish("PIN locked. Try again later or visit your agent.");
      }
      return stay("PwaniGrid\nEnter your 4-digit PIN:", "AUTH_PIN", {});
    }

    case "GUEST_MENU": {
      if (input === "2") return finish(HELP);
      if (input === "1") {
        if (!customer || customer.status !== "pending_pin") {
          await logEvent("ussd_unregistered_phone", { phone: maskPhone(phone) });
          return finish("This phone is not authorized for a meter. Please visit your PwaniGrid agent.");
        }
        return stay("Set a 4-digit PIN:", "REG_PIN", {});
      }
      return stay("Invalid choice.\n" + GUEST, "GUEST_MENU");
    }

    case "REG_PIN": {
      const simple = /^(\d)\1{3}$/.test(input) || "01234567890".includes(input) || "09876543210".includes(input);
      if (!/^\d{4}$/.test(input) || simple) {
        return stay("PIN must be 4 digits and not simple (like 1234).\nSet a 4-digit PIN:", "REG_PIN");
      }
      return stay("Confirm your PIN:", "REG_PIN_CONFIRM", { pinHash: hashPassword(input) });
    }

    case "REG_PIN_CONFIRM": {
      if (!data.pinHash || !verifyPassword(input, data.pinHash)) {
        return stay("PINs did not match.\nSet a 4-digit PIN:", "REG_PIN", {});
      }
      const r = await customers.updateOne(
        { phone, status: "pending_pin" },
        { $set: { pinHash: data.pinHash, status: "active", registeredAt: now, failedPins: 0, lockedUntil: null } }
      );
      if (!r.modifiedCount) return finish("Registration failed. Contact your agent.");
      return finish(`Registered for meter ending ${tail(customer.meterId)}. Dial again to use PwaniGrid.`);
    }

    case "AUTH_PIN": {
      if (!active) return finish("Session error. Please dial again.");
      if (customer.lockedUntil && customer.lockedUntil > now) return finish("PIN locked. Try again later.");
      if (!/^\d{4}$/.test(input)) return stay("Enter your 4-digit PIN:", "AUTH_PIN");
      if (verifyPassword(input, customer.pinHash)) {
        await customers.updateOne({ phone }, { $set: { failedPins: 0, lockedUntil: null } });
        return stay(MENU, "MENU", {});
      }
      const upd = await customers.findOneAndUpdate({ phone }, { $inc: { failedPins: 1 } }, { returnDocument: "after" });
      if (upd.failedPins >= MAX_PIN_TRIES) {
        await customers.updateOne(
          { phone },
          { $set: { lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000), failedPins: 0 } }
        );
        await logEvent("ussd_pin_lockout", { phone: maskPhone(phone), meterId: customer.meterId });
        return finish(`Too many wrong PINs. Locked for ${LOCK_MINUTES} minutes.`);
      }
      await logEvent("ussd_pin_failed", { phone: maskPhone(phone), meterId: customer.meterId });
      return stay(`Wrong PIN. ${MAX_PIN_TRIES - upd.failedPins} tries left.\nEnter your PIN:`, "AUTH_PIN");
    }

    case "MENU": {
      if (!active) return finish("Session error. Please dial again.");
      if (input === "0") return finish("Goodbye.");

      if (input === "1") {
        const tokens = await db.collection("tokens").find({ meterId: customer.meterId }).limit(500).toArray();
        let loaded = 0;
        let waiting = 0;
        for (const t of tokens) {
          if (t.status === "redeemed") loaded += t.kwh;
          if (t.status === "unused" && (!t.expiresAt || t.expiresAt > now)) waiting += t.kwh;
        }
        const r2 = (n) => Math.round(n * 100) / 100;
        return finish(
          `Meter ending ${tail(customer.meterId)}\nLoaded to meter: ${r2(loaded)} kWh\nUnused tokens: ${r2(waiting)} kWh\n(Live balance needs the meter device)`
        );
      }

      if (input === "2") return stay(BUY_MENU, "BUY_AMOUNT", {});

      if (input === "3") {
        const purchases = db.collection("purchases");
        const p = await purchases.findOne({ phone, tokenEnc: { $ne: null } }, { sort: { createdAt: -1 } });
        if (!p) return finish("No token found. Buy electricity first.");
        const t = await db.collection("tokens").findOne({ tokenId: p.tokenId });
        const usable = t && t.status === "unused" && (!t.expiresAt || t.expiresAt > now);
        if (!usable) {
          const why = !t ? "unavailable" : t.status === "unused" ? "expired" : t.status;
          return finish(`Your latest token (${p.purchaseId}) is ${why}.`);
        }
        const claimed = await purchases.findOneAndUpdate(
          { purchaseId: p.purchaseId, resendCount: { $lt: MAX_RESENDS } },
          { $inc: { resendCount: 1 } }
        );
        if (!claimed) return finish("Resend limit reached. Contact your agent.");
        await sendSms(phone, `PwaniGrid token for meter ${p.meterId} (${p.kwh} kWh): ${decrypt(p.tokenEnc)}`);
        await logEvent("ussd_token_resend", { purchaseId: p.purchaseId, meterId: p.meterId });
        return finish(`Token sent by SMS. Ref ${p.purchaseId}, ${p.kwh} kWh.`);
      }

      if (input === "4") {
        const list = await db.collection("purchases").find({ phone }).sort({ createdAt: -1 }).limit(3).toArray();
        if (!list.length) return finish("No purchases yet.");
        const ids = list.map((p) => p.tokenId).filter(Boolean);
        const toks = await db.collection("tokens").find({ tokenId: { $in: ids } }).toArray();
        const lines = list.map((p) => {
          const t = toks.find((x) => x.tokenId === p.tokenId);
          return `${p.purchaseId} KES ${p.amountKes}: ${tokenLabel(p, t, now)}`;
        });
        return finish(lines.join("\n"));
      }

      if (input === "5") return finish(HELP);
      return stay("Invalid choice.\n" + MENU, "MENU");
    }

    case "BUY_AMOUNT": {
      if (!active) return finish("Session error. Please dial again.");
      if (input === "0") return stay(MENU, "MENU", {});
      const amountKes = AMOUNTS[Number(input) - 1];
      if (!/^[1-4]$/.test(input) || !amountKes) return stay("Invalid choice.\n" + BUY_MENU, "BUY_AMOUNT");
      const tag = simulationEnabled() ? "[SIMULATED PAYMENT]\n" : "";
      return stay(`${tag}Buy ${kwhFor(amountKes)} kWh for KES ${amountKes}?\n1. Yes\n2. No`, "BUY_CONFIRM", { amountKes });
    }

    case "BUY_CONFIRM": {
      if (!active) return finish("Session error. Please dial again.");
      if (input === "2") return stay(MENU, "MENU", {});
      if (input !== "1") return stay("Invalid choice.\n1. Yes\n2. No", "BUY_CONFIRM");
      const key = `ussd:${session.sessionId}:buy`;
      const meter = await db.collection("meters").findOne({ meterId: customer.meterId });
      if (!meter || meter.status !== "active") return finish("Your meter is not active. Contact your agent.");
      const since = new Date(now.getTime() - 10 * 60 * 1000);
      const pending = await db.collection("purchases").findOne({ phone, status: "pending_payment", createdAt: { $gt: since } });
      if (pending && pending.idempotencyKey !== key) {
        return finish(`You already have a payment waiting. Ref ${pending.purchaseId}.`);
      }
      const { purchase, duplicate, initiated } = await createPurchase({
        phone,
        meterId: customer.meterId,
        amountKes: data.amountKes,
        idempotencyKey: key,
      });
      if (!initiated) return finish("Could not start payment. Please try again later.");
      if (!duplicate) {
        await logEvent("ussd_purchase", { purchaseId: purchase.purchaseId, meterId: purchase.meterId, amountKes: purchase.amountKes });
      }
      const tag = simulationEnabled() ? "[SIMULATION] " : "";
      return finish(`${tag}Payment request sent. Approve it on your phone. Ref ${purchase.purchaseId}. Token comes by SMS.`);
    }

    default:
      return finish("Session error. Please dial again.");
  }
}

async function handleUssd({ sessionId, phoneNumber, text }) {
  const phone = normalizePhone(phoneNumber);
  const body = text === undefined || text === null ? "" : String(text);
  if (!phone || typeof sessionId !== "string" || !/^[\w.:\-]{3,100}$/.test(sessionId) || body.length > 200 || !/^[0-9*]*$/.test(body)) {
    return fit(end("Invalid request."));
  }
  if (!allowRequest(phone)) {
    await logEvent("ussd_rate_limited", { phone: maskPhone(phone) });
    return fit(end("Too many requests. Try again later."));
  }

  const sessions = getDB().collection("ussdSessions");
  const now = new Date();
  const ttl = () => new Date(Date.now() + sessionSeconds() * 1000);

  let session = await sessions.findOne({ sessionId });
  if (session && session.expiresAt <= now) {
    await sessions.deleteOne({ sessionId });
    session = null;
  }
  if (!session) {
    if (body !== "") return fit(end("Session expired. Please dial again."));
    if (!allowNewSession(phone)) {
      await logEvent("ussd_rate_limited", { phone: maskPhone(phone) });
      return fit(end("Too many requests. Try again later."));
    }
    session = {
      sessionId, phone, state: "START", data: {},
      lastTextHash: null, lastResponse: null, responseFor: null,
      createdAt: now, expiresAt: ttl(),
    };
    try {
      await sessions.insertOne(session);
    } catch (e) {
      if (e.code !== 11000) throw e;
      session = await sessions.findOne({ sessionId });
    }
  }
  if (!session || session.phone !== phone) {
    await logEvent("ussd_session_mismatch", { phone: maskPhone(phone) });
    return fit(end("Invalid request."));
  }

  // Repeated callback (same session, same input history): replay the saved answer, do nothing new.
  const textHash = hmac(`${sessionId}|${body}`);
  if (session.lastTextHash === textHash) {
    return fit(session.responseFor === textHash && session.lastResponse ? session.lastResponse : con("Processing. Please wait."));
  }
  if (session.state === "ENDED") return fit(end("Session ended. Please dial again."));

  // Claim this request so two simultaneous copies cannot both run
  const claimed = await sessions.findOneAndUpdate(
    { sessionId, lastTextHash: { $ne: textHash } },
    { $set: { lastTextHash: textHash } },
    { returnDocument: "after" }
  );
  if (!claimed) return fit(con("Processing. Please wait."));

  const input = body === "" ? "" : body.split("*").pop().trim();
  let out;
  try {
    out = await step(claimed, input);
  } catch (err) {
    console.error("USSD step failed:", err.message);
    out = { res: end("Service temporarily unavailable. Please try again."), state: "ENDED", data: {} };
  }
  const finished = out.res.type === "END";
  await sessions.updateOne(
    { sessionId },
    {
      $set: {
        state: finished ? "ENDED" : out.state,
        data: out.data || {},
        lastResponse: out.res,
        responseFor: textHash,
        expiresAt: finished ? new Date(Date.now() + 60000) : ttl(),
      },
    }
  );
  return fit(out.res);
}

module.exports = { handleUssd };