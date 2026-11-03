
import { readCSV } from "./adapters/csvAdapter.js";
import { profileCSVData } from "../services/dataProfilingService.js";

export function ingestCSV(file) {
  // Step 1: Read and parse CSV
  const dataset = readCSV(file);

  // Step 2: Convert parsed records into rows
  const headers = dataset.columns;

  const rows = dataset.records.map((record) =>
    headers.map((header) => record[header] ?? "")
  );
  console.log("ROWS FOR PROFILING:", rows);

  // Step 3: Run data profiling
  const qualityReport = profileCSVData(
    headers,
    rows,
    dataset.fileName
  );

  // Step 4: Return metadata and quality metrics only
  return {
    sourceType: dataset.sourceType,
    fileName: dataset.fileName,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns: dataset.columns,
    qualityReport,
  };
}
