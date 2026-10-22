import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gauge, CheckCircle2, PowerOff, KeyRound, ArrowLeftRight, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import TableSkeleton from "../components/TableSkeleton";
import EmptyState from "../components/EmptyState";
import { getDashboard } from "../api/reports";
import { listMeters } from "../api/meters";
import { errorMessage } from "../api/client";
import { formatDate, short } from "../utils/format";

const LIST_LIMIT = 200; // the backend returns at most 200 meters

export default function Overview() {
  const [dash, setDash] = useState(null);
  const [meters, setMeters] = useState(null);
  const [dashErr, setDashErr] = useState("");
  const [metersErr, setMetersErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, m] = await Promise.allSettled([getDashboard(), listMeters()]);
    if (d.status === "fulfilled") { setDash(d.value); setDashErr(""); }
    else { setDash(null); setDashErr(errorMessage(d.reason)); }
    if (m.status === "fulfilled") { setMeters(m.value); setMetersErr(""); }
    else { setMeters(null); setMetersErr(errorMessage(m.reason)); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const capped = meters && meters.length >= LIST_LIMIT;
  const active = meters ? meters.filter((m) => m.status === "active").length : 0;
  const inactive = meters ? meters.filter((m) => m.status === "inactive").length : 0;
  const hint = capped ? `from the latest ${LIST_LIMIT} meters` : undefined;

  const chartData = dash
    ? [
        { name: "Redeemed", value: dash.redeemedTokens, color: "#16a34a" },
        { name: "Unused", value: dash.unusedTokens, color: "#ffc400" },
        { name: "Expired", value: dash.expiredTokens, color: "#94a3b8" },
      ]
    : [];

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {dashErr && <div className="alert alert-error">Dashboard statistics unavailable: {dashErr}</div>}
      {metersErr && <div className="alert alert-error">Meter list unavailable: {metersErr}</div>}

      <div className="stats-grid">
        <StatCard label="Registered meters" value={dash?.totalMeters} icon={Gauge} loading={loading} unavailable={!dash} />
        <StatCard label="Active meters" value={active} icon={CheckCircle2} tone="green" hint={hint} loading={loading} unavailable={!meters} />
        <StatCard label="Inactive meters" value={inactive} icon={PowerOff} tone="red" hint={hint} loading={loading} unavailable={!meters} />
        <StatCard label="Total tokens" value={dash?.totalTokens} icon={KeyRound} tone="yellow" loading={loading} unavailable={!dash} />
        <StatCard label="Recent transactions" value={dash?.recentTransactions?.length} icon={ArrowLeftRight} hint="latest 10 shown below" loading={loading} unavailable={!dash} />
      </div>

      <div className="stats-grid small">
        <StatCard label="Redeemed" value={dash?.redeemedTokens} tone="green" loading={loading} unavailable={!dash} />
        <StatCard label="Unused" value={dash?.unusedTokens} tone="yellow" loading={loading} unavailable={!dash} />
        <StatCard label="Expired" value={dash?.expiredTokens} loading={loading} unavailable={!dash} />
        <StatCard label="Failed redemptions" value={dash?.failedRedemptions} tone="red" loading={loading} unavailable={!dash} />
        <StatCard label="Security alerts" value={dash?.securityAlerts} tone="red" loading={loading} unavailable={!dash} />
      </div>

      <div className="two-col">
        <section className="card">
          <h2>Token status</h2>
          {loading ? (
            <div className="skeleton" style={{ height: 240 }} />
          ) : !dash ? (
            <EmptyState title="Unavailable" text="Token statistics could not be loaded." />
          ) : dash.totalTokens === 0 ? (
            <EmptyState title="No tokens yet" text="Generate a token to see activity here." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Recent meter registrations</h2>
            <Link to="/meters" className="link">View all</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Meter ID</th><th>Name</th><th>Status</th><th>Registered</th></tr></thead>
              <tbody>
                {loading ? <TableSkeleton cols={4} rows={4} /> : !meters ? (
                  <tr><td colSpan={4} className="muted">Unavailable</td></tr>
                ) : meters.length === 0 ? (
                  <tr><td colSpan={4} className="muted">No meters registered yet.</td></tr>
                ) : meters.slice(0, 5).map((m) => (
                  <tr key={m.meterId}>
                    <td><Link className="link" to={`/meters/${m.meterId}`}>{m.meterId}</Link></td>
                    <td>{m.name}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td>{formatDate(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="card">
        <h2>Recent transactions</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Meter</th><th>Token ref</th><th>Status</th><th>kWh</th><th>Method</th></tr></thead>
            <tbody>
              {loading ? <TableSkeleton cols={6} rows={4} /> : !dash ? (
                <tr><td colSpan={6} className="muted">Unavailable</td></tr>
              ) : dash.recentTransactions.length === 0 ? (
                <tr><td colSpan={6} className="muted">No transactions yet.</td></tr>
              ) : dash.recentTransactions.map((t) => (
                <tr key={t.transactionId}>
                  <td>{formatDate(t.createdAt)}</td>
                  <td>{t.meterId}</td>
                  <td>{short(t.tokenRef)}</td>
                  <td><StatusBadge status={t.status} />{t.reason ? <span className="muted"> {t.reason}</span> : null}</td>
                  <td>{t.kwh ?? "—"}</td>
                  <td>{t.verificationMethod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
