const config = require("../../config");

async function analyzeAudio(prompt, audioUrl, mime = "audio/mp3") {
  const url = new URL(config.brains.audio);

  url.searchParams.set("q", prompt);
  url.searchParams.set("url", audioUrl);
  url.searchParams.set("mime", mime);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Audio brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Audio brain returned an unsuccessful response");
  }

  return {
    text: data.content || data.BK9 || data.result || "",
    raw: data
  };
}

module.exports = {
  analyzeAudio
};
