
export default function FilePicker({
  title,
  subtitle,
  file,
  onChange,
}) {
  return (
    <div className="file-picker">
      <label className="file-picker-label">
        <div className="file-picker-icon">↑</div>

        <strong>{title}</strong>
        <p>{subtitle}</p>

        <span className="file-picker-button">
          {file ? "Choose another file" : "Browse CSV"}
        </span>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) =>
            onChange(event.target.files?.[0] || null)
          }
        />
      </label>

      {file && (
        <div className="selected-file">
          <span>▤</span>
          <div>
            <strong>{file.name}</strong>
            <p>{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
    </div>
  );
}
