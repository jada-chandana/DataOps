
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


router.post("/profile-test", (req, res) => {
  const csvText = req.body.csv;

  if (!csvText) {
    return res.status(400).json({
      success: false,
      message: "Please provide CSV text"
    });
  }

  const records = parse(csvText, {
    bom: true,
    skip_empty_lines: true,
    trim: true
  });

  return res.json({
    success: true,
    headers: records[0],
    rowCount: records.length - 1,
    data: records.slice(1)
  });
});

export default router;
