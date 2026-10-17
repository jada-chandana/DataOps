
<label className="field-label">
  <strong>Unique Key Column</strong>

  <input
    className="text-input"
    type="text"
    value={keyColumn}
    onChange={(event) => setKeyColumn(event.target.value)}
    placeholder="Enter key column (e.g. Employee_ID)"
  />

  <span className="helper-text">
    This column must exist in both files and contain unique,
    non-empty values.
  </span>
</label>
