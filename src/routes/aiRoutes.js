const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");

// Generate course from text
router.post("/generate", aiController.generateCourse);

// Test Groq API connection
router.get("/ai/test", aiController.testConnection);

// Get AI service status
router.get("/ai/status", aiController.getStatus);

module.exports = router;
