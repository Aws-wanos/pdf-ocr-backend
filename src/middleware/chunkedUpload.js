const fs = require("fs-extra");
const path = require("path");
const Busboy = require("busboy");
const { v4: uuidv4 } = require("uuid");
const { TEMP_DIR } = require("../utils/fileUtils");

class ChunkedUpload {
  constructor() {
    this.uploads = new Map(); // Store upload sessions
  }

  // Middleware for handling chunked uploads
  handleChunkedUpload(req, res, next) {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: Infinity, // No size limit
        files: 1,
        parts: 1000,
      },
    });

    let uploadId = req.headers["x-upload-id"] || uuidv4();
    let fileName = "";
    let totalChunks = 0;
    let currentChunk = 0;
    let fileSize = 0;

    // Create upload session if not exists
    if (!this.uploads.has(uploadId)) {
      this.uploads.set(uploadId, {
        id: uploadId,
        chunks: [],
        tempDir: path.join(TEMP_DIR, uploadId),
        completed: false,
      });
    }

    const session = this.uploads.get(uploadId);

    // Ensure temp directory exists
    fs.ensureDirSync(session.tempDir);

    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      fileName = filename;
      const chunkPath = path.join(
        session.tempDir,
        `chunk-${Date.now()}-${uuidv4()}.part`,
      );

      // Save chunk
      const writeStream = fs.createWriteStream(chunkPath);
      file.pipe(writeStream);

      file.on("data", (data) => {
        fileSize += data.length;
      });

      file.on("end", () => {
        session.chunks.push({
          path: chunkPath,
          size: fileSize,
        });
        currentChunk++;
      });
    });

    busboy.on("field", (fieldname, value) => {
      if (fieldname === "totalChunks") {
        totalChunks = parseInt(value);
      }
      if (fieldname === "chunkIndex") {
        currentChunk = parseInt(value);
      }
    });

    busboy.on("finish", () => {
      // Store upload metadata
      session.metadata = {
        fileName,
        totalChunks,
        totalSize: fileSize,
        currentChunk,
        startTime: Date.now(),
      };

      req.uploadId = uploadId;
      req.session = session;
      req.fileName = fileName;

      // If all chunks received, assemble the file
      if (session.chunks.length === totalChunks) {
        this.assembleFile(uploadId, session, req, res, next);
      } else {
        // Return session info
        res.json({
          uploadId,
          received: session.chunks.length,
          total: totalChunks,
          status: "uploading",
        });
      }
    });

    busboy.on("error", (error) => {
      console.error("Busboy error:", error);
      res.status(500).json({ error: "Upload failed", message: error.message });
    });

    req.pipe(busboy);
  }

  async assembleFile(uploadId, session, req, res, next) {
    try {
      const { fileName } = session.metadata;
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const finalPath = path.join(TEMP_DIR, `${baseName}-${Date.now()}${ext}`);

      // Sort chunks by creation time
      const sortedChunks = session.chunks.sort(
        (a, b) => fs.statSync(a.path).ctimeMs - fs.statSync(b.path).ctimeMs,
      );

      // Create write stream for final file
      const writeStream = fs.createWriteStream(finalPath);

      // Write chunks sequentially
      for (const chunk of sortedChunks) {
        const data = await fs.readFile(chunk.path);
        writeStream.write(data);
        // Clean up chunk file
        await fs.unlink(chunk.path);
      }

      writeStream.end();

      // Clean up session
      await fs.remove(session.tempDir);
      this.uploads.delete(uploadId);

      // Attach file info to request
      req.file = {
        path: finalPath,
        originalname: fileName,
        filename: path.basename(finalPath),
        size: session.metadata.totalSize,
      };

      next();
    } catch (error) {
      console.error("Assembly error:", error);
      res
        .status(500)
        .json({ error: "Failed to assemble file", message: error.message });
    }
  }

  // Clean up expired uploads (runs every hour)
  cleanup() {
    const now = Date.now();
    const EXPIRY_TIME = 3600000; // 1 hour

    for (const [id, session] of this.uploads) {
      if (now - session.metadata.startTime > EXPIRY_TIME) {
        // Remove temp directory
        fs.remove(session.tempDir).catch(console.error);
        this.uploads.delete(id);
        console.log(`🧹 Cleaned up expired upload: ${id}`);
      }
    }
  }
}

// Start cleanup interval
const chunkedUpload = new ChunkedUpload();
setInterval(() => chunkedUpload.cleanup(), 3600000);

module.exports = chunkedUpload;
