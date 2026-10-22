import { useCallback, useEffect, useState } from "react";
import { KeyRound, RefreshCw, Search, Plus, Ban, X } from "lucide-react";
import { listTokens, createToken, revokeToken } from "../api/tokens";
import { listMeters } from "../api/meters";
import { errorMessage } from "../api/client";
import { useToast } from "../context/ToastContext";
import { formatDate, short, effectiveTokenStatus } from "../utils/format";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

export default function Tokens() {
  const toast = useToast();
  const [items, setItems] = useState([]), [meters, setMeters] = useState([]);
  const [search, setSearch] = useState(""), [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false), [meterId, setMeterId] = useState(""), [kwh, setKwh] = useState(""), [expires, setExpires] = useState(""), [saving, setSaving] = useState(false), [created, setCreated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [t, m] = await Promise.all([
        listTokens({ search, status }),
        listMeters(),
      ]);
      setItems(Array.isArray(t) ? t : []);
      setMeters(Array.isArray(m) ? m : []);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createToken({
        meterId,
        kwh: Number(kwh),
        ...(expires ? { expiresInHours: Number(expires) } : {}),
      });

      setCreated(result);
      setShowCreate(false);
      setKwh("");
      setExpires("");
      toast.success("Token created. Copy its one-time code now.");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function onRevoke(token) {
    if (!window.confirm(`Revoke unused token ${token.tokenId}?`)) return;
    try {
      await revokeToken(token.tokenId);
      toast.success("Token revoked.");
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tokens</h1>
          <p className="muted">Manage signed meter-bound energy credits.</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCreated(null);
              setShowCreate(true);
            }}
          >
            <Plus size={15} /> Create token
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}{" "}
          <button className="btn btn-secondary btn-sm" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {created && (
        <div className="card one-time-result">
          <div className="card-head">
            <h2>Token created — copy now</h2>
            <button
              className="icon-btn"
              onClick={() => setCreated(null)}
              aria-label="Close"
            >
              <X size={17} />
            </button>
          </div>

          <p className="muted">
            The backend returns this code only at creation. It will not be shown again here.
          </p>

          <div className="stats-grid small">
            <div>
              <div className="stat-label">Token reference</div>
              <strong>{created.tokenId || "Created"}</strong>
            </div>
            <div>
              <div className="stat-label">Meter</div>
              <strong>{created.meterId}</strong>
            </div>
            <div>
              <div className="stat-label">Energy credit</div>
              <strong>{created.kwh} kWh</strong>
            </div>
            <div>
              <div className="stat-label">Keypad code</div>
              <strong>{created.token || "Not returned"}</strong>
            </div>
          </div>

          {created.signedToken && (
            <p className="muted">
              The full signed token is intentionally not displayed by this dashboard.
            </p>
          )}
        </div>
      )}

      <section className="card">
        <div className="filters">
          <label className="search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token or meter ID"
            />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="unused">Unused</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 220 }} />
        ) : !error && items.length === 0 ? (
          <EmptyState
            title="No tokens found"
            text="Issued tokens matching your filters will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Token ref</th>
                  <th>Meter</th>
                  <th>Credit</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const s = effectiveTokenStatus(t);
                  return (
                    <tr key={t.tokenId}>
                      <td>
                        <span title={t.tokenId}>{short(t.tokenId)}</span>
                      </td>
                      <td>{t.meterId || "—"}</td>
                      <td>
                        {t.kwh != null
                          ? `${t.kwh} kWh`
                          : t.durationSeconds != null
                            ? `${t.durationSeconds} sec`
                            : "—"}
                      </td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>{formatDate(t.expiresAt)}</td>
                      <td><StatusBadge status={s} /></td>
                      <td>
                        {s === "unused" ? (
                          <button
                            className="btn btn-danger-outline btn-sm"
                            onClick={() => onRevoke(t)}
                          >
                            <Ban size={13} /> Revoke
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted">Showing up to 200 records from the API.</p>
      </section>

      {showCreate && (
        <div className="modal-backdrop">
          <form className="modal card" onSubmit={onCreate}>
            <div className="card-head">
              <h2>Create meter token</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowCreate(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="muted">
              The backend signs and stores the token. Only create after the applicable payment/authorization has been verified.
            </p>

            <label className="field">
              Meter
              <select
                required
                value={meterId}
                onChange={(e) => setMeterId(e.target.value)}
              >
                <option value="">Select an active meter</option>
                {meters
                  .filter((m) => m.status === "active")
                  .map((m) => (
                    <option key={m.meterId} value={m.meterId}>
                      {m.meterId} — {m.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field">
              Energy credit (kWh)
              <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                required
                value={kwh}
                onChange={(e) => setKwh(e.target.value)}
              />
            </label>

            <label className="field">
              Expiry (hours, optional)
              <input
                type="number"
                min="1"
                max="8760"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>

            <div className="action-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={
                  saving ||
                  !meters.some(
                    (m) => m.meterId === meterId && m.status === "active"
                  )
                }
              >
                {saving ? "Creating…" : "Create token"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
