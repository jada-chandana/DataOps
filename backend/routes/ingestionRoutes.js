
import express from "express";
import multer from "multer";
import { ingestCSV } from "../ingestion/ingestionService.js";

const router = express.Router();

// Store uploaded CSV temporarily in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// CSV ingestion API
router.post("/csv", upload.single("file"), (req, res) => {
  try {
    const result = ingestCSV(req.file);

    // Return metadata only, not raw customer records
    
res.status(200).json({
  success: true,
  message: "CSV ingestion and profiling successful",
  ingestion: {
    sourceType: result.sourceType,
    fileName: result.fileName,
    rowCount: result.rowCount,
    columnCount: result.columnCount,
    columns: result.columns,
  },
  qualityReport: result.qualityReport,
});

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
