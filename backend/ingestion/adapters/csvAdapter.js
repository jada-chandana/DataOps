
import { parse } from "csv-parse/sync";

export function readCSV(file) {
  if (!file) {
    throw new Error("CSV file is required");
  }

  if (!file.buffer) {
    throw new Error("CSV file buffer is missing");
  }

  const records = parse(file.buffer, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  });

  if (records.length === 0) {
    throw new Error("CSV file contains no data rows");
  }

  const columns = Object.keys(records[0]);

  if (columns.length === 0 || columns.some((column) => !column.trim())) {
    throw new Error("CSV headers are invalid");
  }

  return {
    sourceType: "CSV",
    fileName: file.originalname,
    rowCount: records.length,
    columnCount: columns.length,
    columns,
    records,
  };
}
