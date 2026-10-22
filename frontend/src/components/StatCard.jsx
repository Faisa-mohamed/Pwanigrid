export default function StatCard({ label, value, icon: Icon, tone = "navy", hint, loading, unavailable }) {
  return (
    <div className="card stat">
      <div className={`stat-icon tone-${tone}`}>{Icon && <Icon size={22} />}</div>
      <div>
        <div className="stat-label">{label}</div>
        {loading ? (
          <div className="skeleton" style={{ width: 70, height: 26, marginTop: 6 }} />
        ) : unavailable ? (
          <div className="stat-value unavailable">Unavailable</div>
        ) : (
          <div className="stat-value">{value}</div>
        )}
        {hint && !loading && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}
