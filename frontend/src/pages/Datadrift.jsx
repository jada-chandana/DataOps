
import React, { useState } from "react";
import "./DataDrift.css";

const API_URL = "http://localhost:5000/api/profile/data-drift";

function DataDrift() {
  const [sourceFile, setSourceFile] = useState(null);
  const [targetFile, setTargetFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDetectDrift = async () => {
    if (!sourceFile || !targetFile) {
      setError("Please upload both CSV files.");
      return;
    }

    const formData = new FormData();
    formData.append("sourceFile", sourceFile);
    formData.append("targetFile", targetFile);

    try {
      setLoading(true);
      setError("");
      setResults(null);

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Drift detection failed.");
      }

      setResults(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value) =>
    value === null || value === undefined ? "N/A" : `${value}%`;

  return (
    <section className="content-section data-drift-page">
      <div className="drift-header">
        <div>
          <h2>Data Drift Detection</h2>
          <p>
            Compare baseline and current datasets to identify schema
            and row count changes.
          </p>
        </div>
        <span className="drift-tag">Data Monitoring</span>
      </div>

      <div className="drift-upload-grid">
        <div className="drift-upload-card">
          <div className="drift-icon">01</div>
          <h3>Baseline Dataset</h3>
          <p>Upload your original or previous CSV file.</p>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setSourceFile(e.target.files?.[0] || null);
              setResults(null);
              setError("");
            }}
          />

          {sourceFile && (
            <span className="drift-file-name">
              {sourceFile.name}
            </span>
          )}
        </div>

        <div className="drift-upload-card">
          <div className="drift-icon">02</div>
          <h3>Current Dataset</h3>
          <p>Upload the newly received CSV file.</p>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setTargetFile(e.target.files?.[0] || null);
              setResults(null);
              setError("");
            }}
          />

          {targetFile && (
            <span className="drift-file-name">
              {targetFile.name}
            </span>
          )}
        </div>
      </div>

      <button
        className="drift-detect-btn"
        onClick={handleDetectDrift}
        disabled={loading}
      >
        {loading ? "Analyzing datasets..." : "Detect Data Drift"}
      </button>

      {error && <div className="drift-error">{error}</div>}

      {results && (
        <div className="drift-results">
          <div className="drift-result-heading">
            <div>
              <h3>Data Drift Report</h3>
              <p>
                {results.sourceFile} → {results.targetFile}
              </p>
            </div>

            <span
              className={`drift-status ${
                results.status === "STABLE" ? "stable" : "warning"
              }`}
            >
              {results.status}
            </span>
          </div>

          <div className="drift-stats-grid">
            <div className="drift-stat-card">
              <span>Baseline Rows</span>
              <strong>{results.sourceRowCount}</strong>
            </div>

            <div className="drift-stat-card">
              <span>Current Rows</span>
              <strong>{results.targetRowCount}</strong>
            </div>

            <div className="drift-stat-card">
              <span>Row Count Change</span>
              <strong>
                {results.rowCountDifference > 0 ? "+" : ""}
                {results.rowCountDifference}
              </strong>
            </div>

            <div className="drift-stat-card">
              <span>Change Percentage</span>
              <strong>
                {formatPercentage(results.rowCountChangePercentage)}
              </strong>
            </div>
          </div>

          <div className="drift-schema-card">
            <h3>Schema Drift Analysis</h3>

            <p>
              Schema Match:{" "}
              <strong>
                {results.schemaMatch ? "Yes" : "No"}
              </strong>
            </p>

            <div className="drift-columns-grid">
              <div>
                <h4>Added Columns</h4>
                {results.addedColumns.length ? (
                  results.addedColumns.map((column) => (
                    <span className="drift-column-item added" key={column}>
                      + {column}
                    </span>
                  ))
                ) : (
                  <p>No added columns</p>
                )}
              </div>

              <div>
                <h4>Removed Columns</h4>
                {results.removedColumns.length ? (
                  results.removedColumns.map((column) => (
                    <span className="drift-column-item removed" key={column}>
                      - {column}
                    </span>
                  ))
                ) : (
                  <p>No removed columns</p>
                )}
              </div>
            </div>
          </div>

          <div className="drift-summary">
            <h3>Detection Summary</h3>
            <p>
              {results.driftDetected
                ? "Changes were detected between the baseline and current datasets."
                : "No schema or row count changes were detected."}
            </p>
            <p>
              Comparison method: {results.comparisonMode}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default DataDrift;
