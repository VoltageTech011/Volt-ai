const dotenv = require("dotenv");

dotenv.config();

const config = {
  name: process.env.VOLTAGE_NAME || "Voltage",
  port: Number(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || "development",

  brains: {
    gemini: "https://api.bk9.dev/ai/gemini",
    thinking: "https://api.bk9.dev/ai/gemini-thinking",
    bk92: "https://api.bk9.dev/ai/BK92",
    image: "https://api.bk9.dev/ai/geminiimg",
    video: "https://api.bk9.dev/ai/gemini-video",
    audio: "https://api.bk9.dev/ai/gemini-audio",
    search: "https://api.bk9.dev/ai/perplexity",
    document: "https://api.bk9.dev/ai/gemini-document"
  }
};

module.exports = config;
