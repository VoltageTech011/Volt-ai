const dotenv = require("dotenv");

dotenv.config();

const config = {
  name: process.env.VOLTAGE_NAME || "Voltage",

  port: Number(process.env.PORT) || 3000,

  environment:
    process.env.NODE_ENV || "development",

  version:
    process.env.VOLTAGE_VERSION || "1.0.0",

  prefix:
    process.env.VOLTAGE_PREFIX || ".",

  mode:
    process.env.VOLTAGE_MODE || "public",

  owner: {
    name:
      process.env.OWNER_NAME ||
      "Thereal_VoltageLord",

    number:
      process.env.OWNER_NUMBER || ""
  },

  brains: {
    gemini:
      "https://api.bk9.dev/ai/gemini",

    thinking:
      "https://api.bk9.dev/ai/gemini-thinking",

    bk92:
      "https://api.bk9.dev/ai/BK92",

    image:
      "https://api.bk9.dev/ai/geminiimg",

    video:
      "https://api.bk9.dev/ai/gemini-video",

    audio:
      "https://api.bk9.dev/ai/gemini-audio",

    search:
      "https://api.bk9.dev/ai/perplexity",

    document:
      "https://api.bk9.dev/ai/gemini-document"
  }
};

module.exports = config;
