
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";

const router = express.Router();

// ----------------------------------
// FILE UPLOAD CONFIGURATION
// ----------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// ----------------------------------
// COMMON CSV FUNCTIONS
// ----------------------------------

function parseCSV(buffer) {
  const records = parse(buffer, {
    bom: true,
    skip_empty_lines: true,
    trim: false,
    relax_column_count: false,
  });

  if (records.length < 1) {
    throw new Error("CSV file is empty");
  }

  const headers = records[0].map((header) => String(header));

  if (headers.some((header) => header.trim() === "")) {
    throw new Error("CSV contains an empty column name");
  }

  const rows = records.slice(1);

  rows.forEach((row) => {
    if (row.length !== headers.length) {
      throw new Error(
        "CSV contains rows with an incorrect number of columns"
      );
    }
  });

  return { headers, rows };
}

function escapeCSV(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function createCSV(headers, rows) {
  const allRows = [headers, ...rows];

  return allRows
    .map((row) => row.map(escapeCSV).join(","))
    .join("\r\n");
}

function sendCSV(res, csv, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  return res.status(200).send(csv);
}

// ----------------------------------
// FEATURE 1: TRIM EXTRA SPACES
// ----------------------------------

function cleanCSV(buffer) {
  const { headers, rows: originalRows } = parseCSV(buffer);

  let changedCells = 0;
  const changes = [];

  const cleanedRows = originalRows.map((row, rowIndex) => {
    return row.map((value, columnIndex) => {
      const originalValue = String(value ?? "");
      const cleanedValue = originalValue.trim();

      if (originalValue !== cleanedValue) {
        changedCells++;

        changes.push({
          rowNumber: rowIndex + 2,
          columnName: headers[columnIndex],
          before: originalValue,
          after: cleanedValue,
        });
      }

      return cleanedValue;
    });
  });

  return {
    headers,
    originalRows,
    cleanedRows,
    changedCells,
    changes,
  };
}

// ----------------------------------
// FEATURE 2: HANDLE MISSING VALUES
// ----------------------------------

// Detect whether a column contains numeric or string data

function inferColumnType(rows, columnIndex) {
  const values = rows
    .map((row) => String(row[columnIndex] ?? "").trim())
    .filter((value) => value !== "");

  if (values.length === 0) {
    return "string";
  }

  const numericValues = values.filter((value) => {
    const normalized = value
      .replace(/₹|Rs\.?/gi, "")
      .replace(/,/g, "")
      .replace(/\s/g, "")
      .trim();

    return /^[-+]?\d+(\.\d+)?$/.test(normalized);
  });

  const numericRatio = numericValues.length / values.length;

  return numericRatio >= 0.5 ? "integer" : "string";
}

// Handle missing values automatically by column type

function handleMissingValues(buffer) {
  const { headers, rows: originalRows } = parseCSV(buffer);

  let changedCells = 0;
  const changes = [];

  const columnTypes = headers.map((header, columnIndex) => {
    const inferredType = inferColumnType(originalRows, columnIndex);

    return {
      columnName: header,
      inferredType,
      replacementValue:
        inferredType === "integer" ? "0" : "Unknown",
      missingCount: 0,
    };
  });

  const cleanedRows = originalRows.map((row, rowIndex) => {
    return row.map((value, columnIndex) => {
      const originalValue = String(value ?? "");

      if (originalValue.trim() === "") {
        changedCells++;

        const replacement =
          columnTypes[columnIndex].replacementValue;

        columnTypes[columnIndex].missingCount++;

        changes.push({
          rowNumber: rowIndex + 2,
          columnName: headers[columnIndex],
          inferredType: columnTypes[columnIndex].inferredType,
          before: originalValue,
          after: replacement,
        });

        return replacement;
      }

      return originalValue;
    });
  });

  return {
    headers,
    originalRows,
    cleanedRows,
    changedCells,
    columnTypes,
    changes,
  };
}

// ----------------------------------
// FEATURE 3: DUPLICATE ROW DETECTION
// ----------------------------------

function findDuplicateRows(rows) {
  const seen = new Set();
  const duplicates = [];

  rows.forEach((row, index) => {
    const rowKey = JSON.stringify(row);

    if (seen.has(rowKey)) {
      duplicates.push({
        rowNumber: index + 2,
        data: row,
      });
    } else {
      seen.add(rowKey);
    }
  });

  return duplicates;
}

// ----------------------------------
// API 1: TRIM SPACES PREVIEW
// POST /api/cleaning/preview
// ----------------------------------

router.post("/preview", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const result = cleanCSV(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: "Cleaning preview generated successfully",
      operation: "TRIM_SPACES",
      totalRows: result.originalRows.length,
      changedCells: result.changedCells,

      preview: {
        headers: result.headers,
        before: result.originalRows.slice(0, 10),
        after: result.cleanedRows.slice(0, 10),
      },

      changes: result.changes.slice(0, 50),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// ----------------------------------
// API 2: TRIM SPACES APPLY
// POST /api/cleaning/apply
// ----------------------------------

router.post("/apply", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const result = cleanCSV(req.file.buffer);

    const cleanedCSV = createCSV(
      result.headers,
      result.cleanedRows
    );

    return sendCSV(res, cleanedCSV, "cleaned_data.csv");
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// ----------------------------------
// API 3: MISSING VALUES PREVIEW
// POST /api/cleaning/missing-preview
// ----------------------------------

router.post(
  "/missing-preview",
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file",
        });
      }

      const result = handleMissingValues(req.file.buffer);

      return res.status(200).json({
        success: true,
        message: "Missing values preview generated successfully",
        operation: "HANDLE_MISSING_VALUES",
        totalRows: result.originalRows.length,
        totalMissingCells: result.changedCells,

        columnCounts: result.columnTypes,

        preview: {
          headers: result.headers,
          before: result.originalRows.slice(0, 10),
          after: result.cleanedRows.slice(0, 10),
        },

        changes: result.changes.slice(0, 50),
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ----------------------------------
// API 4: MISSING VALUES APPLY
// POST /api/cleaning/missing-apply
// ----------------------------------

router.post(
  "/missing-apply",
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file",
        });
      }

      const result = handleMissingValues(req.file.buffer);

      const cleanedCSV = createCSV(
        result.headers,
        result.cleanedRows
      );

      return sendCSV(
        res,
        cleanedCSV,
        "missing_values_cleaned.csv"
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ----------------------------------
// API 5: DUPLICATE ROWS PREVIEW
// POST /api/cleaning/duplicates-preview
// ----------------------------------

router.post(
  "/duplicates-preview",
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file",
        });
      }

      const { headers, rows } = parseCSV(req.file.buffer);

      const duplicates = findDuplicateRows(rows);

      const duplicateIndexes = new Set(
        duplicates.map((item) => item.rowNumber - 2)
      );

      const uniqueRows = rows.filter(
        (_, index) => !duplicateIndexes.has(index)
      );

      return res.status(200).json({
        success: true,
        message: "Duplicate detection completed successfully",
        operation: "DUPLICATE_DETECTION",
        totalRows: rows.length,
        duplicateRows: duplicates.length,
        uniqueRows: uniqueRows.length,

        preview: {
          headers,
          duplicates: duplicates.slice(0, 10),
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ----------------------------------
// API 6: DUPLICATE ROWS APPLY
// POST /api/cleaning/duplicates-apply
// ----------------------------------

router.post(
  "/duplicates-apply",
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file",
        });
      }

      const { headers, rows } = parseCSV(req.file.buffer);

      const seen = new Set();
      const uniqueRows = [];

      rows.forEach((row) => {
        const rowKey = JSON.stringify(row);

        if (!seen.has(rowKey)) {
          seen.add(rowKey);
          uniqueRows.push(row);
        }
      });

      const cleanedCSV = createCSV(headers, uniqueRows);

      return sendCSV(
        res,
        cleanedCSV,
        "deduplicated_data.csv"
      );
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// ----------------------------------
// EXPORT ROUTER
// ----------------------------------

export default router;
