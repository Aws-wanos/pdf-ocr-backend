const Tesseract = require("tesseract.js");
const fs = require("fs-extra");
const path = require("path");
const pdf = require("pdf-parse");
const { TEMP_DIR, PROCESSED_DIR, deleteFile } = require("../utils/fileUtils");

class OCRService {
  constructor() {
    this.languages = ["eng", "spa", "fra", "deu", "rus", "ita", "por"];
    this.tesseractWorker = null;
  }

  async initializeWorker() {
    if (!this.tesseractWorker) {
      this.tesseractWorker = await Tesseract.createWorker();
      await this.tesseractWorker.setLanguage(this.languages.join("+"));
    }
    return this.tesseractWorker;
  }

  async extractTextFromPDF(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdf(dataBuffer);
      return {
        text: data.text,
        numPages: data.numpages,
        info: data.info,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error("PDF extraction error:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  async performOCR(imagePath) {
    try {
      const worker = await this.initializeWorker();
      const {
        data: { text },
      } = await worker.recognize(imagePath);
      return text;
    } catch (error) {
      console.error("OCR error:", error);
      throw new Error("OCR processing failed");
    }
  }

  async processPDFWithOCR(pdfPath, progressCallback) {
    // This is a simplified version - implement full PDF processing
    // In a real implementation, you'd use pdf.js to render pages to images
    // and then run OCR on each page
    const text = await this.extractTextFromPDF(pdfPath);
    return text;
  }

  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

module.exports = new OCRService();
