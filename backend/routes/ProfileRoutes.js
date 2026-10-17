
import express from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";

const router = express.Router();

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

router.post("/profile", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const csvText = req.file.buffer.toString("utf-8");

    const records = parse(csvText, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty",
      });
    }

    const headers = records[0].map((header) => header.trim());

    if (headers.some((header) => !header)) {
      return res.status(400).json({
        success: false,
        message: "CSV contains an empty column name",
      });
    }

    if (new Set(headers).size !== headers.length) {
      return res.status(400).json({
        success: false,
        message: "CSV contains duplicate column names",
      });
    }

    const rows = records.slice(1);

    const columnStats = headers.map((name, index) => {
      const values = rows.map((row) => row[index] ?? "");
      const nullCount = values.filter(
        (value) => value.trim() === ""
      ).length;

      const uniqueCount = new Set(
        values.filter((value) => value.trim() !== "")
      ).size;

      return {
        column: name,
        missingValues: nullCount,
        uniqueValues: uniqueCount,
      };
    });

    const seen = new Set();
    let duplicateRows = 0;

    for (const row of rows) {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        duplicateRows++;
      }
      seen.add(key);
    }

    return res.json({
      success: true,
      fileName: req.file.originalname,
      rowCount: rows.length,
      columnCount: headers.length,
      duplicateRows,
      columns: columnStats,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Could not process CSV file",
    });
  }
});


