
import FilePicker from "../components/FilePicker";
import StatCard from "../components/StatCard";
import "./recolination.css";

const API_URL =
  "http://localhost:5000/api/profile/reconcile-records";

export default function Reconciliation({
  reconcileResults,
  setReconcileResults,
  sourceFile,
  setSourceFile,
  targetFile,
  setTargetFile,
}) {
  // Run source-to-target reconciliation
  async function handleReconcile() {
    if (!sourceFile || !targetFile) {
      alert("Please select both source and target CSV files.");
      return;
    }

    setReconcileResults({
      _loading: true,
    });

    try {
      const formData = new FormData();

      formData.append("sourceFile", sourceFile);
      formData.append("targetFile", targetFile);

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

  // Download JSON report
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

  // Download full reconciliation report
  function downloadFullReport() {
    if (
      !reconcileResults ||
      reconcileResults._loading ||
      reconcileResults._error
    ) {
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

  // Download mismatch report
  function downloadMismatchReport() {
    if (
      !reconcileResults ||
      reconcileResults._loading ||
      reconcileResults._error
    ) {
      return;
    }

    downloadJSON(
      {
        reportName: "DataOps One Mismatch Report",
        generatedAt: new Date().toISOString(),
        keyColumn: reconcileResults.keyColumn || null,
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
    <section className="content-section reconciliation-page">

      {/* Page Header */}
      <div className="section-heading">
        <div>
          <h2>Source-to-Target Reconciliation</h2>
          <p>
            Compare records between two CSV files and identify
            missing, extra, or mismatched data.
          </p>
        </div>
      </div>

      {/* File Upload Section */}
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

        <p className="helper-text">
          DataOps One will automatically identify a suitable
          unique key column from both datasets.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={handleReconcile}
          disabled={loading || !sourceFile || !targetFile}
        >
          {loading ? "Reconciling..." : "Run Reconciliation"}
        </button>

        {loading && (
          <p className="helper-text">
            Comparing source and target records...
          </p>
        )}

        {error && (
          <p className="error">
            {error}
          </p>
        )}
      </div>

      {/* Reconciliation Results */}
      {results && (
        <>
          {/* Results Header */}
          <div className="results-heading">
            <div>
              <p className="eyebrow">
                RECONCILIATION REPORT
              </p>

              <h2>Record-Level Results</h2>

              {results.keyColumn && (
                <p>
                  Automatically selected key:{" "}
                  <strong>{results.keyColumn}</strong>
                </p>
              )}
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

          {/* Statistics */}
          <div className="stats-grid">

            <StatCard
              label="Source Rows"
              value={results.sourceRowCount ?? 0}
              icon="▤"
            />

            <StatCard
              label="Target Rows"
              value={results.targetRowCount ?? 0}
              icon="▦"
            />

            <StatCard
              label="Matched Records"
              value={results.matchedCount ?? 0}
              icon="✓"
            />

            <StatCard
              label="Missing in Target"
              value={results.missingInTargetCount ?? 0}
              icon="!"
            />

            <StatCard
              label="Extra in Target"
              value={results.extraInTargetCount ?? 0}
              icon="+"
            />

            <StatCard
              label="Mismatched Records"
              value={results.mismatchedCount ?? 0}
              icon="⇄"
            />

          </div>

          {/* Schema Validation */}
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

          {/* Report Downloads */}
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
              disabled={
                !results.mismatchedRecords?.length
              }
            >
              Download Mismatches Only
            </button>

          </div>
        </>
      )}

    </section>
  );
}
