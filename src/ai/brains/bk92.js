const config = require("../../config");

async function generateWithModel(prompt, options = {}) {
  const url = new URL(config.brains.bk92);

  url.searchParams.set("q", prompt);
  url.searchParams.set(
    "BK9",
    options.instruction || "You are Voltage, a helpful conversational AI."
  );
  url.searchParams.set(
    "model",
    options.model || "openai/gpt-oss-120b"
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Model brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Model brain returned an unsuccessful response");
  }

  return {
    text: data.BK9 || data.content || "",
    raw: data
  };
}

module.exports = {
  generateWithModel
};
