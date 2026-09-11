const config = require("../../config");

async function generateThinking(prompt) {
  const url = new URL(config.brains.thinking);

  url.searchParams.set("q", prompt);
  url.searchParams.set("budget", "-1");
  url.searchParams.set("includeThoughts", "true");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Reasoning brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Reasoning brain returned an unsuccessful response");
  }

  return {
    text: data.content || data.BK9 || "",
    thoughtSummary: data.thoughtSummary || null,
    raw: data
  };
}

module.exports = {
  generateThinking
};
