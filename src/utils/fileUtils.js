const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const TEMP_DIR = process.env.TEMP_DIR || "./uploads/temp";
const PROCESSED_DIR = process.env.PROCESSED_DIR || "./uploads/processed";

// Ensure all required directories exist
const ensureDirectories = () => {
  const dirs = [UPLOAD_DIR, TEMP_DIR, PROCESSED_DIR];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
};

// Generate unique filename
const generateUniqueFilename = (originalName) => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const timestamp = Date.now();
  const uuid = uuidv4().slice(0, 8);
  return `${name}-${timestamp}-${uuid}${ext}`;
};

// Get file size in MB
const getFileSizeMB = (bytes) => {
  return (bytes / (1024 * 1024)).toFixed(2);
};

// Delete file with retry
const deleteFile = async (filePath, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.unlink(filePath);
        console.log(`🗑️ Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Delete attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

// Clean up old files (older than X hours)
const cleanupOldFiles = async (directory, hours = 24) => {
  try {
    const files = await fs.readdir(directory);
    const now = Date.now();
    const cutoffTime = hours * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > cutoffTime) {
        await deleteFile(filePath);
        console.log(`🧹 Cleaned up old file: ${file}`);
      }
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

// Run cleanup every hour
setInterval(
  () => {
    cleanupOldFiles(TEMP_DIR, 24);
    cleanupOldFiles(PROCESSED_DIR, 48);
  },
  60 * 60 * 1000,
);

module.exports = {
  ensureDirectories,
  generateUniqueFilename,
  getFileSizeMB,
  deleteFile,
  cleanupOldFiles,
  UPLOAD_DIR,
  TEMP_DIR,
  PROCESSED_DIR,
};
