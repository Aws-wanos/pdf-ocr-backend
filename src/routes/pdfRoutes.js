const express = require("express");
const router = express.Router();
const { upload, handleUploadError } = require("../middleware/upload");
const pdfController = require("../controllers/pdfController");

// Upload PDF
router.post(
  "/upload",
  upload.single("pdf"),
  handleUploadError,
  pdfController.uploadPDF.bind(pdfController),
);

// Get processed file
router.get(
  "/download/:filename",
  pdfController.getProcessedFile.bind(pdfController),
);

// Delete file
router.delete("/file/:filename", pdfController.deleteFile.bind(pdfController));

// Get status
router.get("/status", pdfController.getStatus.bind(pdfController));

module.exports = router;
