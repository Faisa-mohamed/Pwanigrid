export const formatDate = (d) => (d ? new Date(d).toLocaleString() : "—");
export const short = (s) => (s ? String(s).slice(0, 8) : "—");

// Unused tokens past their expiry time count as expired
export function effectiveTokenStatus(t) {
  if (t.status === "unused" && t.expiresAt && new Date(t.expiresAt) <= new Date()) return "expired";
  return t.status;
}
