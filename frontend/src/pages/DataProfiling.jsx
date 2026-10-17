
import { useState } from "react";
import FilePicker from "../components/FilePicker";
import StatCard from "../components/StatCard";

const API_URL = "http://localhost:5000/api/profile/profile";

export default function DataProfiling({ onResults }) {
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(newFile) {
    setFile(newFile);
    setResults(null);
    setError("");
    onResults(null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);
    onResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Upload failed.");
      }

      setResults(data);
      onResults(data);
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

  const columns = results?.columns || [];

  const missingTotal = columns.reduce(
    (total, column) =>
      total + Number(column.missingValues || 0),
    0
  );

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>CSV Data Profiler</h2>
          <p>Find missing values, unique values, and duplicates.</p>
        </div>
      </div>

      <div className="upload-card">
        <FilePicker
          title="Choose your dataset"
          subtitle="Select a CSV file to analyze"
          file={file}
          onChange={handleFileChange}
        />

        <button
          className="primary-button"
          onClick={handleUpload}
          disabled={loading || !file}
        >
          {loading ? "Analyzing..." : "Upload & Analyze"}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

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
              label="Duplicate rows"
              value={results.duplicateRows}
              icon="⧉"
            />
            <StatCard
              label="Missing values"
              value={missingTotal}
              icon="!"
            />
          </div>

          <div className="table-card">
            <h3>Column quality details</h3>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Missing values</th>
                    <th>Unique values</th>
                  </tr>
                </thead>

                <tbody>
                  {columns.map((column) => (
                    <tr key={column.column}>
                      <td>{column.column}</td>
                      <td>{column.missingValues}</td>
                      <td>{column.uniqueValues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
