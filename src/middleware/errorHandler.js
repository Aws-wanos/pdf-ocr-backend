const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message);

  if (err.response) {
    return res.status(err.response.status || 500).json({
      success: false,
      error: err.response.data?.error?.message || "External API error",
      details: err.response.data,
    });
  }

  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
