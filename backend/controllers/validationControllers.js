
import { parse } from "csv-parse/sync";
import { validateDataset } from "../services/validationService.js";

export function validateCSV(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file using the 'file' field.",
      });
    }

    const filename = req.file.originalname || "";

    if (!filename.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({
        success: false,
        message: "Only CSV files are supported.",
      });
    }

    const content = req.file.buffer.toString("utf8");

    if (!content.trim()) {
      return res.status(400).json({
        success: false,
        message: "The uploaded CSV file is empty.",
      });
    }

    const rows = parse(content, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: false,
      trim: false,
    });

    if (rows.length < 1 || rows[0].length === 0) {
      return res.status(400).json({
        success: false,
        message: "The CSV must contain a header row.",
      });
    }

    const headers = rows[0].map((header) => String(header).trim());
    const dataRows = rows.slice(1);

    if (headers.some((header) => !header)) {
      return res.status(400).json({
        success: false,
        message: "The CSV contains an empty column name.",
      });
    }

    // Identify rows whose number of fields differs from the header.
    const malformedRows = [];
    const normalizedRows = [];

    dataRows.forEach((row, index) => {
      if (row.length !== headers.length) {
        malformedRows.push({
          rowNumber: index + 2,
          expectedColumns: headers.length,
          actualColumns: row.length,
        });
      }

      // Normalize short rows; ignore extra cells after recording the issue.
      const normalized = headers.map((_, columnIndex) =>
        row[columnIndex] === undefined ? "" : row[columnIndex]
      );

      normalizedRows.push(normalized);
    });

    const result = validateDataset(headers, normalizedRows);

    result.fileName = filename;
    result.malformedRowCount = malformedRows.length;
    result.malformedRows = malformedRows;

    return res.status(200).json(result);
  } catch (error) {
    console.error("CSV validation error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Could not parse the CSV file. Check its format and try again.",
    });
  }
}
