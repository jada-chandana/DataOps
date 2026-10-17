
export default function Settings() {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Settings</h2>
          <p>
            View your DataOps One workspace configuration.
          </p>
        </div>
      </div>

      {/* Workspace information */}
      <div className="settings-panel">
        <div className="settings-heading">
          <div className="settings-icon">⚙</div>
          <div>
            <h3>Workspace Information</h3>
            <p>Basic application details.</p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Application Name</strong>
            <p>The name of your data quality platform.</p>
          </div>
          <span className="settings-value">DataOps One</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Application Type</strong>
            <p>Frontend framework used by the application.</p>
          </div>
          <span className="settings-value">React + Vite</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Backend</strong>
            <p>API server address used by the frontend.</p>
          </div>
          <span className="settings-value">
            localhost:5000
          </span>
        </div>
      </div>

      {/* Data processing */}
      <div className="settings-panel">
        <div className="settings-heading">
          <div className="settings-icon">▤</div>
          <div>
            <h3>Data Processing</h3>
            <p>Supported input and output formats.</p>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Input Format</strong>
            <p>Dataset format accepted by the current tools.</p>
          </div>
          <span className="settings-value">CSV</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Profiling</strong>
            <p>
              Inspects row counts, column counts, missing values,
              unique values, and duplicate rows.
            </p>
          </div>
          <span className="settings-value">Available</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Reconciliation</strong>
            <p>
              Compares source and target records using a unique
              key column.
            </p>
          </div>
          <span className="settings-value">Available</span>
        </div>

        <div className="settings-row">
          <div>
            <strong>Report Format</strong>
            <p>Downloadable analysis reports.</p>
          </div>
          <span className="settings-value">JSON</span>
        </div>
      </div>

      {/* Privacy and limitations */}
      <div className="settings-panel">
        <div className="settings-heading">
          <div className="settings-icon">i</div>
          <div>
            <h3>Data & Privacy</h3>
            <p>Understand how this version processes your files.</p>
          </div>
        </div>

        <div className="settings-notice">
          <strong>Current application behavior</strong>
          <p>
            CSV files are uploaded to your configured backend for
            processing. Profiling and reconciliation results are
            maintained in frontend memory and are not permanently
            saved by the current dashboard.
          </p>
          <p>
            Avoid uploading sensitive production data until
            appropriate access controls, secure transport, and
            data retention policies are implemented.
          </p>
        </div>
      </div>
    </section>
  );
}
