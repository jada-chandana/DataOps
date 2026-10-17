
import FilePicker from "../components/FilePicker";
import StatCard from "../components/StatCard";

const API_URL =
  "http://localhost:5000/api/profile/reconcile-records";

export default function Reconciliation({
  reconcileResults,
  setReconcileResults,
  sourceFile,
  setSourceFile,
  targetFile,
  setTargetFile,
  keyColumn,
  setKeyColumn,
}) {
  // Reconciliation loading and error states
  const [unused] = [null];

  // Run source-to-target reconciliation
  async function handleReconcile() {
    if (!sourceFile || !targetFile) {
      alert("Please select both source and target CSV files.");
      return;
    }

    if (!keyColumn.trim()) {
      alert("Please enter a unique key column, such as Employee_ID.");
      return;
    }

    setReconcileResults({
      _loading: true,
    });

    try {
      const formData = new FormData();

      formData.append("sourceFile", sourceFile);
      formData.append("targetFile", targetFile);
      formData.append("keyColumn", keyColumn.trim());

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Reconciliation failed."
        );
      }

      setReconcileResults(data);
    } catch (error) {
      setReconcileResults({
        _error:
          error.message === "Failed to fetch"
            ? "Cannot connect to the backend on port 5000."
            : error.message,
      });
    }
  }

  // Download a JSON report
  function downloadJSON(report, filename) {
    const blob = new Blob(
      [JSON.stringify(report, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadFullReport() {
    if (!reconcileResults || reconcileResults._loading ||
        reconcileResults._error) {
      return;
    }

    downloadJSON(
      {
        reportName: "DataOps One Record Reconciliation",
        generatedAt: new Date().toISOString(),
        sourceFileName: sourceFile?.name || "",
        targetFileName: targetFile?.name || "",
        ...reconcileResults,
      },
      "reconciliation-report.json"
    );
  }

  function downloadMismatchReport() {
    if (!reconcileResults || reconcileResults._loading ||
        reconcileResults._error) {
      return;
    }

    downloadJSON(
      {
        reportName: "DataOps One Mismatch Report",
        generatedAt: new Date().toISOString(),
        keyColumn: reconcileResults.keyColumn,
        mismatchCount: reconcileResults.mismatchedCount,
        mismatchedRecords:
          reconcileResults.mismatchedRecords || [],
      },
      "reconciliation-mismatches.json"
    );
  }

  const loading = reconcileResults?._loading === true;
  const error = reconcileResults?._error;
  const results =
    reconcileResults && !loading && !error
      ? reconcileResults
      : null;

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Source-to-Target Reconciliation</h2>
          <p>
            Compare records between two CSV files and identify
            missing, extra, or mismatched data.
          </p>
        </div>
      </div>

      <div className="upload-card">
        <div className="file-columns">
          <FilePicker
            title="Source CSV"
            subtitle="Select your original dataset"
            file={sourceFile}
            onChange={(newFile) => {
              setSourceFile(newFile);
              setReconcileResults(null);
            }}
          />

          <FilePicker
            title="Target CSV"
            subtitle="Select your processed dataset"
            file={targetFile}
            onChange={(newFile) => {
              setTargetFile(newFile);
              setReconcileResults(null);
            }}
          />
        </div>

        <label className="field-label">
          <strong>Unique Key Column</strong>

          <input
            className="text-input"
            type="text"
            value={keyColumn}
            onChange={(event) => {
              setKeyColumn(event.target.value);
              setReconcileResults(null);
            }}
            placeholder="Example: Employee_ID"
          />

          <span className="helper-text">
            Enter a column that exists in both CSV files and
            contains unique, non-empty values.
          </span>
        </label>

        <button
          type="button"
          className="primary-button"
          onClick={handleReconcile}
          disabled={loading || !sourceFile || !targetFile}
        >
          {loading ? "Reconciling..." : "Run Reconciliation"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      {results && (
        <>
          <div className="results-heading">
            <div>
              <p className="eyebrow">RECONCILIATION REPORT</p>
              <h2>Record-Level Results</h2>
            </div>

            <span
              className={
                results.status === "PASS"
                  ? "success-badge"
                  : "error-badge"
              }
            >
              {results.status}
            </span>
          </div>

          <div className="stats-grid">
            <StatCard
              label="Source Rows"
              value={results.sourceRowCount}
              icon="▤"
            />

            <StatCard
              label="Target Rows"
              value={results.targetRowCount}
              icon="▦"
            />

            <StatCard
              label="Matched Records"
              value={results.matchedCount}
              icon="✓"
            />

            <StatCard
              label="Missing in Target"
              value={results.missingInTargetCount}
              icon="!"
            />

            <StatCard
              label="Extra in Target"
              value={results.extraInTargetCount}
              icon="+"
            />

            <StatCard
              label="Mismatched Records"
              value={results.mismatchedCount}
              icon="⇄"
            />
          </div>

          <div className="table-card">
            <h3>Schema Validation</h3>

            <p>
              Schema match:{" "}
              <strong>
                {results.schemaMatch ? "Yes" : "No"}
              </strong>
            </p>

            {results.missingColumnsInTarget?.length > 0 && (
              <p>
                <strong>Missing target columns:</strong>{" "}
                {results.missingColumnsInTarget.join(", ")}
              </p>
            )}

            {results.extraColumnsInTarget?.length > 0 && (
              <p>
                <strong>Extra target columns:</strong>{" "}
                {results.extraColumnsInTarget.join(", ")}
              </p>
            )}
          </div>

          <div className="report-actions">
            <button
              type="button"
              className="primary-button"
              onClick={downloadFullReport}
            >
              Download Full JSON Report
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={downloadMismatchReport}
              disabled={!results.mismatchedRecords?.length}
            >
              Download Mismatches Only
            </button>
          </div>
        </>
      )}
    </section>
  );
}
