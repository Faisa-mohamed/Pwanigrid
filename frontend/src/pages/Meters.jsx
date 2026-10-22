import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Power, Eye, RefreshCw } from "lucide-react";
import { listMeters, setMeterStatus } from "../api/meters";
import { errorMessage } from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusBadge from "../components/StatusBadge";
import TableSkeleton from "../components/TableSkeleton";
import EmptyState from "../components/EmptyState";
import RegisterMeterModal from "../components/RegisterMeterModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatDate } from "../utils/format";

export default function Meters() {
  const toast = useToast();
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [confirm, setConfirm] = useState(null); // { meter, next }
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current; // ignore answers that arrive out of order
    setLoading(true);
    setError("");
    try {
      const data = await listMeters({ search, status });
      if (id === latest.current) setMeters(data);
    } catch (e) {
      if (id === latest.current) setError(errorMessage(e));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [search, status]);

  // Wait 300 ms after typing stops before asking the server
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const changeStatus = async () => {
    setBusy(true);
    try {
      await setMeterStatus(confirm.meter.meterId, confirm.next);
      toast.success(`${confirm.meter.meterId} is now ${confirm.next}.`);
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Meters</h1>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
          <Plus size={16} /> Register meter
        </button>
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input placeholder="Search by meter ID, name or location" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Meter ID</th><th>Name</th><th>Location</th><th>Status</th><th>Registered</th><th className="right">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <TableSkeleton cols={6} rows={5} /> : meters.map((m) => (
                <tr key={m.meterId}>
                  <td><Link className="link" to={`/meters/${m.meterId}`}>{m.meterId}</Link></td>
                  <td>{m.name}</td>
                  <td>{m.location || "—"}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{formatDate(m.createdAt)}</td>
                  <td className="right actions">
                    <Link className="btn btn-secondary btn-sm" to={`/meters/${m.meterId}`}><Eye size={14} /> View</Link>
                    <button
                      className={`btn btn-sm ${m.status === "active" ? "btn-danger-outline" : "btn-secondary"}`}
                      onClick={() => setConfirm({ meter: m, next: m.status === "active" ? "inactive" : "active" })}
                    >
                      <Power size={14} /> {m.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && meters.length === 0 && (
          <EmptyState
            title={search || status ? "No meters match your filters" : "No meters yet"}
            text={search || status ? "Try a different search or status." : "Register your first meter to get started."}
          />
        )}
      </section>

      {showRegister && <RegisterMeterModal onClose={() => setShowRegister(false)} onCreated={load} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.next === "inactive" ? "Deactivate meter?" : "Activate meter?"}
          message={
            confirm.next === "inactive"
              ? `${confirm.meter.meterId} will no longer accept tokens or new token generation.`
              : `${confirm.meter.meterId} will be able to accept tokens again.`
          }
          confirmLabel={confirm.next === "inactive" ? "Deactivate" : "Activate"}
          danger={confirm.next === "inactive"}
          busy={busy}
          onConfirm={changeStatus}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
