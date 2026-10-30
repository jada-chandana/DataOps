
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";

const router = express.Router();

// ==========================================
// FILE UPLOAD CONFIGURATION
// ==========================================

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

// ==========================================
// 1. EXPECTED DATA TYPE
// ==========================================

function getExpectedType(columnName) {
  const name = columnName.toLowerCase();

  if (name.includes("date")) {
    return "date";
  }

  if (name === "age" || name.endsWith("_age")) {
    return "integer";
  }

  if (name.includes("salary") || name.includes("amount")) {
    return "number";
  }

  // IDs are identifiers, not quantities.
  if (name === "id" || name.endsWith("_id")) {
    return "string";
  }

  return "string";
}

// ==========================================
// 2. DETECT ACTUAL DATA TYPE
// ==========================================

function getActualType(value) {
  const v = String(value ?? "").trim();

  if (v === "") {
    return "missing";
  }

  if (/^-?\d+$/.test(v)) {
    return "integer";
  }

  if (/^-?(?:\d+\.\d*|\.\d+)$/.test(v)) {
    return "number";
  }

  if (isValidDate(v)) {
    return "date";
  }

  return "string";
}

// ==========================================
// 3. DETECT MISSING VALUES
// ==========================================

function isMissingValue(value) {
  const v = String(value ?? "").trim().toLowerCase();

  return [
    "",
    "n/a",
    "na",
    "n.a.",
    "null",
    "none",
    "unknown",
    "not available",
  ].includes(v);
}

// ==========================================
// 4. CHECK TYPE COMPATIBILITY
// ==========================================

function isTypeCompatible(expected, actual) {
  if (actual === "missing") {
    return true;
  }

  // Numeric-looking IDs are still valid identifiers.
  if (expected === "string") {
    return true;
  }

  // Integers and decimal values are both numeric.
  if (expected === "number") {
    return actual === "integer" || actual === "number";
  }

  // Integer columns must contain whole numbers.
  if (expected === "integer") {
    return actual === "integer";
  }

  // Date columns must contain valid recognized dates.
  if (expected === "date") {
    return actual === "date";
  }

  return false;
}

// ==========================================
// 5. VALIDATE DATES
// ==========================================

function isValidDate(value) {
  const v = String(value ?? "").trim();

  let year;
  let month;
  let day;
  let match;

  // Format: YYYY-MM-DD
  match = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    [, year, month, day] = match;
  } else {
    // Formats:
    // MM-DD-YYYY
    // MM/DD/YYYY
    // DD-MM-YYYY
    // DD/MM/YYYY
    match = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

    if (!match) {
      return false;
    }

    const first = Number(match[1]);
    const second = Number(match[2]);

    // If the first number is greater than 12,
    // interpret it as DD-MM-YYYY.
    // Otherwise, interpret it as MM-DD-YYYY.
    if (first > 12) {
      day = first;
      month = second;
    } else {
      month = first;
      day = second;
    }

    year = match[3];
  }

  year = Number(year);
  month = Number(month);
  day = Number(day);

  if (
    !Number.isInteger(year) ||
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  // Use UTC and setFullYear to handle years below 100 correctly.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, 1);

  const daysInMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  return day <= daysInMonth;
}

// ==========================================
// 6. NORMALIZE NUMERIC VALUES FOR VALIDATION
// ==========================================

function normalizeNumericValue(value, expectedType) {
  const v = String(value ?? "").trim();

  if (expectedType !== "number") {
    return v;
  }

  // Accept common rupee-formatted values:
  // ₹92,341
  // ₹1234
  // ₹92,341.50
  // ₹ -92341
  const currencyPattern =
    /^₹\s*-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

  if (currencyPattern.test(v)) {
    return v.replace(/₹/g, "").replace(/,/g, "").trim();
  }

  return v;
}

// ==========================================
// 7. CSV DATA PROFILING
// POST /profile
// ==========================================

