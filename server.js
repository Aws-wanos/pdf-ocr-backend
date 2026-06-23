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
// GROQ AI SERVICE
// ============================================================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_TEXT_LENGTH = 3000;

// Fallback response when API fails
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

// Generate units using Groq API
const generateUnits = async (text, language, retryCount = 0) => {
  const textToSend = text.substring(0, MAX_TEXT_LENGTH);

  const prompt = `
Create JSON from this text:
${textToSend}

Language: ${language}

Format:
{
  "courseTitle": "title",
  "units": [{
    "id": 1,
    "title": "Unit 1",
    "description": "Description",
    "lessons": [{
      "id": 1,
      "title": "Lesson 1",
      "content": "Lesson content",
      "vocabulary": [{"word": "word", "meaning": "meaning"}],
      "grammar": [{"rule": "rule", "explanation": "explanation"}]
    }],
    "quiz": {
      "questions": [{"question": "Q?", "options": ["A","B","C","D"], "answer": 0}]
    },
    "funFact": "fun fact"
  }]
}

ONLY JSON. No other text.`;

  try {
    console.log(`🔄 Sending request to Groq (attempt ${retryCount + 1})...`);

    const response = await axios.post(
      GROQ_URL,
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are a JSON generator. Output ONLY valid JSON. Never output any other text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      },
    );

    const content = response.data.choices[0].message.content;

    let jsonString = content.replace(/```json/g, "").replace(/```/g, "");
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonString = jsonMatch[0];
    }

    jsonString = jsonString
      .replace(/,\s*}/g, "}")
      .replace(/,\s*\]/g, "]")
      .replace(/—/g, "-")
      .replace(/’/g, "'")
      .replace(/“/g, '"')
      .replace(/”/g, '"')
      .trim();

    const result = JSON.parse(jsonString);

    if (!result.units || result.units.length === 0) {
      result.units = [
        {
          id: 1,
          title: "Course Content",
          description: "Content from the text",
          lessons: [
            {
              id: 1,
              title: "Main Lesson",
              content: textToSend.substring(0, 500),
              vocabulary: [],
              grammar: [],
            },
          ],
          quiz: {
            questions: [
              {
                question: "What did you learn from this text?",
                options: [
                  "The main idea",
                  "A detail",
                  "A summary",
                  "All of the above",
                ],
                answer: 0,
              },
            ],
          },
          funFact: "Learning new content every day!",
        },
      ];
    }

    console.log(`✅ Generated ${result.units.length} units`);
    return result;
  } catch (error) {
    console.error("❌ Groq API Error:", error.message);

    if (error.response?.status === 429 && retryCount < 3) {
      const waitTime = (retryCount + 1) * 8000;
      console.log(
        `⏳ Rate limited. Waiting ${waitTime / 1000}s before retry...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return generateUnits(text, language, retryCount + 1);
    }

    return getFallbackResponse(text, language);
  }
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
      groq: GROQ_API_KEY ? "✅ Configured" : "❌ Missing API Key",
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

// ----- AI GENERATION ENDPOINTS -----

// Generate course from text
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

    if (!GROQ_API_KEY) {
      console.warn("⚠️ No GROQ_API_KEY found, using fallback mode");
      const fallbackResult = getFallbackResponse(text, language);
      return res.json({
        success: true,
        data: fallbackResult,
        stats: {
          textLength: text.length,
          unitsGenerated: fallbackResult.units?.length || 0,
          mode: "fallback",
        },
      });
    }

    console.log(`📚 Generating course for ${language} (${text.length} chars)`);

    const result = await generateUnits(text, language);

    res.json({
      success: true,
      data: result,
      stats: {
        textLength: text.length,
        unitsGenerated: result.units?.length || 0,
        mode: "api",
      },
    });
  } catch (error) {
    console.error("❌ AI Generation Error:", error);

    // Try fallback
    try {
      const { text, language } = req.body;
      const fallbackResult = getFallbackResponse(text, language);
      return res.json({
        success: true,
        data: fallbackResult,
        stats: {
          textLength: text?.length || 0,
          unitsGenerated: fallbackResult.units?.length || 0,
          mode: "fallback",
        },
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: error.message || "AI generation failed",
      });
    }
  }
});

// Test Groq API connection
app.get("/api/ai/test", async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.json({
        success: false,
        error: "GROQ_API_KEY not configured",
      });
    }

    const response = await axios.post(
      GROQ_URL,
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: "Say 'Connection successful!' in one sentence.",
          },
        ],
        max_tokens: 20,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    res.json({
      success: true,
      message: response.data.choices[0].message.content,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

// Get AI service status
app.get("/api/ai/status", (req, res) => {
  res.json({
    success: true,
    data: {
      configured: !!GROQ_API_KEY,
      model: GROQ_API_KEY ? "llama-3.1-8b-instant" : null,
      maxTextLength: MAX_TEXT_LENGTH,
      status: GROQ_API_KEY ? "ready" : "missing_api_key",
    },
  });
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
  console.log(`📚 AI Generate:   POST /api/generate`);
  console.log(`✅ Health Check:  GET  /api/health`);
  console.log(
    `🔗 Groq API:      ${GROQ_API_KEY ? "✅ Configured" : "❌ Missing"}`,
  );
  console.log(`🌐 CORS enabled:  *`);
  console.log("========================================");
});
