import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Power, RefreshCw } from "lucide-react";
import { getMeter, getMeterHistory, setMeterStatus } from "../api/meters";
import { errorMessage } from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusBadge from "../components/StatusBadge";
import TableSkeleton from "../components/TableSkeleton";
import ConfirmDialog from "../components/ConfirmDialog";
import { effectiveTokenStatus, formatDate, short } from "../utils/format";

export default function MeterDetail() {
  const { meterId } = useParams();
  const toast = useToast();
  const [meter, setMeter] = useState(null);
  const [history, setHistory] = useState({ tokens: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmNext, setConfirmNext] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [m, h] = await Promise.all([getMeter(meterId), getMeterHistory(meterId)]);
      setMeter(m);
      setHistory(h);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async () => {
    setBusy(true);
    try {
      const updated = await setMeterStatus(meterId, confirmNext);
      setMeter(updated);
      toast.success(`Meter is now ${confirmNext}.`);
      setConfirmNext(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1><Link to="/meters" className="back"><ArrowLeft size={20} /></Link> {meterId}</h1>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {meter && (
        <section className="card">
          <div className="detail-grid">
            <div><span className="muted">Name</span><div>{meter.name}</div></div>
            <div><span className="muted">Location</span><div>{meter.location || "—"}</div></div>
            <div><span className="muted">Status</span><div><StatusBadge status={meter.status} /></div></div>
            <div><span className="muted">Registered</span><div>{formatDate(meter.createdAt)}</div></div>
          </div>
          <button
            className={`btn ${meter.status === "active" ? "btn-danger-outline" : "btn-primary"}`}
            onClick={() => setConfirmNext(meter.status === "active" ? "inactive" : "active")}
          >
            <Power size={16} /> {meter.status === "active" ? "Deactivate meter" : "Activate meter"}
          </button>
        </section>
      )}

      <section className="card">
        <h2>Tokens</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Token</th><th>kWh</th><th>Status</th><th>Created</th><th>Expires</th><th>Redeemed</th></tr></thead>
            <tbody>
              {loading ? <TableSkeleton cols={6} rows={3} /> : history.tokens.length === 0 ? (
                <tr><td colSpan={6} className="muted">No tokens for this meter.</td></tr>
              ) : history.tokens.map((t) => (
                <tr key={t.tokenId}>
                  <td>{short(t.tokenId)}</td>
                  <td>{t.kwh}</td>
                  <td><StatusBadge status={effectiveTokenStatus(t)} /></td>
                  <td>{formatDate(t.createdAt)}</td>
                  <td>{formatDate(t.expiresAt)}</td>
                  <td>{formatDate(t.redeemedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Transactions</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Status</th><th>Reason</th><th>kWh</th><th>Method</th><th>Sync</th></tr></thead>
            <tbody>
              {loading ? <TableSkeleton cols={6} rows={3} /> : history.transactions.length === 0 ? (
                <tr><td colSpan={6} className="muted">No transactions for this meter.</td></tr>
              ) : history.transactions.map((t) => (
                <tr key={t.transactionId}>
                  <td>{formatDate(t.createdAt)}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.reason || "—"}</td>
                  <td>{t.kwh ?? "—"}</td>
                  <td>{t.verificationMethod}</td>
                  <td>{t.syncStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmNext && (
        <ConfirmDialog
          title={confirmNext === "inactive" ? "Deactivate meter?" : "Activate meter?"}
          message={confirmNext === "inactive" ? "This meter will stop accepting tokens." : "This meter will accept tokens again."}
          confirmLabel={confirmNext === "inactive" ? "Deactivate" : "Activate"}
          danger={confirmNext === "inactive"}
          busy={busy}
          onConfirm={changeStatus}
          onCancel={() => setConfirmNext(null)}
        />
      )}
    </>
  );
}
