
export default function StatCard({ label, value, icon = "▤" }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <strong>{value ?? "—"}</strong>
    </article>
  );
}
