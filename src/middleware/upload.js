const multer = require("multer");
const path = require("path");
const { generateUniqueFilename, TEMP_DIR } = require("../utils/fileUtils");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, generateUniqueFilename(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "application/x-pdf"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || ext === ".pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default
    files: 1,
  },
  fileFilter: fileFilter,
});

// Middleware for handling upload errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "File too large",
        message: `File size exceeds ${process.env.MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
      });
    }
    return res.status(400).json({
      error: "Upload error",
      message: err.message,
    });
  }
  next(err);
};

module.exports = {
  upload,
  handleUploadError,
};