router.post("/profile", upload.single("file"), (req, res) => {
  try {
    // Step 1: Validate upload.
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    // Step 2: Read CSV content.
    const csvText = req.file.buffer.toString("utf-8");

    // Step 3: Parse CSV.
    const records = parse(csvText, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty",
      });
    }

    // Step 4: Validate headers.
    const headers = records[0].map((h) => h.trim());

    if (
      headers.some((h) => !h) ||
      new Set(headers).size !== headers.length
    ) {
      return res.status(400).json({
        success: false,
        message: "Headers must be non-empty and unique",
      });
    }

    // Step 5: Separate headers and data rows.
    const rows = records.slice(1);
    const columnCount = headers.length;
    const totalCells = rows.length * columnCount;

    let totalMissing = 0;
    let totalTypeIssues = 0;

    // ==========================================
    // COLUMN PROFILING
    // ==========================================

    const columns = headers.map((name, index) => {
      const values = rows.map((row) =>
        String(row[index] ?? "").trim()
      );

      // Normalize recognized placeholders as missing.
      const nonMissing = values.filter(
        (value) => !isMissingValue(value)
      );

      const expectedType = getExpectedType(name);

      // Normalize currency-formatted numbers before checking.
      const invalidValues = nonMissing.filter((value) => {
        const valueToCheck = normalizeNumericValue(
          value,
          expectedType
        );

        return !isTypeCompatible(
          expectedType,
          getActualType(valueToCheck)
        );
      });

      const typeIssues = invalidValues.length;

      // TEMPORARY DEBUG LOGS.
      // Inspect the backend terminal after uploading a CSV.
      if (name === "Age" || name === "Salary_INR") {
        console.log(`${name} invalid values:`, invalidValues);
      }

      if (name === "Join_Date") {
        console.log(
          "Join_Date values classified as invalid:",
          invalidValues
        );
      }

      // Count missing values, including recognized placeholders.
      const missingValues = values.filter(
        (value) => isMissingValue(value)
      ).length;

      // Count distinct non-missing values.
      const uniqueValues = new Set(nonMissing);

      // Count repeated non-missing values in this column.
      const duplicateValues =
        nonMissing.length - uniqueValues.size;

      totalMissing += missingValues;
      totalTypeIssues += typeIssues;

      return {
        column: name,
        detectedType: expectedType,
        missingValues,
        uniqueValues: uniqueValues.size,
        duplicateValues,
        typeIssues,
      };
    });

    // ==========================================
    // DUPLICATE ROW DETECTION
    // ==========================================

    const seen = new Set();
    let duplicateRows = 0;

    for (const row of rows) {
      const key = JSON.stringify(row);

      if (seen.has(key)) {
        duplicateRows++;
      }

      seen.add(key);
    }

    // ==========================================
    // COMPLETENESS CALCULATION
    // ==========================================

    const completeness =
      totalCells === 0
        ? 100
        : Number(
            (
              ((totalCells - totalMissing) / totalCells) *
              100
            ).toFixed(2)
          );

    // ==========================================
    // DATA QUALITY STATUS
    // ==========================================

    // PASS requires no missing values, duplicate rows,
    // or type issues under this initial quality rule.
    const status =
      totalMissing === 0 &&
      duplicateRows === 0 &&
      totalTypeIssues === 0
        ? "PASS"
        : "FAIL";

    // ==========================================
    // RETURN PROFILE REPORT
    // ==========================================

    return res.json({
      success: true,
      fileName: req.file.originalname,
      rowCount: rows.length,
      columnCount,
      totalCells,
      missingValues: totalMissing,
      duplicateRows,
      typeIssues: totalTypeIssues,
      completeness,
      status,
      columns,
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(400).json({
      success: false,
      message: "Could not process CSV file",
    });
  }
});

// ==========================================
// 8. ROW COUNT AND SCHEMA RECONCILIATION
// POST /reconcile
// ==========================================

