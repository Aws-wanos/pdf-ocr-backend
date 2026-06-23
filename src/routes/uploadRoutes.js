const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");

// Health check
router.get("/upload/health", uploadController.health);

// Upload PDF (field: 'pdf')
router.post("/upload", uploadController.uploadPDF);

// Upload chunk (field: 'chunk')
router.post("/upload/chunk", uploadController.uploadChunk);

// Upload any file
router.post("/upload/any", uploadController.uploadAny);

// Get file info
router.get("/upload/file/:filename", uploadController.getFileInfo);

// Delete file
router.delete("/upload/file/:filename", uploadController.deleteFile);

module.exports = router;
