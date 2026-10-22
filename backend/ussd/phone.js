// Accepts +2547XXXXXXXX, 2547XXXXXXXX, 07XXXXXXXX, 7XXXXXXXX (and the 01 / 1 series)
function normalizePhone(input) {
  if (typeof input !== "string") return null;
  const s = input.replace(/[\s\-()]/g, "");
  const m = s.match(/^\+?254([17]\d{8})$/) || s.match(/^0([17]\d{8})$/) || s.match(/^([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

function maskPhone(p) {
  return p ? p.slice(0, 6) + "***" + p.slice(-3) : "unknown";
}

module.exports = { normalizePhone, maskPhone };