
import { useState } from "react";
import FilePicker from "../components/FilePicker";
import StatCard from "../components/StatCard";

const API_URL = "http://localhost:5000/api/profile/profile";
const QUALITY_API_URL =
  "http://localhost:5000/api/profile/quality-check";

  const CUSTOM_QUALITY_API_URL =
  "http://localhost:5000/api/profile/custom-quality-check";

export default function DataProfiling({ onResults }) {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [qualityResults, setQualityResults] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState("");

  const [customRules, setCustomRules] = useState([
  { name: "REQUIRED", column: "Employee_ID" },
  { name: "RANGE", column: "Age", min: 18, max: 100 },
  { name: "EMAIL_FORMAT", column: "Email" },
  { name: "NON_NEGATIVE", column: "Salary_INR" },
  {
    name: "ALLOWED_VALUES",
    column: "Employment_Status",
    values: "Active, Inactive, On Leave",
  },
]);

const [customResults, setCustomResults] = useState(null);
const [customLoading, setCustomLoading] = useState(false);
const [customError, setCustomError] = useState("");

  function handleFileChange(newFile) {
    setFile(newFile);
    setResults(null);
    setError("");
    setQualityResults(null);
    setQualityError("");

    onResults?.(null);
  }

  async function postFile(url) {
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

      setResults(data);
      onResults?.(data);
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

  function updateCustomRule(index, field, value) {
  setCustomRules((previousRules) =>
    previousRules.map((rule, ruleIndex) => {
      if (ruleIndex !== index) return rule;

      return {
        ...rule,
        [field]:
          field === "min" || field === "max"
            ? value === ""
              ? ""
              : Number(value)
            : value,
      };
    })
  );
}

function addCustomRule() {
  setCustomRules((previousRules) => [
    ...previousRules,
    { name: "REQUIRED", column: "" },
  ]);
}

function removeCustomRule(index) {
  setCustomRules((previousRules) =>
    previousRules.filter((_, ruleIndex) => ruleIndex !== index)
  );
}

async function handleCustomQualityCheck() {
  if (!file) {
    setCustomError("Please select a CSV file first.");
    return;
  }

  if (customRules.length === 0) {
    setCustomError("Add at least one custom rule.");
    return;
  }

  for (const rule of customRules) {
    if (!rule.column.trim()) {
      setCustomError("Please select a column for every rule.");
      return;
    }

    if (
      rule.name === "RANGE" &&
      (rule.min === "" ||
        rule.max === "" ||
        Number(rule.min) > Number(rule.max))
    ) {
      setCustomError(
        "For RANGE, enter valid minimum and maximum values."
      );
      return;
    }

    if (
      rule.name === "ALLOWED_VALUES" &&
      !rule.values.trim()
    ) {
      setCustomError(
        "Enter allowed values separated by commas."
      );
      return;
    }
  }

  const rulesPayload = customRules.map((rule) => {
    if (rule.name === "RANGE") {
      return {
        name: rule.name,
        column: rule.column.trim(),
        min: Number(rule.min),
        max: Number(rule.max),
      };
    }

    if (rule.name === "ALLOWED_VALUES") {
      return {
        name: rule.name,
        column: rule.column.trim(),
        values: rule.values
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      };
    }

    return {
      name: rule.name,
      column: rule.column.trim(),
    };
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("rules", JSON.stringify(rulesPayload));

  setCustomLoading(true);
  setCustomError("");
  setCustomResults(null);

  try {
    const response = await fetch(CUSTOM_QUALITY_API_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Custom quality check failed.");
    }

    setCustomResults(data);
  } catch (err) {
    setCustomError(
      err.message === "Failed to fetch"
        ? "Cannot connect to the backend on port 5000."
        : err.message
    );
  } finally {
    setCustomLoading(false);
  }
}
  // Download detected quality issues as a CSV file.
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

      // Prevent untrusted text from being interpreted as a
      // spreadsheet formula when opened in common spreadsheet apps.
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

    // Release the temporary download URL after the browser
    // has had time to start the download.
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  const columns = results?.columns || [];
  const rules = qualityResults?.rules || [];
  const issues = qualityResults?.issues || [];

  const missingTotal = Number(results?.missingValues ?? 0);

  const statusColor = (status) =>
    status === "PASS"
      ? "green"
      : status === "FAIL"
        ? "crimson"
        : "#b7791f";

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>CSV Data Profiler</h2>
          <p>
            Analyze completeness, missing values, duplicates,
            and data type issues.
          </p>
        </div>
      </div>

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
            {qualityLoading
              ? "Checking Quality..."
              : "Run Quality Checks"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {qualityError && (
          <p className="error">{qualityError}</p>
        )}
      </div>

      {/* Existing CSV profiling dashboard */}
      {results && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Total rows"
              value={results.rowCount}
              icon="▤"
            />

            <StatCard
              label="Total columns"
              value={results.columnCount}
              icon="▦"
            />

            <StatCard
              label="Missing values"
              value={missingTotal}
              icon="!"
            />

            <StatCard
              label="Type issues"
              value={results.typeIssues ?? 0}
              icon="⚠"
            />

            <StatCard
              label="Completeness"
              value={`${results.completeness ?? 0}%`}
              icon="%"
            />

            <StatCard
              label="Duplicate rows"
              value={results.duplicateRows}
              icon="⧉"
            />
          </div>

          <div className="table-card">
            <h3>Data quality summary</h3>

            <p>
              Profiling status:{" "}
              <strong
                style={{
                  color: statusColor(results.status),
                }}
              >
                {results.status || "NOT AVAILABLE"}
              </strong>
            </p>

            <p>Total cells: {results.totalCells ?? 0}</p>
          </div>

          <div className="table-card">
            <h3>Column quality details</h3>

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

      {/* Data Quality Rules dashboard */}
      {qualityResults && (
        <>
          <div className="table-card">
            <h3>Data Quality Report</h3>

            <p>
              File: <strong>{qualityResults.fileName}</strong>
            </p>

            <p>
              Validation status:{" "}
              <strong
                style={{
                  color: statusColor(qualityResults.status),
                }}
              >
                {qualityResults.status}
              </strong>
            </p>

{/* Data Quality Score Dashboard */}
<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    margin: "20px 0",
  }}
>
  {/* Quality Score */}
  <div className="table-card">
    <p>Data Quality Score</p>

    <h2
      style={{
        fontSize: "32px",
        color:
          qualityResults.qualityScore >= 95
            ? "green"
            : qualityResults.qualityScore >= 80
              ? "#b7791f"
              : "crimson",
      }}
    >
      {qualityResults.qualityScore ?? "N/A"}%
    </h2>

   <p>Validation check pass rate</p>

<p style={{ fontSize: "13px", color: "#6b7280" }}>
  {qualityResults.totalRuleChecks - qualityResults.issueCount} of{" "}
  {qualityResults.totalRuleChecks} checks passed
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
    borderRadius: "10px",
    transition: "width 0.5s ease",
  }}
/>
    </div>
  </div>

  {/* Rule Pass Rate */}
  <div className="table-card">
    <p>Rule Pass Rate</p>

    <h2 style={{ fontSize: "32px", color: "#2563eb" }}>
      {qualityResults.rulePassRate ?? "N/A"}%
    </h2>

    <p>
      {qualityResults.passedRules} of{" "}
      {qualityResults.rulesChecked} rules passed
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
          width: `${qualityResults.rulePassRate ?? 0}%`,
          height: "100%",
          background: "#2563eb",
          borderRadius: "10px",
        }}
      />
    </div>
  </div>
</div>
            <div className="stats-grid">
              <StatCard
                label="Rows checked"
                value={qualityResults.rowCount}
                icon="▤"
              />

              <StatCard
                label="Rules checked"
                value={qualityResults.rulesChecked}
                icon="✓"
              />

              <StatCard
                label="Passed rules"
                value={qualityResults.passedRules}
                icon="✓"
              />

              <StatCard
                label="Failed rules"
                value={qualityResults.failedRules}
                icon="⚠"
              />

              <StatCard
                label="Total issues"
                value={qualityResults.issueCount}
                icon="!"
              />

              <StatCard
                label="Skipped rules"
                value={qualityResults.skippedRules}
                icon="—"
              />
            </div>
          </div>

{/* Failed Rules Summary */}
{qualityResults.failedRules > 0 && (
  <div
    className="table-card"
    style={{
      borderLeft: "5px solid crimson",
      marginBottom: "16px",
    }}
  >
    <h3 style={{ color: "crimson" }}>
      ⚠ Failed Validation Rules
    </h3>

    <p>
      {qualityResults.failedRules} validation rule(s) failed.
      Please review the following:
    </p>

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

          <p style={{ margin: "4px 0" }}>
            Column: {rule.column}
          </p>

          <p style={{ margin: "4px 0" }}>
            Issues found: {rule.issueCount}
          </p>
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
                        <strong
                          style={{
                            color: statusColor(rule.status),
                          }}
                        >
                          {rule.status}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detected data quality issues */}
          <div className="table-card">
            <h3>Detected Data Quality Issues</h3>

            {issues.length === 0 ? (
              <p>
                No validation issues found. All applicable rules passed.
              </p>
            ) : (
              <>
                <p>
                  Found <strong>{issues.length}</strong> issues.
                  Review the affected rows below.
                </p>

                <button
                  className="primary-button"
                  onClick={handleDownloadIssues}
                  disabled={issues.length === 0}
                >
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
                        <tr
                          key={`${issue.rule}-${issue.rowNumber}-${index}`}
                        >
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
