
import { useState } from "react";
import FilePicker from "../components/FilePicker";
import StatCard from "../components/StatCard";
import "./DataProfilling.css";

const API_URL = "http://localhost:5000/api/ingestion/csv";
const QUALITY_API_URL = "http://localhost:5000/api/profile/quality-check";

export default function DataProfiling({ onResults }) {
  const [file, setFile] = useState(null);

  // CSV profiling state
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Standard quality check state
  const [qualityResults, setQualityResults] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState("");

  // Reset results when a new file is selected
  function handleFileChange(newFile) {
    setFile(newFile);
    setResults(null);
    setError("");
    setQualityResults(null);
    setQualityError("");
    onResults?.(null);
  }

  // Common file upload helper
  async function postFile(url) {
    if (!file) {
      throw new Error("Please select a CSV file first.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  // CSV upload and profiling
  async function handleUpload() {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);
    setQualityResults(null);
    setQualityError("");
    onResults?.(null);

    try {
      const data = await postFile(API_URL);
      const report = data.qualityReport;

      if (!report) {
        throw new Error("Quality report was not returned by the backend.");
      }

      setResults(report);
      onResults?.(report);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend on port 5000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  // Standard predefined quality checks
  async function handleQualityCheck() {
    if (!file) {
      setQualityError("Please select a CSV file first.");
      return;
    }

    setQualityLoading(true);
    setQualityError("");
    setQualityResults(null);

    try {
      const data = await postFile(QUALITY_API_URL);
      setQualityResults(data);
    } catch (err) {
      setQualityError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the backend on port 5000."
          : err.message
      );
    } finally {
      setQualityLoading(false);
    }
  }

  // Download standard quality issues
  function handleDownloadIssues() {
    if (!qualityResults?.issues?.length) {
      setQualityError("There are no quality issues to download.");
      return;
    }

    const headers = [
      "CSV Row",
      "Column",
      "Invalid Value",
      "Rule",
      "Problem",
    ];

    function escapeCSV(value) {
      let text = String(value ?? "");

      // Prevent spreadsheet formula injection
      if (/^[\s]*[=+\-@]/.test(text)) {
        text = "'" + text;
      }

      return `"${text.replace(/"/g, '""')}"`;
    }

    const rows = qualityResults.issues.map((issue) => [
      issue.rowNumber,
      issue.column,
      issue.value,
      issue.rule,
      issue.message,
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "dataops-one-quality-issues.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  const columns = results?.columns || [];
  const rules = qualityResults?.rules || [];
  const issues = qualityResults?.issues || [];

  const missingTotal = Number(results?.missingValues ?? 0);

  const statusColor = (status) => {
    if (status === "PASS") return "green";
    if (status === "FAIL") return "crimson";
    return "#b7791f";
  };
console.log("QUALITY RESULTS:", qualityResults);
console.log("SHOULD DISPLAY REPORT:", Boolean(qualityResults));
  return (
    <section className="content-section dataops-dashboard">

      {/* Page heading */}
      <div className="section-heading">
        <div>
          <h2>CSV Data Profiler</h2>
          <p>
            Analyze completeness, missing values, duplicates,
            and data type issues.
          </p>
        </div>
      </div>

      {/* File upload */}
      <div className="upload-card">
        <FilePicker
          title="Choose your dataset"
          subtitle="Select a CSV file to analyze"
          file={file}
          onChange={handleFileChange}
        />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <button
            className="primary-button"
            onClick={handleUpload}
            disabled={loading || qualityLoading || !file}
          >
            {loading ? "Analyzing..." : "Upload & Analyze"}
          </button>

          <button
            className="primary-button"
            onClick={handleQualityCheck}
            disabled={loading || qualityLoading || !file}
          >
            {qualityLoading ? "Checking Quality..." : "Run Quality Checks"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {qualityError && <p className="error">{qualityError}</p>}
      </div>

      {/* CSV profiling dashboard */}
      {results && (
        <>
          <div className="stats-grid">
            <StatCard label="Total rows" value={results.rowCount} icon="▤" />
            <StatCard label="Total columns" value={results.columnCount} icon="▦" />
            <StatCard label="Missing values" value={missingTotal} icon="!" />
            <StatCard label="Type issues" value={results.typeIssues ?? 0} icon="⚠" />
            <StatCard label="Completeness" value={`${results.completeness ?? 0}%`} icon="%" />
            <StatCard label="Duplicate rows" value={results.duplicateRows ?? 0} icon="⧉" />
          </div>

          <div className="table-card">
            <h3>Data Quality Summary</h3>
            <p>
              Profiling status:{" "}
              <strong style={{ color: statusColor(results.status) }}>
                {results.status || "NOT AVAILABLE"}
              </strong>
            </p>
            <p>Total cells: {results.totalCells ?? 0}</p>
          </div>

          <div className="table-card">
            <h3>Column Quality Details</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Detected type</th>
                    <th>Missing values</th>
                    <th>Unique values</th>
                    <th>Duplicate values</th>
                    <th>Type issues</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column) => (
                    <tr key={column.column}>
                      <td>{column.column}</td>
                      <td>{column.detectedType ?? "N/A"}</td>
                      <td>{column.missingValues}</td>
                      <td>{column.uniqueValues}</td>
                      <td>{column.duplicateValues ?? 0}</td>
                      <td>{column.typeIssues ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

{qualityResults && (
  <div style={{
    background: "yellow",
    color: "black",
    padding: "20px",
    margin: "20px 0",
    border: "3px solid red"
  }}>
    <h2>DATA QUALITY REPORT TEST</h2>
    <p>File: {qualityResults.fileName}</p>
    <p>Score: {qualityResults.qualityScore}%</p>
    <p>Status: {qualityResults.status}</p>
  </div>
)}
      {/* Standard quality report */}
      {qualityResults && (
        <>
          <div className="table-card">
            <h3>Data Quality Report</h3>

            <p>
              File: <strong>{qualityResults.fileName}</strong>
            </p>

            <p>
              Validation status:{" "}
              <strong style={{ color: statusColor(qualityResults.status) }}>
                {qualityResults.status}
              </strong>
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                margin: "20px 0",
              }}
            >
              <div className="table-card">
                <p>Data Quality Score</p>
                <h2
                  style={{
                    fontSize: "32px",
                    color:
                      qualityResults.qualityScore >= 95
                        ? "green"
                        : qualityResults.qualityScore >= 80
                          ? "#f1cf9c"
                          : "crimson",
                  }}
                >
                  {qualityResults.qualityScore ?? "N/A"}%
                </h2>
                <p>Validation checks passed</p>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>
                  {Math.max(
                    0,
                    (qualityResults.totalRuleChecks ?? 0) -
                      (qualityResults.issueCount ?? 0)
                  )}{" "}
                  of {qualityResults.totalRuleChecks ?? 0} checks passed
                </p>
                <div
                  style={{
                    height: "10px",
                    background: "#e5e7eb",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, qualityResults.qualityScore ?? 0))}%`,
                      height: "100%",
                      background:
                        qualityResults.qualityScore >= 95
                          ? "#16a34a"
                          : qualityResults.qualityScore >= 80
                            ? "#d97706"
                            : "#dc2626",
                    }}
                  />
                </div>
              </div>

              <div className="table-card">
                <p>Rule Pass Rate</p>
                <h2 style={{ fontSize: "32px", color: "#2563eb" }}>
                  {qualityResults.rulePassRate ?? "N/A"}%
                </h2>
                <p>
                  {qualityResults.passedRules} of {qualityResults.rulesChecked} rules passed
                </p>
                <div
                  style={{
                    height: "10px",
                    background: "#e5e7eb",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, qualityResults.rulePassRate ?? 0))}%`,
                      height: "100%",
                      background: "#2563eb",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard label="Rows checked" value={qualityResults.rowCount} icon="▤" />
              <StatCard label="Rules checked" value={qualityResults.rulesChecked} icon="✓" />
              <StatCard label="Passed rules" value={qualityResults.passedRules} icon="✓" />
              <StatCard label="Failed rules" value={qualityResults.failedRules} icon="⚠" />
              <StatCard label="Total issues" value={qualityResults.issueCount} icon="!" />
              <StatCard label="Skipped rules" value={qualityResults.skippedRules} icon="—" />
            </div>
          </div>

          {/* Failed rules */}
          {qualityResults.failedRules > 0 && (
            <div
              className="table-card"
              style={{ borderLeft: "5px solid crimson", marginBottom: "16px" }}
            >
              <h3 style={{ color: "crimson" }}>Failed Validation Rules</h3>
              <p>{qualityResults.failedRules} validation rule(s) failed.</p>

              {rules
                .filter((rule) => rule.status === "FAIL")
                .map((rule, index) => (
                  <div
                    key={`${rule.name}-${index}`}
                    style={{
                      padding: "12px",
                      marginTop: "8px",
                      background: "#fef2f2",
                      borderRadius: "8px",
                    }}
                  >
                    <strong>{rule.name}</strong>
                    <p>Column: {rule.column ?? "N/A"}</p>
                    <p>Issues found: {rule.issueCount}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Validation rules table */}
          <div className="table-card">
            <h3>Validation Rules</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Column</th>
                    <th>Rows checked</th>
                    <th>Issues</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, index) => (
                    <tr key={`${rule.name}-${index}`}>
                      <td>{rule.name}</td>
                      <td>{rule.column ?? "N/A"}</td>
                      <td>{rule.checkedRows}</td>
                      <td>{rule.issueCount}</td>
                      <td>
                        <strong style={{ color: statusColor(rule.status) }}>
                          {rule.status}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detected issues */}
          <div className="table-card">
            <h3>Detected Data Quality Issues</h3>

            {issues.length === 0 ? (
              <p>No validation issues found. All applicable rules passed.</p>
            ) : (
              <>
                <p>
                  Found <strong>{issues.length}</strong> issues.
                </p>

                <button className="primary-button" onClick={handleDownloadIssues}>
                  Download Issues CSV
                </button>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>CSV row</th>
                        <th>Column</th>
                        <th>Invalid value</th>
                        <th>Rule</th>
                        <th>Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issues.map((issue, index) => (
                        <tr key={`${issue.rule}-${issue.rowNumber}-${index}`}>
                          <td>{issue.rowNumber}</td>
                          <td>{issue.column}</td>
                          <td>{issue.value || "(empty)"}</td>
                          <td>{issue.rule}</td>
                          <td>{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
