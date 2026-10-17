
import StatCard from "../components/StatCard";

export default function Overview({
  results,
  reconcileResults,
  onNavigate,
}) {
  const columns = results?.columns || [];

  const missingValues = columns.reduce(
    (total, column) =>
      total + Number(column.missingValues || 0),
    0
  );

  const stats = [
    {
      label: "Rows Profiled",
      value: results?.rowCount,
      icon: "▤",
    },
    {
      label: "Missing Values",
      value: results ? missingValues : undefined,
      icon: "!",
    },
    {
      label: "Matched Records",
      value: reconcileResults?.matchedCount,
      icon: "✓",
    },
    {
      label: "Mismatched Records",
      value: reconcileResults?.mismatchedCount,
      icon: "⇄",
    },
  ];

  return (
    <section className="content-section">
      {/* Welcome section */}
      <div className="welcome-banner">
        <div>
          <p className="eyebrow">DATA QUALITY WORKSPACE</p>

          <h2>Welcome to DataOps One</h2>

          <p>
            Profile your datasets, validate data quality, and
            compare source and target records in one place.
          </p>
        </div>

        <div className="welcome-icon">▦</div>
      </div>

      {/* Dynamic statistics */}
      <div className="section-heading">
        <div>
          <h2>Workspace Overview</h2>
          <p>Your latest analysis results.</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Quick actions */}
      <div className="section-heading">
        <div>
          <h2>Quick Actions</h2>
          <p>Choose what you want to do next.</p>
        </div>
      </div>

      <div className="quick-grid">
        <button
          type="button"
          className="quick-card"
          onClick={() => onNavigate("profiling")}
        >
          <span className="quick-card-icon">▤</span>
          <h3>Data Profiling</h3>
          <p>
            Upload a CSV and inspect missing values, duplicates,
            and unique values.
          </p>
          <span className="quick-link">Analyze dataset →</span>
        </button>

        <button
          type="button"
          className="quick-card"
          onClick={() => onNavigate("reconciliation")}
        >
          <span className="quick-card-icon">⇄</span>
          <h3>Reconciliation</h3>
          <p>
            Compare source and target files to identify missing,
            extra, and mismatched records.
          </p>
          <span className="quick-link">Compare datasets →</span>
        </button>

        <button
          type="button"
          className="quick-card"
          onClick={() => onNavigate("reports")}
        >
          <span className="quick-card-icon">▧</span>
          <h3>Reports</h3>
          <p>
            Download a reconciliation report or a report of
            mismatched records.
          </p>
          <span className="quick-link">View reports →</span>
        </button>
      </div>

      {/* Latest activity */}
      <div className="table-card">
        <h3>Latest Activity</h3>

        {!results && !reconcileResults ? (
          <p className="helper-text">
            No analysis completed yet. Upload a CSV file to get
            started.
          </p>
        ) : (
          <div className="activity-list">
            {results && (
              <div className="activity-item">
                <span className="activity-dot" />
                <div>
                  <strong>CSV profiling completed</strong>
                  <p>
                    {results.fileName || "Dataset"} —{" "}
                    {results.rowCount} rows and{" "}
                    {results.columnCount} columns analyzed.
                  </p>
                </div>
              </div>
            )}

            {reconcileResults && (
              <div className="activity-item">
                <span className="activity-dot" />
                <div>
                  <strong>Reconciliation completed</strong>
                  <p>
                    {reconcileResults.matchedCount} matched,{" "}
                    {reconcileResults.missingInTargetCount} missing
                    in target,{" "}
                    {reconcileResults.extraInTargetCount} extra,
                    and {reconcileResults.mismatchedCount} mismatched.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
