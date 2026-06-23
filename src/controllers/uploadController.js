const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads/temp");
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: Infinity },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === "application/pdf" || ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files allowed"), false);
    }
  },
});

class UploadController {
  // Health check
  health(req, res) {
    res.json({
      status: "OK",
      uploadDir: "./uploads",
      tempDir: "./uploads/temp",
      processedDir: "./uploads/processed",
    });
  }

  // Upload PDF (field: 'pdf')
  uploadPDF(req, res) {
    upload.single("pdf")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      res.json({
        success: true,
        file: {
          originalName: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          sizeMB: (req.file.size / (1024 * 1024)).toFixed(2),
          path: req.file.path,
        },
      });
    });
  }

  // Upload chunk (field: 'chunk')
  uploadChunk(req, res) {
    upload.single("chunk")(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No chunk uploaded",
        });
      }

      res.json({
        success: true,
        chunk: {
          filename: req.file.filename,
          size: req.file.size,
          path: req.file.path,
        },
      });
    });
  }

  // Upload any file
  uploadAny(req, res) {
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const file = req.files[0];
      res.json({
        success: true,
        file: {
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          sizeMB: (file.size / (1024 * 1024)).toFixed(2),
          path: file.path,
        },
      });
    });
  }

  // Get file info
  async getFileInfo(req, res) {
    try {
      const { filename } = req.params;
      const filePath = path.join("./uploads/temp", filename);

      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({
          success: false,
          error: "File not found",
        });
      }

      const stats = await fs.stat(filePath);
      res.json({
        success: true,
        file: {
          filename,
          size: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          created: stats.birthtime,
          modified: stats.mtime,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // Delete file
  async deleteFile(req, res) {
    try {
      const { filename } = req.params;
      const filePath = path.join("./uploads/temp", filename);

      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({
          success: false,
          error: "File not found",
        });
      }

      await fs.unlink(filePath);
      res.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new UploadController();
