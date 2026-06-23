const groqService = require("../services/groqService");

class AIController {
  // Generate course from text
  async generateCourse(req, res, next) {
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

      console.log(
        `📚 Generating course for ${language} (${text.length} chars)`,
      );

      const result = await groqService.generateUnits(text, language);

      res.json({
        success: true,
        data: result,
        stats: {
          textLength: text.length,
          unitsGenerated: result.units?.length || 0,
        },
      });
    } catch (error) {
      console.error("Controller error:", error);
      next(error);
    }
  }

  // Test the Groq API connection
  async testConnection(req, res, next) {
    try {
      const result = await groqService.testConnection();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get service status
  async getStatus(req, res, next) {
    try {
      const hasKey = !!process.env.GROQ_API_KEY;
      res.json({
        success: true,
        data: {
          configured: hasKey,
          model: hasKey ? "llama-3.1-8b-instant" : null,
          maxTextLength: parseInt(process.env.MAX_TEXT_LENGTH) || 3000,
          status: hasKey ? "ready" : "missing_api_key",
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AIController();
