
export default function Reports({ reconcileResults, onDownload }) {
  const hasResults =
    reconcileResults &&
    !reconcileResults._loading &&
    !reconcileResults._error;

  const reports = [
    {
      title: "Full Reconciliation Report",
      description:
        "Download source and target counts, matched records, schema validation, and reconciliation details.",
      filename: "reconciliation-report.json",
      type: "full",
      icon: "▤",
    },
    {
      title: "Mismatch Report",
      description:
        "Download records where source and target values differ.",
      filename: "reconciliation-mismatches.json",
      type: "mismatches",
      icon: "⇄",
    },
  ];

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Reports</h2>
          <p>
            View your latest reconciliation summary and download
            reports in JSON format.
          </p>
        </div>
      </div>

      {!hasResults ? (
        <div className="table-card">
          <h3>No reports available</h3>
          <p className="helper-text">
            Run a reconciliation first. Your downloadable reports
            will appear here after the analysis completes.
          </p>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-top">
                <span>Reconciliation Status</span>
                <span className="stat-icon">✓</span>
              </div>
              <strong>{reconcileResults.status || "—"}</strong>
            </div>

            <div className="stat-card">
              <div className="stat-card-top">
                <span>Matched Records</span>
                <span className="stat-icon">▤</span>
              </div>
              <strong>
                {reconcileResults.matchedCount ?? "—"}
              </strong>
            </div>

            <div className="stat-card">
              <div className="stat-card-top">
                <span>Mismatched Records</span>
                <span className="stat-icon">!</span>
              </div>
              <strong>
                {reconcileResults.mismatchedCount ?? "—"}
              </strong>
            </div>
          </div>

          <div className="report-grid">
            {reports.map((report) => {
              const mismatchCount =
                reconcileResults.mismatchedRecords?.length || 0;

              const disabled =
                report.type === "mismatches" &&
                mismatchCount === 0;

              return (
                <article className="report-card" key={report.type}>
                  <div className="report-file-icon">
                    {report.icon}
                  </div>

                  <div className="report-copy">
                    <h3>{report.title}</h3>
                    <p>{report.description}</p>
                    <span className="helper-text">
                      {report.filename}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onDownload(report.type)}
                    disabled={disabled}
                  >
                    {disabled
                      ? "No mismatches"
                      : "Download JSON"}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="table-card">
            <h3>Latest Reconciliation Details</h3>

            <div className="table-scroll">
              <table>
                <tbody>
                  <tr>
                    <th>Key column</th>
                    <td>{reconcileResults.keyColumn || "—"}</td>
                  </tr>
                  <tr>
                    <th>Source rows</th>
                    <td>{reconcileResults.sourceRowCount ?? "—"}</td>
                  </tr>
                  <tr>
                    <th>Target rows</th>
                    <td>{reconcileResults.targetRowCount ?? "—"}</td>
                  </tr>
                  <tr>
                    <th>Missing in target</th>
                    <td>
                      {reconcileResults.missingInTargetCount ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th>Extra in target</th>
                    <td>
                      {reconcileResults.extraInTargetCount ?? "—"}
                    </td>
                  </tr>
                  <tr>
                    <th>Schema match</th>
                    <td>
                      {reconcileResults.schemaMatch ? "Yes" : "No"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
