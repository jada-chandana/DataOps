
import express from "express";
import multer from "multer";
import { validateCSV } from "../controllers/validationControllers.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const isCSV = file.originalname.toLowerCase().endsWith(".csv");

    if (!isCSV) {
      return callback(new Error("Only CSV files are supported."));
    }

    callback(null, true);
  },
});

router.post("/validate", (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed.",
      });
    }

    next();
  });
}, validateCSV);

export default router;
