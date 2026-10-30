
import express from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate the PySpark service
const etlServicePath = path.resolve(__dirname, "../../etl-service");

const pythonPath = path.join(
  etlServicePath,
  "venv",
  "Scripts",
  "python.exe"
);

// Trigger PySpark ETL
router.post("/run", (req, res) => {
  const pythonProcess = spawn(
    pythonPath,
    ["main.py"],
    { cwd: etlServicePath }
  );

  let output = "";
  let errors = "";

  pythonProcess.stdout.on("data", (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errors += data.toString();
  });

  pythonProcess.on("error", (error) => {
    res.status(500).json({
      success: false,
      message: "Unable to start PySpark",
      error: error.message
    });
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        message: "ETL pipeline failed",
        error: errors || output
      });
    }

    res.status(200).json({
      success: true,
      message: "ETL pipeline completed",
      output: output
    });
  });
});

export default router;