router.post(
  "/reconcile",
  upload.fields([
    { name: "sourceFile", maxCount: 1 },
    { name: "targetFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // Step 1: Get uploaded files.
      const sourceFile = req.files?.sourceFile?.[0];
      const targetFile = req.files?.targetFile?.[0];

      // Step 2: Validate uploads.
      if (!sourceFile || !targetFile) {
        return res.status(400).json({
          success: false,
          message:
            "Please upload both sourceFile and targetFile CSV files",
        });
      }

      // Step 3: Parse CSV files.
      const parseCsv = (file) =>
        parse(file.buffer.toString("utf-8"), {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: false,
        });

      const sourceRecords = parseCsv(sourceFile);
      const targetRecords = parseCsv(targetFile);

      if (!sourceRecords.length || !targetRecords.length) {
        return res.status(400).json({
          success: false,
          message: "Both CSV files must contain a header row",
        });
      }

      // Step 4: Extract column names.
      const sourceHeaders = sourceRecords[0].map((h) => h.trim());
      const targetHeaders = targetRecords[0].map((h) => h.trim());

      const hasInvalidHeaders = (headers) =>
        headers.some((h) => !h) ||
        new Set(headers).size !== headers.length;

      if (
        hasInvalidHeaders(sourceHeaders) ||
        hasInvalidHeaders(targetHeaders)
      ) {
        return res.status(400).json({
          success: false,
          message: "Headers must be non-empty and unique",
        });
      }

      // Step 5: Count data rows, excluding headers.
      const sourceRowCount = sourceRecords.length - 1;
      const targetRowCount = targetRecords.length - 1;

      // Step 6: Compare column names.
      const missingColumnsInTarget = sourceHeaders.filter(
        (column) => !targetHeaders.includes(column)
      );

      const extraColumnsInTarget = targetHeaders.filter(
        (column) => !sourceHeaders.includes(column)
      );

      // Step 7: Calculate differences.
      const rowCountDifference = sourceRowCount - targetRowCount;
      const rowCountMatch = sourceRowCount === targetRowCount;

      const schemaMatch =
        missingColumnsInTarget.length === 0 &&
        extraColumnsInTarget.length === 0;

      // Step 8: Return reconciliation report.
      return res.status(200).json({
        success: true,
        message: "Reconciliation completed",
        sourceFile: sourceFile.originalname,
        targetFile: targetFile.originalname,
        sourceRowCount,
        targetRowCount,
        rowCountDifference,
        rowCountMatch,
        sourceColumnCount: sourceHeaders.length,
        targetColumnCount: targetHeaders.length,
        missingColumnsInTarget,
        extraColumnsInTarget,
        schemaMatch,
        status: rowCountMatch && schemaMatch ? "PASS" : "FAIL",
      });
    } catch (error) {
      console.error("Reconciliation error:", error.message);

      return res.status(400).json({
        success: false,
        message: "Could not reconcile CSV files",
      });
    }
  }
);

// ==========================================
// 9. RECORD-BY-RECORD RECONCILIATION
// POST /reconcile-records
// ==========================================



router.post(
  "/reconcile-records",
  upload.fields([
    { name: "sourceFile", maxCount: 1 },
    { name: "targetFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // STEP 1: Get uploaded files
      const sourceFile = req.files?.sourceFile?.[0];
      const targetFile = req.files?.targetFile?.[0];

      if (!sourceFile || !targetFile) {
        return res.status(400).json({
          success: false,
          message: "Upload both sourceFile and targetFile.",
        });
      }

      // STEP 2: Parse CSV files
      const parseFile = (file) =>
        parse(file.buffer.toString("utf-8"), {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: false,
        });

      const sourceRecords = parseFile(sourceFile);
      const targetRecords = parseFile(targetFile);

      if (!sourceRecords.length || !targetRecords.length) {
        return res.status(400).json({
          success: false,
          message: "Both files must contain headers.",
        });
      }

      // STEP 3: Validate headers
      const sourceHeaders = sourceRecords[0].map((h) =>
        String(h).trim()
      );

      const targetHeaders = targetRecords[0].map((h) =>
        String(h).trim()
      );

      const hasInvalidHeaders = (headers) =>
        headers.some((h) => !h) ||
        new Set(headers).size !== headers.length;

      if (
        hasInvalidHeaders(sourceHeaders) ||
        hasInvalidHeaders(targetHeaders)
      ) {
        return res.status(400).json({
          success: false,
          message: "Headers cannot be empty or duplicated.",
        });
      }

      // STEP 4: Convert rows into objects
      const toObjects = (headers, rows) =>
        rows.map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [
              header,
              String(row[index] ?? "").trim(),
            ])
          )
        );

      const sourceData = toObjects(
        sourceHeaders,
        sourceRecords.slice(1)
      );

      const targetData = toObjects(
        targetHeaders,
        targetRecords.slice(1)
      );

      // STEP 5: Find common columns
      const commonColumns = sourceHeaders.filter((column) =>
        targetHeaders.includes(column)
      );

      if (!commonColumns.length) {
        return res.status(400).json({
          success: false,
          message: "No common columns found between the CSV files.",
        });
      }

      // STEP 6: Check for suitable ID-like unique columns
      const isUniqueColumn = (rows, column) => {
        const seen = new Set();

        for (const row of rows) {
          const value = row[column];

          if (!value || seen.has(value)) {
            return false;
          }

          seen.add(value);
        }

        return true;
      };

      const getKeyPriority = (column) => {
        const normalized = column
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        const preferredNames = [
          "id",
          "employeeid",
          "customerid",
          "orderid",
          "productid",
          "bookingid",
          "transactionid",
        ];

        if (preferredNames.includes(normalized)) return 3;
        if (normalized.endsWith("id")) return 2;

        return 1;
      };

      const validKeyColumns = commonColumns.filter(
        (column) =>
          getKeyPriority(column) >= 2 &&
          isUniqueColumn(sourceData, column) &&
          isUniqueColumn(targetData, column)
      );

      const sortedCandidates = [...validKeyColumns].sort(
        (a, b) => getKeyPriority(b) - getKeyPriority(a)
      );

      // Use a key only when one clear ID-like candidate exists.
      const highestPriority = sortedCandidates.length
        ? getKeyPriority(sortedCandidates[0])
        : 0;

      const topCandidates = sortedCandidates.filter(
        (column) => getKeyPriority(column) === highestPriority
      );

      const useKey = topCandidates.length === 1;
      const keyColumn = useKey ? topCandidates[0] : null;

      // STEP 7: Prepare result collections
      const matchedRecords = [];
      const missingInTarget = [];
      const extraInTarget = [];
      const mismatchedRecords = [];

      let matchedCount = 0;

      // ==========================================
      // MODE A: KEY-BASED RECONCILIATION
      // ==========================================

      if (useKey) {
        const sourceMap = new Map(
          sourceData.map((row) => [row[keyColumn], row])
        );

        const targetMap = new Map(
          targetData.map((row) => [row[keyColumn], row])
        );

        const comparisonColumns = commonColumns.filter(
          (column) => column !== keyColumn
        );

        for (const [key, sourceRow] of sourceMap) {
          if (!targetMap.has(key)) {
            missingInTarget.push({
              key,
              source: sourceRow,
            });
            continue;
          }

          const targetRow = targetMap.get(key);
          const differences = [];

          for (const column of comparisonColumns) {
            if (sourceRow[column] !== targetRow[column]) {
              differences.push({
                column,
                sourceValue: sourceRow[column],
                targetValue: targetRow[column],
              });
            }
          }

          if (differences.length) {
            mismatchedRecords.push({
              key,
              differences,
            });
          } else {
            matchedCount++;
            matchedRecords.push({ key });
          }
        }

        for (const [key, targetRow] of targetMap) {
          if (!sourceMap.has(key)) {
            extraInTarget.push({
              key,
              target: targetRow,
            });
          }
        }
      }

      // ==========================================
      // MODE B: FULL-ROW RECONCILIATION
      // ==========================================

      else {
        // Compare all common column values.
        // Count duplicate rows instead of rejecting them.

        const getRowSignature = (row) =>
          JSON.stringify(
            commonColumns.map((column) => row[column])
          );

        const targetGroups = new Map();

        for (const row of targetData) {
          const signature = getRowSignature(row);

          if (!targetGroups.has(signature)) {
            targetGroups.set(signature, []);
          }

          targetGroups.get(signature).push(row);
        }

        for (const sourceRow of sourceData) {
          const signature = getRowSignature(sourceRow);
          const targetGroup = targetGroups.get(signature);

          if (targetGroup && targetGroup.length > 0) {
            const targetRow = targetGroup.shift();

            matchedCount++;

            matchedRecords.push({
              source: sourceRow,
              target: targetRow,
            });
          } else {
            missingInTarget.push({
              source: sourceRow,
            });
          }
        }

        // Remaining target rows are extra records.
        for (const targetGroup of targetGroups.values()) {
          for (const targetRow of targetGroup) {
            extraInTarget.push({
              target: targetRow,
            });
          }
        }
      }

      // STEP 8: Compare schemas
      const missingColumnsInTarget = sourceHeaders.filter(
        (header) => !targetHeaders.includes(header)
      );

      const extraColumnsInTarget = targetHeaders.filter(
        (header) => !sourceHeaders.includes(header)
      );

      const schemaMatch =
        missingColumnsInTarget.length === 0 &&
        extraColumnsInTarget.length === 0;

      // STEP 9: Calculate status
      const status =
        missingInTarget.length === 0 &&
        extraInTarget.length === 0 &&
        mismatchedRecords.length === 0 &&
        schemaMatch
          ? "PASS"
          : "FAIL";

      // STEP 10: Return report
      return res.status(200).json({
        success: true,
        message: "Reconciliation completed successfully.",

        sourceFile: sourceFile.originalname,
        targetFile: targetFile.originalname,

        keyColumn,
        keyDetection: useKey ? "AUTOMATIC" : "NOT_AVAILABLE",

        comparisonMode: useKey
          ? "KEY_BASED"
          : "FULL_ROW",

        sourceRowCount: sourceData.length,
        targetRowCount: targetData.length,

        matchedCount,
        missingInTargetCount: missingInTarget.length,
        extraInTargetCount: extraInTarget.length,
        mismatchedCount: mismatchedRecords.length,

        sourceColumnCount: sourceHeaders.length,
        targetColumnCount: targetHeaders.length,

        schemaMatch,
        missingColumnsInTarget,
        extraColumnsInTarget,

        comparisonColumns: commonColumns,

        status,

        matchedRecords,
        missingInTarget,
        extraInTarget,
        mismatchedRecords,
      });
    } catch (error) {
      console.error("Record reconciliation error:", error);

      return res.status(400).json({
        success: false,
        message: "Could not reconcile the CSV files.",
        error: error.message,
      });
    }
  }
);



function dqNormalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dqIsMissing(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return ["", "n/a", "na", "null", "none", "unknown", "not available"].includes(text);
}

function dqFindColumn(headers, candidates) {
  return headers.find((header) =>
    candidates.includes(dqNormalizeHeader(header))
  );
}

function dqParseSalary(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/[₹,\s]/g, "");

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function dqParseDate(value) {
  const text = String(value ?? "").trim();

  // ISO format: YYYY-MM-DD
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));

    if (
      date.getFullYear() === Number(y) &&
      date.getMonth() === Number(m) - 1 &&
      date.getDate() === Number(d)
    ) {
      return date;
    }
    return null;
  }

  // Slash or dash format: DD/MM/YYYY or DD-MM-YYYY
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (match) {
    const [, first, second, year] = match;
    const a = Number(first);
    const b = Number(second);
    const y = Number(year);

    // If the first number exceeds 12, it must be the day.
    // Otherwise, interpret this format as DD/MM/YYYY.
    const day = a > 12 ? a : b;
    const month = a > 12 ? b : a;

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(y, month - 1, day);

    if (
      date.getFullYear() === y &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  return null;
}

router.post("/quality-check", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Upload a CSV file using the field name "file".',
      });
    }

    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });

    if (!records.length) {
      return res.status(400).json({
        success: false,
        message: "The CSV contains no data rows.",
      });
    }

    const headers = Object.keys(records[0]);
    const issues = [];
    const rules = [];

    function addRule(name, column, checkedRows, issueCount, skipped = false) {
      rules.push({
        name,
        column: column ?? null,
        checkedRows,
        issueCount,
        status: skipped ? "SKIPPED" : issueCount === 0 ? "PASS" : "FAIL",
      });
    }

    function addIssue(rowNumber, column, value, rule, message) {
      issues.push({
        rowNumber,
        column,
        value: String(value ?? ""),
        rule,
        message,
      });
    }

    function runRequiredRule(column, ruleName) {
      if (!column) {
        addRule(ruleName, null, 0, 0, true);
        return;
      }

      let count = 0;

      records.forEach((record, index) => {
        const value = record[column];

        if (dqIsMissing(value)) {
          count++;
          addIssue(
            index + 2,
            column,
            value,
            ruleName,
            "Required value is missing."
          );
        }
      });

      addRule(ruleName, column, records.length, count);
    }

    const idColumn = dqFindColumn(headers, [
      "employeeid", "id", "customerid", "userid",
    ]);

    const emailColumn = dqFindColumn(headers, ["email", "emailaddress"]);
    const ageColumn = dqFindColumn(headers, ["age", "employeeage"]);
    const salaryColumn = dqFindColumn(headers, [
      "salary", "salaryinr", "amount",
    ]);
    const dateColumn = dqFindColumn(headers, [
      "joindate", "hiredate", "date",
    ]);

    // Rule 1: Employee ID must be present.
    runRequiredRule(idColumn, "ID_REQUIRED");

    // Rule 2: Employee ID must be unique.
    if (idColumn) {
      const seen = new Set();
      let count = 0;

      records.forEach((record, index) => {
        const value = String(record[idColumn] ?? "").trim();

        if (dqIsMissing(value)) return;

        const key = value.toLowerCase();

        if (seen.has(key)) {
          count++;
          addIssue(
            index + 2,
            idColumn,
            value,
            "ID_UNIQUE",
            "Duplicate ID; the first occurrence is retained."
          );
        } else {
          seen.add(key);
        }
      });

      addRule("ID_UNIQUE", idColumn, records.length, count);
    } else {
      addRule("ID_UNIQUE", null, 0, 0, true);
    }

    // Rule 3: Email must have a valid basic email format.
    if (emailColumn) {
      let count = 0;
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      records.forEach((record, index) => {
        const value = String(record[emailColumn] ?? "").trim();

        if (dqIsMissing(value)) return;

        if (!emailPattern.test(value)) {
          count++;
          addIssue(
            index + 2,
            emailColumn,
            value,
            "EMAIL_FORMAT",
            "Email format is invalid."
          );
        }
      });

      addRule("EMAIL_FORMAT", emailColumn, records.length, count);
    } else {
      addRule("EMAIL_FORMAT", null, 0, 0, true);
    }

    // Rule 4: Age must be an integer between 18 and 100.
    if (ageColumn) {
      let count = 0;

      records.forEach((record, index) => {
        const value = String(record[ageColumn] ?? "").trim();

        if (dqIsMissing(value)) return;

        const age = Number(value);

        if (!/^\d+$/.test(value) || age < 18 || age > 100) {
          count++;
          addIssue(
            index + 2,
            ageColumn,
            value,
            "AGE_RANGE",
            "Age must be a whole number between 18 and 100."
          );
        }
      });

      addRule("AGE_RANGE", ageColumn, records.length, count);
    } else {
      addRule("AGE_RANGE", null, 0, 0, true);
    }

    // Rule 5: Salary must be numeric and non-negative.
    if (salaryColumn) {
      let count = 0;

      records.forEach((record, index) => {
        const value = String(record[salaryColumn] ?? "").trim();

        if (dqIsMissing(value)) return;

        const salary = dqParseSalary(value);

        if (salary === null || salary < 0) {
          count++;
          addIssue(
            index + 2,
            salaryColumn,
            value,
            "SALARY_NON_NEGATIVE",
            "Salary must be a valid number greater than or equal to zero."
          );
        }
      });

      addRule(
        "SALARY_NON_NEGATIVE",
        salaryColumn,
        records.length,
        count
      );
    } else {
      addRule("SALARY_NON_NEGATIVE", null, 0, 0, true);
    }

    // Rule 6: Join date must be valid and not in the future.
    if (dateColumn) {
      let count = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      records.forEach((record, index) => {
        const value = String(record[dateColumn] ?? "").trim();

        if (dqIsMissing(value)) return;

        const date = dqParseDate(value);

        if (!date || date > today) {
          count++;
          addIssue(
            index + 2,
            dateColumn,
            value,
            "JOIN_DATE_VALID",
            !date
              ? "Date is invalid or uses an unsupported format."
              : "Join date cannot be in the future."
          );
        }
      });

      addRule("JOIN_DATE_VALID", dateColumn, records.length, count);
    } else {
      addRule("JOIN_DATE_VALID", null, 0, 0, true);
    }

    const applicableRules = rules.filter(
      (rule) => rule.status !== "SKIPPED"
    );

    const passedRules = applicableRules.filter(
      (rule) => rule.status === "PASS"
    ).length;

    const failedRules = applicableRules.filter(
      (rule) => rule.status === "FAIL"
    ).length;
    // DATA QUALITY SCORE

    