router.post(
  "/reconcile",
  upload.fields([
    { name: "sourceFile", maxCount: 1 },
    { name: "targetFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // Step 1: Get uploaded files
      const sourceFile = req.files?.sourceFile?.[0];
      const targetFile = req.files?.targetFile?.[0];

      // Step 2: Validate file uploads
      if (!sourceFile || !targetFile) {
        return res.status(400).json({
          success: false,
          message: "Please upload both sourceFile and targetFile CSV files",
        });
      }

      // Step 3: Parse CSV files
      const parseCsv = (file) =>
        parse(file.buffer.toString("utf-8"), {
          bom: true,
          skip_empty_lines: true,
          trim: true,
        });

      const sourceRecords = parseCsv(sourceFile);
      const targetRecords = parseCsv(targetFile);

      if (!sourceRecords.length || !targetRecords.length) {
        return res.status(400).json({
          success: false,
          message: "Both CSV files must contain a header row",
        });
      }

      // Step 4: Extract column names
      const sourceHeaders = sourceRecords[0].map((h) => h.trim());
      const targetHeaders = targetRecords[0].map((h) => h.trim());

      // Step 5: Count data rows (excluding headers)
      const sourceRowCount = sourceRecords.length - 1;
      const targetRowCount = targetRecords.length - 1;

      // Step 6: Compare column names
      const missingColumnsInTarget = sourceHeaders.filter(
        (column) => !targetHeaders.includes(column)
      );

      const extraColumnsInTarget = targetHeaders.filter(
        (column) => !sourceHeaders.includes(column)
      );

      // Step 7: Calculate differences
      const rowCountDifference = sourceRowCount - targetRowCount;
      const rowCountMatch = sourceRowCount === targetRowCount;
      const schemaMatch =
        missingColumnsInTarget.length === 0 &&
        extraColumnsInTarget.length === 0;

      // Step 8: Return reconciliation report
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


router.post(
  "/reconcile-records",
  upload.fields([
    { name: "sourceFile", maxCount: 1 },
    { name: "targetFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const sourceFile = req.files?.sourceFile?.[0];
      const targetFile = req.files?.targetFile?.[0];
      const keyColumn = req.body.keyColumn?.trim();

      if (!sourceFile || !targetFile) {
        return res.status(400).json({
          success: false,
          message: "Upload both sourceFile and targetFile.",
        });
      }

      if (!keyColumn) {
        return res.status(400).json({
          success: false,
          message: "Please provide a keyColumn, such as Employee_ID.",
        });
      }

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
          message: "Headers cannot be empty or duplicated.",
        });
      }

      const sourceKeyIndex = sourceHeaders.indexOf(keyColumn);
      const targetKeyIndex = targetHeaders.indexOf(keyColumn);

      if (sourceKeyIndex === -1 || targetKeyIndex === -1) {
        return res.status(400).json({
          success: false,
          message: `Key column '${keyColumn}' must exist in both files.`,
        });
      }

      const sourceRows = sourceRecords.slice(1);
      const targetRows = targetRecords.slice(1);

      const toObjects = (headers, rows) =>
        rows.map((row) =>
          Object.fromEntries(
            headers.map((header, index) => [
              header,
              String(row[index] ?? "").trim(),
            ])
          )
        );

      const sourceData = toObjects(sourceHeaders, sourceRows);
      const targetData = toObjects(targetHeaders, targetRows);

      const duplicateKeys = (rows) => {
        const seen = new Set();
        const duplicates = new Set();

        for (const row of rows) {
          const key = row[keyColumn];

          if (!key) {
            return {
              error: `Empty key found in column '${keyColumn}'.`,
            };
          }

          if (seen.has(key)) duplicates.add(key);
          seen.add(key);
        }

        return { keys: duplicates };
      };

      const sourceKeyCheck = duplicateKeys(sourceData);
      const targetKeyCheck = duplicateKeys(targetData);

      if (sourceKeyCheck.error || targetKeyCheck.error) {
        return res.status(400).json({
          success: false,
          message:
            sourceKeyCheck.error || targetKeyCheck.error,
        });
      }

      if (
        sourceKeyCheck.keys.size > 0 ||
        targetKeyCheck.keys.size > 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Duplicate key values found. Each key must be unique.",
          duplicateKeys: {
            source: [...sourceKeyCheck.keys],
            target: [...targetKeyCheck.keys],
          },
        });
      }

      const commonColumns = sourceHeaders.filter(
        (header) =>
          header !== keyColumn && targetHeaders.includes(header)
      );

      const sourceMap = new Map(
        sourceData.map((row) => [row[keyColumn], row])
      );
      const targetMap = new Map(
        targetData.map((row) => [row[keyColumn], row])
      );

      const matchedRecords = [];
      const missingInTarget = [];
      const extraInTarget = [];
      const mismatchedRecords = [];

      for (const [key, sourceRow] of sourceMap) {
        if (!targetMap.has(key)) {
          missingInTarget.push({ key, source: sourceRow });
          continue;
        }

        const targetRow = targetMap.get(key);
        const differences = [];

        for (const column of commonColumns) {
          if (sourceRow[column] !== targetRow[column]) {
            differences.push({
              column,
              sourceValue: sourceRow[column],
              targetValue: targetRow[column],
            });
          }
        }

        if (differences.length) {
          mismatchedRecords.push({ key, differences });
        } else {
          matchedRecords.push({ key });
        }
      }

      for (const [key, targetRow] of targetMap) {
        if (!sourceMap.has(key)) {
          extraInTarget.push({ key, target: targetRow });
        }
      }

      const schemaMatch =
        sourceHeaders.length === targetHeaders.length &&
        sourceHeaders.every((header) =>
          targetHeaders.includes(header)
        );

      const status =
        missingInTarget.length === 0 &&
        extraInTarget.length === 0 &&
        mismatchedRecords.length === 0 &&
        schemaMatch
          ? "PASS"
          : "FAIL";

      return res.status(200).json({
        success: true,
        status,
        keyColumn,
        sourceRowCount: sourceData.length,
        targetRowCount: targetData.length,
        matchedCount: matchedRecords.length,
        missingInTargetCount: missingInTarget.length,
        extraInTargetCount: extraInTarget.length,
        mismatchedCount: mismatchedRecords.length,
        schemaMatch,
        missingColumnsInTarget: sourceHeaders.filter(
          (header) => !targetHeaders.includes(header)
        ),
        extraColumnsInTarget: targetHeaders.filter(
          (header) => !sourceHeaders.includes(header)
        ),
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
      });
    }
  }
);


export default router;
