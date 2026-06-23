const fs = require("fs-extra");
const path = require("path");
const {
  TEMP_DIR,
  PROCESSED_DIR,
  deleteFile,
  getFileSizeMB,
} = require("../utils/fileUtils");
const ocrService = require("../services/ocrService");

class PDFController {
  // Upload and process PDF
  async uploadPDF(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { file } = req;
      const processingMode = req.body.mode || "auto";

      // Process the PDF
      const result = await this.processPDF(file.path, {
        mode: processingMode,
        extractImages: req.body.extractImages === "true",
        language: req.body.language || "eng",
      });

      // Save processed result
      const outputFilename = `processed-${Date.now()}-${file.originalname}`;
      const outputPath = path.join(PROCESSED_DIR, outputFilename);

      // In a real implementation, you'd save the processed PDF here
      // For now, we'll just return the extracted text

      res.json({
        success: true,
        data: {
          originalName: file.originalname,
          filename: file.filename,
          size: getFileSizeMB(file.size),
          processingMode: processingMode,
          textLength: result.text?.length || 0,
          pages: result.pages || 0,
          // processedFile: `/uploads/processed/${outputFilename}`,
          extractedText: result.text,
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      next(error);
    } finally {
      // Clean up temp file
      if (req.file && req.file.path) {
        await deleteFile(req.file.path);
      }
    }
  }

  async processPDF(filePath, options) {
    // This is a simplified processing function
    // In a real implementation, you'd use pdf.js to render pages
    // and perform OCR on each page

    const result = await ocrService.extractTextFromPDF(filePath);

    return {
      text: result.text,
      pages: result.numPages,
      method: "ocr",
    };
  }

  // Get processed file
  async getProcessedFile(req, res) {
    try {
      const { filename } = req.params;
      const filePath = path.join(PROCESSED_DIR, filename);

      if (!(await fs.pathExists(filePath))) {
        return res.status(404).json({ error: "File not found" });
      }

      res.download(filePath);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  }

  // Delete processed file
  async deleteFile(req, res) {
    try {
      const { filename } = req.params;
      const filePath = path.join(PROCESSED_DIR, filename);

      if (await fs.pathExists(filePath)) {
        await deleteFile(filePath);
        res.json({ success: true, message: "File deleted" });
      } else {
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  }

  // Get processing status
  async getStatus(req, res) {
    res.json({
      status: "ready",
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    });
  }
}

module.exports = new PDFController();