const totalRuleChecks = applicableRules.reduce(
  (sum, rule) => sum + rule.checkedRows,
  0
);

const qualityScore =
  totalRuleChecks === 0
    ? 100
    : Number(
        (
          ((totalRuleChecks - issues.length) / totalRuleChecks) *
          100
        ).toFixed(2)
      );

const rulePassRate =
  applicableRules.length === 0
    ? 100
    : Number(
        (
          (passedRules / applicableRules.length) *
          100
        ).toFixed(2)
      );

      
    res.json({
  success: true,
  fileName: req.file.originalname,
  rowCount: records.length,
  rulesChecked: applicableRules.length,
  passedRules,
  failedRules,
  skippedRules: rules.length - applicableRules.length,
  issueCount: issues.length,

  // Data Quality Score
  totalRuleChecks,
  qualityScore,
  rulePassRate,

  status: failedRules === 0 ? "PASS" : "FAIL",
  rules,
  issues,
});
  } catch (error) {
    console.error("Quality check error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to run data quality checks.",
    });
  }
});

/*
  ==========================================
  10. CUSTOM DATA QUALITY RULES
  POST /custom-quality-check

  FormData fields:
  - file: CSV file
  - rules: JSON string containing custom rules
  ==========================================
*/


router.post(
  "/custom-quality-check",
  upload.single("file"),
  (req, res) => {
    try {
      // 1. Check CSV file
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Upload a CSV using the field name "file".',
        });
      }

      // 2. Parse custom rules
      let customRules;

      try {
        customRules = JSON.parse(req.body.rules || "[]");
      } catch {
        return res.status(400).json({
          success: false,
          message: "The rules field must contain valid JSON.",
        });
      }

      if (
        !Array.isArray(customRules) ||
        customRules.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one custom rule.",
        });
      }

      if (customRules.length > 50) {
        return res.status(400).json({
          success: false,
          message: "A maximum of 50 custom rules is allowed.",
        });
      }

      // 3. Allowed rule names
      const allowedRuleNames = [
        "REQUIRED",
        "UNIQUE",
        "EMAIL_FORMAT",
        "RANGE",
        "ALLOWED_VALUES",
        "NON_NEGATIVE",
      ];

      for (const rule of customRules) {
        if (
          !rule ||
          typeof rule !== "object" ||
          Array.isArray(rule) ||
          !allowedRuleNames.includes(rule.name) ||
          typeof rule.column !== "string" ||
          !rule.column.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Each rule needs a valid name and column.",
            allowedRules: allowedRuleNames,
          });
        }

        if (
          rule.name === "RANGE" &&
          (
            !Number.isFinite(rule.min) ||
            !Number.isFinite(rule.max) ||
            rule.min > rule.max
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "RANGE requires numeric min and max, with min <= max.",
          });
        }

        if (
          rule.name === "ALLOWED_VALUES" &&
          (
            !Array.isArray(rule.values) ||
            rule.values.length === 0 ||
            !rule.values.every(
              (value) => typeof value === "string"
            )
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "ALLOWED_VALUES requires a non-empty array of strings.",
          });
        }
      }

      // 4. Read CSV
      const records = parse(
        req.file.buffer.toString("utf-8"),
        {
          columns: true,
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: false,
        }
      );

      if (!records.length) {
        return res.status(400).json({
          success: false,
          message: "The CSV contains no data rows.",
        });
      }

      // 5. Match CSV columns
      const headers = Object.keys(records[0]);

      const normalizeHeader = (value) =>
        String(value ?? "").trim().toLowerCase();

      for (const rule of customRules) {
        const actualColumn = headers.find(
          (header) =>
            normalizeHeader(header) ===
            normalizeHeader(rule.column)
        );

        if (!actualColumn) {
          return res.status(400).json({
            success: false,
            message: `Column "${rule.column}" was not found in the CSV.`,
            availableColumns: headers,
          });
        }

        rule.column = actualColumn;
      }

      // 6. Validation setup
      const issues = [];
      const results = [];

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const parseNumber = (value) => {
        const cleaned = String(value ?? "")
          .trim()
          .replace(/[₹,\s]/g, "");

        if (
          !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)
        ) {
          return null;
        }

        const number = Number(cleaned);

        return Number.isFinite(number) ? number : null;
      };

      // 7. Execute custom validation rules
      for (const rule of customRules) {
        let issueCount = 0;
        const seenValues = new Set();

        const allowedValues =
          rule.name === "ALLOWED_VALUES"
            ? new Set(
                rule.values.map((value) =>
                  value.trim().toLowerCase()
                )
              )
            : null;

        records.forEach((record, index) => {
          const value = String(
            record[rule.column] ?? ""
          ).trim();

          const missing = dqIsMissing(value);
          let problem = null;

          switch (rule.name) {
            case "REQUIRED":
              if (missing) {
                problem = "Required value is missing.";
              }
              break;

            case "UNIQUE":
              if (!missing) {
                const key = value.toLowerCase();

                if (seenValues.has(key)) {
                  problem = "Duplicate value found.";
                } else {
                  seenValues.add(key);
                }
              }
              break;

            case "EMAIL_FORMAT":
              if (!missing && !emailPattern.test(value)) {
                problem = "Email format is invalid.";
              }
              break;

            case "RANGE":
              if (!missing) {
                const number = parseNumber(value);

                if (
                  number === null ||
                  number < rule.min ||
                  number > rule.max
                ) {
                  problem =
                    `Value must be between ${rule.min} and ${rule.max}.`;
                }
              }
              break;

            case "ALLOWED_VALUES":
              if (
                !missing &&
                !allowedValues.has(value.toLowerCase())
              ) {
                problem =
                  `Value is not in the allowed list: ${rule.values.join(", ")}.`;
              }
              break;

            case "NON_NEGATIVE":
              if (!missing) {
                const number = parseNumber(value);

                if (number === null || number < 0) {
                  problem =
                    "Value must be a valid number greater than or equal to zero.";
                }
              }
              break;
          }

          if (problem) {
            issueCount++;

            issues.push({
              rowNumber: index + 2,
              column: rule.column,
              value,
              rule: rule.name,
              message: problem,
            });
          }
        });

        results.push({
          name: rule.name,
          column: rule.column,
          checkedRows: records.length,
          issueCount,
          status: issueCount === 0 ? "PASS" : "FAIL",
        });
      }

      // 8. Calculate rule results
      const passedRules = results.filter(
        (rule) => rule.status === "PASS"
      ).length;

      const failedRules = results.filter(
        (rule) => rule.status === "FAIL"
      ).length;

      // 9. Calculate Data Quality Score
      const totalRuleChecks = results.reduce(
        (sum, rule) => sum + rule.checkedRows,
        0
      );

      const qualityScore =
        totalRuleChecks === 0
          ? 100
          : Number(
              (
                ((totalRuleChecks - issues.length) /
                  totalRuleChecks) *
                100
              ).toFixed(2)
            );

      // 10. Calculate Rule Pass Rate
      const rulePassRate =
        results.length === 0
          ? 100
          : Number(
              (
                (passedRules / results.length) * 100
              ).toFixed(2)
            );

      // 11. Return API response
      return res.json({
        success: true,
        fileName: req.file.originalname,
        rowCount: records.length,

        rulesChecked: results.length,
        passedRules,
        failedRules,

        totalRuleChecks,
        qualityScore,
        rulePassRate,

        issueCount: issues.length,
        status: failedRules === 0 ? "PASS" : "FAIL",

        rules: results,
        issues,
      });

    } catch (error) {
      console.error("Custom quality check error:", error);

      return res.status(400).json({
        success: false,
        message: "Could not run custom quality checks.",
      });
    }
  }
);

