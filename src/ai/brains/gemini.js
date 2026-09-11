const config = require("../../config");

async function generateText(prompt) {
  const url = new URL(config.brains.gemini);

  url.searchParams.set("q", prompt);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Text brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Text brain returned an unsuccessful response");
  }

  return {
    text: data.BK9 || "",
    raw: data
  };
}

module.exports = {
  generateText
};
