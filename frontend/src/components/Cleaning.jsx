
import { useState } from "react";
import "./Cleaning.css";

// ----------------------------------
// API CONFIGURATION FROM .env
// ----------------------------------

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const CLEANING_API_URL = `${API_BASE_URL}/api/cleaning`;

function Cleaning() {
  const [file, setFile] = useState(null);

  const [preview, setPreview] = useState(null);
  const [missingPreview, setMissingPreview] = useState(null);
  const [duplicatePreview, setDuplicatePreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [duplicateError, setDuplicateError] = useState("");
  const [duplicateMessage, setDuplicateMessage] = useState("");

  // ----------------------------------
  // COMMON FORM DATA
  // ----------------------------------

  const createFormData = () => {
    const formData = new FormData();
    formData.append("file", file);
    return formData;
  };

  // ----------------------------------
  // COMMON CSV DOWNLOAD HELPER
  // ----------------------------------

  const downloadFile = (blob, filename) => {
    const downloadUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(downloadUrl);
  };

  // ----------------------------------
  // FEATURE 1: TRIM SPACES PREVIEW
  // ----------------------------------

  const handlePreview = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    setMissingPreview(null);

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/preview`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Preview failed");
      }

      setPreview(result);
      setMessage("Trim spaces preview generated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // FEATURE 1: APPLY TRIM SPACES
  // ----------------------------------

  const handleApply = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/apply`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Cleaning failed");
      }

      const blob = await response.blob();

      downloadFile(blob, "cleaned_data.csv");

      setMessage("Cleaned CSV downloaded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // FEATURE 2: MISSING VALUES PREVIEW
  // ----------------------------------

  const handleMissingPreview = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setPreview(null);
    setMissingPreview(null);

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/missing-preview`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Missing value preview failed"
        );
      }

      setMissingPreview(result);

      setMessage(
        "Missing value preview generated successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // FEATURE 2: APPLY MISSING VALUES
  // ----------------------------------

  const handleMissingApply = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/missing-apply`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.message || "Missing value cleaning failed"
        );
      }

      const blob = await response.blob();

      downloadFile(blob, "missing_values_cleaned.csv");

      setMessage(
        "Missing values cleaned and CSV downloaded successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------
  // FEATURE 3: DUPLICATE ROW PREVIEW
  // ----------------------------------

  const handleDuplicatePreview = async () => {
    if (!file) {
      setDuplicateError("Please upload a CSV file first.");
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError("");
    setDuplicateMessage("");
    setDuplicatePreview(null);

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/duplicates-preview`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Duplicate detection failed."
        );
      }

      setDuplicatePreview(result);

      setDuplicateMessage(
        "Duplicate rows detected successfully."
      );
    } catch (err) {
      setDuplicateError(err.message);
    } finally {
      setDuplicateLoading(false);
    }
  };

  // ----------------------------------
  // FEATURE 3: APPLY DUPLICATE REMOVAL
  // ----------------------------------

  const handleDuplicateApply = async () => {
    if (!file) {
      setDuplicateError("Please upload a CSV file first.");
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError("");
    setDuplicateMessage("");

    try {
      const response = await fetch(
        `${CLEANING_API_URL}/duplicates-apply`,
        {
          method: "POST",
          body: createFormData(),
        }
      );

      if (!response.ok) {
        const result = await response.json();

        throw new Error(
          result.message || "Failed to remove duplicates."
        );
      }

      const blob = await response.blob();

      downloadFile(blob, "deduplicated_data.csv");

      setDuplicateMessage(
        "Duplicates removed. Your CSV has been downloaded."
      );
    } catch (err) {
      setDuplicateError(err.message);
    } finally {
      setDuplicateLoading(false);
    }
  };

  // ----------------------------------
  // FILE SELECTION
  // ----------------------------------

  const handleFileChange = (event) => {
    setFile(event.target.files[0] || null);

    setPreview(null);
    setMissingPreview(null);
    setDuplicatePreview(null);

    setError("");
    setMessage("");

    setDuplicateError("");
    setDuplicateMessage("");
  };

  // ----------------------------------
  // UI
  // ----------------------------------

  return (
    <div className="cleaning-container">

      {/* PAGE HEADER */}

      <div className="cleaning-header">
        <h2>Automated Data Cleaning</h2>

        <p>
          Upload your CSV file and improve data quality
          using automated cleaning operations.
        </p>
      </div>

      {/* FILE UPLOAD */}

      <div className="cleaning-card">

        <label htmlFor="cleaning-file">
          Choose CSV File
        </label>

        <input
          id="cleaning-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />

        {file && (
          <p className="selected-file">
            Selected: {file.name}
          </p>
        )}

        {/* OPERATION 1 */}

        <div className="cleaning-operation">
          <h3>Operation 1: Trim Extra Spaces</h3>

          <p>
            Remove unnecessary leading and trailing
            spaces from data cells.
          </p>

          <div className="cleaning-actions">

            <button
              onClick={handlePreview}
              disabled={!file || loading || duplicateLoading}
            >
              Preview Trim
            </button>

            <button
              onClick={handleApply}
              disabled={!file || loading || duplicateLoading}
            >
              Download Trimmed CSV
            </button>

          </div>
        </div>

        {/* OPERATION 2 */}

        <div className="cleaning-operation">
          <h3>Operation 2: Handle Missing Values</h3>

          <p>
            Detect empty cells and automatically replace
            them based on the detected column data type.
          </p>

          <div className="automatic-replacement-info">
            <h4>Automatic Replacement Rules</h4>

            <p>Integer / Numeric columns → 0</p>
            <p>String columns → Unknown</p>

            <small>
              Replacement values are selected automatically
              based on the detected column data type.
            </small>
          </div>

          <div className="cleaning-actions">

            <button
              onClick={handleMissingPreview}
              disabled={!file || loading || duplicateLoading}
            >
              Preview Missing Values
            </button>

            <button
              onClick={handleMissingApply}
              disabled={!file || loading || duplicateLoading}
            >
              Download Cleaned CSV
            </button>

          </div>
        </div>

        {/* STATUS MESSAGES */}

        {loading && (
          <p>Processing your dataset...</p>
        )}

        {error && (
          <p className="cleaning-error">{error}</p>
        )}

        {message && (
          <p className="cleaning-success">{message}</p>
        )}

      </div>

      {/* TRIM RESULTS */}

      {preview && (
        <div className="cleaning-results">

          <h3>Trim Cleaning Summary</h3>

          <div className="cleaning-stats">

            <div className="cleaning-stat">
              <span>Total Rows</span>
              <strong>{preview.totalRows}</strong>
            </div>

            <div className="cleaning-stat">
              <span>Changed Cells</span>
              <strong>{preview.changedCells}</strong>
            </div>

          </div>

          <h3>Before Cleaning</h3>

          <DataTable
            headers={preview.preview.headers}
            rows={preview.preview.before}
          />

          <h3>After Cleaning</h3>

          <DataTable
            headers={preview.preview.headers}
            rows={preview.preview.after}
          />

          <ChangesTable
            changes={preview.changes}
            total={preview.changedCells}
          />

        </div>
      )}

      {/* MISSING VALUE RESULTS */}

      {missingPreview && (
        <div className="cleaning-results">

          <h3>Missing Value Cleaning Summary</h3>

          <div className="cleaning-stats">

            <div className="cleaning-stat">
              <span>Total Rows</span>
              <strong>{missingPreview.totalRows}</strong>
            </div>

            <div className="cleaning-stat">
              <span>Missing Cells</span>
              <strong>{missingPreview.totalMissingCells}</strong>
            </div>

          </div>

          <h3>Column-wise Missing Values</h3>

          <div className="cleaning-table-wrapper">

            <table className="cleaning-table">

              <thead>
                <tr>
                  <th>Column Name</th>
                  <th>Detected Type</th>
                  <th>Missing Values</th>
                  <th>Replacement</th>
                </tr>
              </thead>

              <tbody>
                {missingPreview.columnCounts.map(
                  (column, index) => (
                    <tr key={index}>
                      <td>{column.columnName}</td>
                      <td>{column.inferredType}</td>
                      <td>{column.missingCount}</td>
                      <td className="changed-after">
                        {column.replacementValue}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

            </table>

          </div>

          <h3>Before Cleaning</h3>

          <DataTable
            headers={missingPreview.preview.headers}
            rows={missingPreview.preview.before}
          />

          <h3>After Cleaning</h3>

          <DataTable
            headers={missingPreview.preview.headers}
            rows={missingPreview.preview.after}
          />

          <ChangesTable
            changes={missingPreview.changes}
            total={missingPreview.totalMissingCells}
          />

        </div>
      )}

      {/* DUPLICATE ROW RESULTS */}

      <section className="cleaning-section">

        <h2>Remove Duplicate Rows</h2>

        <p>
          Identify duplicate records and keep only the first
          occurrence of each complete row.
        </p>

        <div className="cleaning-actions">

          <button
            onClick={handleDuplicatePreview}
            disabled={!file || duplicateLoading || loading}
          >
            {duplicateLoading
              ? "Processing..."
              : "Preview Duplicates"}
          </button>

          <button
            onClick={handleDuplicateApply}
            disabled={!file || duplicateLoading || loading}
          >
            Remove Duplicates & Download
          </button>

        </div>

        {duplicateError && (
          <p className="error-message">
            {duplicateError}
          </p>
        )}

        {duplicateMessage && (
          <p className="success-message">
            {duplicateMessage}
          </p>
        )}

        {duplicatePreview && (
          <div className="duplicate-results">

            <h3>Duplicate Detection Summary</h3>

            <div className="cleaning-stats">

              <div className="stat-card">
                <h4>Total Rows</h4>
                <p>{duplicatePreview.totalRows}</p>
              </div>

              <div className="stat-card">
                <h4>Duplicate Rows</h4>
                <p>{duplicatePreview.duplicateRows}</p>
              </div>

              <div className="stat-card">
                <h4>Unique Rows</h4>
                <p>{duplicatePreview.uniqueRows}</p>
              </div>

            </div>

            <h3>Duplicate Records</h3>

            {duplicatePreview.preview.duplicates.length > 0 ? (
              <ChangesTable
                changes={duplicatePreview.preview.duplicates.map(
                  (item) => ({
                    rowNumber: item.rowNumber,
                    columnName: "Complete Row",
                    before: JSON.stringify(item.data),
                    after: "Removed",
                  })
                )}
              />
            ) : (
              <p>No duplicate rows found!</p>
            )}

          </div>
        )}

      </section>

    </div>
  );
}

// ----------------------------------
// REUSABLE DATA TABLE
// ----------------------------------

function DataTable({ headers, rows }) {
  if (!rows || rows.length === 0) {
    return <p>No data rows available.</p>;
  }

  return (
    <div className="cleaning-table-wrapper">

      <table className="cleaning-table">

        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, columnIndex) => (
                <td key={columnIndex}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>

      </table>

    </div>
  );
}

// ----------------------------------
// REUSABLE CHANGED CELLS REPORT
// ----------------------------------

function ChangesTable({ changes, total }) {
  return (
    <>
      <h3>Changed Cells Report</h3>

      {changes && changes.length > 0 ? (

        <div className="cleaning-table-wrapper">

          <table className="cleaning-table">

            <thead>
              <tr>
                <th>Row Number</th>
                <th>Column Name</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>

            <tbody>
              {changes.map((change, index) => (
                <tr key={index}>
                  <td>{change.rowNumber}</td>
                  <td>{change.columnName}</td>

                  <td className="changed-before">
                    {change.before === ""
                      ? "(empty)"
                      : change.before}
                  </td>

                  <td className="changed-after">
                    {change.after === ""
                      ? "(empty)"
                      : change.after}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

          <p>
            Showing {changes.length} of {total ?? changes.length} changed cells.
          </p>

        </div>

      ) : (
        <p>No changes required.</p>
      )}
    </>
  );
}

export default Cleaning;