// ==========================================
// DATA DRIFT DETECTION
// POST /data-drift
// ==========================================

router.post(
  "/data-drift",
  upload.fields([
    { name: "sourceFile", maxCount: 1 },
    { name: "targetFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // 1. Get uploaded files
      const sourceFile = req.files?.sourceFile?.[0];
      const targetFile = req.files?.targetFile?.[0];

      if (!sourceFile || !targetFile) {
        return res.status(400).json({
          success: false,
          message: "Upload both sourceFile and targetFile.",
        });
      }

      // 2. Parse CSV files
      const parseFile = (file) =>
        parse(file.buffer.toString("utf-8"), {
          bom: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: false,
        });

      const sourceRecords = parseFile(sourceFile);
      const targetRecords = parseFile(targetFile);

      if (!sourceRecords.length || !targetRecords.length) {
        return res.status(400).json({
          success: false,
          message: "Both files must contain headers.",
        });
      }

      // 3. Extract headers
      const sourceHeaders = sourceRecords[0].map((h) =>
        String(h).trim()
      );

      const targetHeaders = targetRecords[0].map((h) =>
        String(h).trim()
      );

      // 4. Validate headers
      const hasInvalidHeaders = (headers) =>
        headers.some((h) => !h) ||
        new Set(headers).size !== headers.length;

      if (
        hasInvalidHeaders(sourceHeaders) ||
        hasInvalidHeaders(targetHeaders)
      ) {
        return res.status(400).json({
          success: false,
          message: "Headers cannot be empty or duplicated.",
        });
      }

      // 5. Detect schema changes
      const addedColumns = targetHeaders.filter(
        (column) => !sourceHeaders.includes(column)
      );

      const removedColumns = sourceHeaders.filter(
        (column) => !targetHeaders.includes(column)
      );

      const schemaMatch =
        addedColumns.length === 0 &&
        removedColumns.length === 0;

      // 6. Detect row count changes
      const sourceRowCount = sourceRecords.length - 1;
      const targetRowCount = targetRecords.length - 1;

      const rowCountDifference =
        targetRowCount - sourceRowCount;

      const rowCountChangePercentage =
        sourceRowCount === 0
          ? null
          : Number(
              (
                (rowCountDifference / sourceRowCount) *
                100
              ).toFixed(2)
            );

      // 7. Overall drift status
      const hasDrift =
        !schemaMatch || rowCountDifference !== 0;

      // 8. Return report
      return res.status(200).json({
        success: true,
        message: "Data drift detection completed.",

        sourceFile: sourceFile.originalname,
        targetFile: targetFile.originalname,

        comparisonMode: "SCHEMA_AND_ROW_COUNT",

        sourceRowCount,
        targetRowCount,
        rowCountDifference,
        rowCountChangePercentage,

        sourceColumnCount: sourceHeaders.length,
        targetColumnCount: targetHeaders.length,

        schemaMatch,
        addedColumns,
        removedColumns,

        driftDetected: hasDrift,
        status: hasDrift ? "WARNING" : "STABLE",
      });
    } catch (error) {
      console.error("Data drift detection error:", error);

      return res.status(400).json({
        success: false,
        message: "Could not detect data drift.",
        error: error.message,
      });
    }
  }
);

// ==========================================
// EXPORT ROUTER
// ==========================================

export default router;
