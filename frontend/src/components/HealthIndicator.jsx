import { useEffect, useState } from "react";
import { getHealth } from "../api/reports";

export default function HealthIndicator() {
  const [state, setState] = useState("checking"); // checking | online | offline

  useEffect(() => {
    let alive = true;
    const check = () =>
      getHealth()
        .then((h) => alive && setState(h.status === "ok" && h.database === "connected" ? "online" : "offline"))
        .catch(() => alive && setState("offline"));
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const label = { checking: "Checking…", online: "API & database online", offline: "API unavailable" }[state];
  return (
    <span className={`health health-${state}`} title={label}>
      <span className="dot" />
      <span className="health-label">{label}</span>
    </span>
  );
}
