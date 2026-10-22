const tones = {
  active: "green", success: "green", redeemed: "green",
  inactive: "red", failed: "red", revoked: "red",
  unused: "yellow", pending: "yellow",
  expired: "grey",
};

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${tones[status] || "grey"}`}>{status || "—"}</span>;
}
