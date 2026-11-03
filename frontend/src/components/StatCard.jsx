
export default function StatCard({
  label,
  value,
  icon = "▤",
}) {
  const normalizedLabel = label?.toLowerCase() || "";

  let cardType = "default";

  if (
    normalizedLabel.includes("missing") ||
    normalizedLabel.includes("type issue")
  ) {
    cardType = "warning";
  } else if (
    normalizedLabel.includes("completeness")
  ) {
    cardType = Number(value) >= 95 ? "success" : "warning";
  } else if (
    normalizedLabel.includes("duplicate")
  ) {
    cardType = Number(value) > 0 ? "warning" : "success";
  }

  return (
    <article className={`stat-card stat-card-${cardType}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>

        <span className="stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className="stat-card-bottom">
        <strong className="stat-value">
          {value ?? "—"}
        </strong>

        <span className={`stat-indicator ${cardType}`}>
          {cardType === "success"
            ? "Healthy"
            : cardType === "warning"
            ? "Needs attention"
            : "Metric"}
        </span>
      </div>
    </article>
  );
}
