
import { useState } from "react";
import StatCard from "../components/StatCard";

const API_URL = "http://localhost:5000/api/validation/validate";

export default function DataValidation() {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


async function handleValidate() {
  if (!file) {
    setError("Please select a CSV file first.");
    return;
  }

  setLoading(true);
  setError("");
  setResults(null);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    

console.log(
  "TYPE ISSUE DETAILS:\n",
  JSON.stringify(
    data.columns
      .filter((column) => column.typeIssues?.length > 0)
      .map((column) => ({
        column: column.column,
        inferredType: column.inferredType,
        issueCount: column.typeIssueCount,
        examples: column.typeIssues.slice(0, 10),
      })),
    null,
    2
  )
);




    if (!response.ok || !data.success) {
      throw new Error(data.message || "Validation failed.");
    }

    console.log(
      "Type issues:",
      data.columns
        .filter((column) => column.typeIssues?.length > 0)
        .map((column) => ({
          column: column.column,
          inferredType: column.inferredType,
          issueCount: column.typeIssueCount,
          examples: column.typeIssues.slice(0, 10),
        }))
    );

    setResults(data);
  } catch (err) {
    setError(
      err.message ||
        "Cannot connect to the backend. Check that it is running on port 5000."
    );
  } finally {
    setLoading(false);
  }
}


  const columns = results?.columns ?? [];
  const totalTypeIssues = columns.reduce(
    (sum, column) => sum + (column.typeIssueCount || 0),
    0
  );
  const totalOutliers = columns.reduce(
    (sum, column) => sum + (column.outlierCount || 0),
    0
  );

  return (
    <div className="content-section">
      <div className="section-heading">
        <div>
          <h2>Data Validation</h2>
          <p>
            Upload any CSV file to detect data quality issues automatically.
          </p>
        </div>
      </div>

      <div className="upload-card">
        <h3>Upload dataset</h3>
        <p className="helper-text">
          CSV files only. Maximum file size: 10 MB.
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setResults(null);
            setError("");
          }}
        />

        {file && (
          <p className="helper-text">
            Selected: {file.name} (
            {(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={handleValidate}
          disabled={loading || !file}
        >
          {loading ? "Validating..." : "Validate CSV"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      {results && (
        <>
          <div className="stats-grid">
            <StatCard label="Rows Checked" value={results.rowCount} icon="▤" />
            <StatCard label="Columns" value={results.columnCount} icon="▥" />
            <StatCard
              label="Missing Values"
              value={results.totalMissingValues}
              icon="!" 
            />
            <StatCard
              label="Duplicate Rows"
              value={results.duplicateRowCount}
              icon="⧉"
            />
          </div>

          <div className="stats-grid">
            <StatCard
              label="Type Issues"
              value={totalTypeIssues}
              icon="Aa"
            />
            <StatCard
              label="Potential Outliers"
              value={totalOutliers}
              icon="!"
            />
            <StatCard
              label="Completeness"
              value={`${results.completenessPercentage}%`}
              icon="%"
            />
            <StatCard
              label="Malformed Rows"
              value={results.malformedRowCount ?? 0}
              icon="!"
            />
          </div>

          <div className="table-card">
            <div className="section-heading">
              <div>
                <h3>Column Validation Results</h3>
                <p className="helper-text">
                  File: {results.fileName}
                </p>
              </div>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Detected Type</th>
                    <th>Missing</th>
                    <th>Unique</th>
                    <th>Duplicate Values</th>
                    <th>Type Issues</th>
                    <th>Outliers</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column, index) => (
                    <tr key={`${column.column}-${index}`}>
                      <td>{column.column}</td>
                      <td>{column.inferredType}</td>
                      <td>{column.missingValues}</td>
                      <td>{column.uniqueValues}</td>
                      <td>{column.duplicateValueCount}</td>
                      <td>{column.typeIssueCount}</td>
                      <td>{column.outlierCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {results.duplicateHeaders?.length > 0 && (
            <div className="table-card">
              <h3>Duplicate Column Names</h3>
              <p>{results.duplicateHeaders.join(", ")}</p>
            </div>
          )}

          {results.malformedRows?.length > 0 && (
            <div className="table-card">
              <h3>Rows With Inconsistent Column Counts</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>CSV Row</th>
                      <th>Expected Fields</th>
                      <th>Actual Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.malformedRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td>
                        <td>{row.expectedColumns}</td>
                        <td>{row.actualColumns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
