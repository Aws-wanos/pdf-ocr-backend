const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// ============================================================
// CREATE UPLOAD DIRECTORIES
// ============================================================
["./uploads", "./uploads/temp", "./uploads/processed"].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================================================
// MULTER CONFIGURATION (PDF Upload)
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/temp"),
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

// ============================================================
// FALLBACK RESPONSE (No AI)
// ============================================================
const getFallbackResponse = (text, language) => {
  console.log("📚 Returning fallback response");
  return {
    courseTitle: `${language} Course`,
    units: [
      {
        id: 1,
        title: `Introduction to ${language}`,
        description:
          text.substring(0, 200) || `Welcome to your ${language} course!`,
        lessons: [
          {
            id: 1,
            title: "Main Lesson",
            content:
              text.substring(0, 800) ||
              `This is your first lesson in ${language}.`,
            vocabulary: [
              { word: "Hello", meaning: "A greeting" },
              { word: "World", meaning: "The earth" },
            ],
            grammar: [
              {
                rule: "Basic Sentence Structure",
                explanation: "Subject + Verb + Object",
              },
            ],
          },
        ],
        quiz: {
          questions: [
            {
              question: "What is the main topic of this text?",
              options: [
                "A summary",
                "The introduction",
                "The conclusion",
                "The main idea",
              ],
              answer: 3,
            },
          ],
        },
        funFact: "Learning a new language opens up new opportunities!",
      },
    ],
  };
};

// ============================================================
// API ENDPOINTS
// ============================================================

// ----- Health Check -----
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      upload: "✅ Ready",
      ai: "⏳ Coming Soon (YandexGPT)",
    },
  });
});

// ----- PDF UPLOAD ENDPOINTS -----

// Upload PDF (field: 'pdf')
app.post("/api/upload", upload.single("pdf"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
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

// Upload chunk (field: 'chunk')
app.post("/api/upload/chunk", upload.single("chunk"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No chunk uploaded" });
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

// Upload any file
app.post("/api/upload/any", upload.any(), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
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

// ----- AI GENERATION ENDPOINT (Coming Soon) -----
app.post("/api/generate", async (req, res) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    if (!language) {
      return res.status(400).json({
        success: false,
        error: "Language is required",
      });
    }

    if (text.length < 50) {
      return res.status(400).json({
        success: false,
        error: "Text is too short. Please provide at least 50 characters.",
      });
    }

    console.log(`📚 Generating course for ${language} (${text.length} chars)`);
    console.log("⏳ AI Teacher coming soon with YandexGPT!");

    // Return fallback for now
    const fallbackResult = getFallbackResponse(text, language);
    return res.json({
      success: true,
      data: fallbackResult,
      stats: {
        textLength: text.length,
        unitsGenerated: fallbackResult.units?.length || 0,
        mode: "fallback",
        message: "AI Teacher coming soon with YandexGPT! 🚀",
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Generation failed",
    });
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log("========================================");
  console.log(`🚀 Unified Server running on http://localhost:${PORT}`);
  console.log("========================================");
  console.log(`📤 PDF Upload:    POST /api/upload`);
  console.log(`📚 AI Generate:   POST /api/generate (Coming Soon)`);
  console.log(`✅ Health Check:  GET  /api/health`);
  console.log(`🌐 CORS enabled:  *`);
  console.log("========================================");
  console.log("⏳ AI Teacher coming soon with YandexGPT!");
});
