const config = require("../../config");

async function analyzeVideo(prompt, videoUrl, mime = "video/mp4") {
  const url = new URL(config.brains.video);

  url.searchParams.set("q", prompt);
  url.searchParams.set("url", videoUrl);
  url.searchParams.set("mime", mime);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Video brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Video brain returned an unsuccessful response");
  }

  return {
    text: data.content || data.BK9 || data.result || "",
    raw: data
  };
}

module.exports = {
  analyzeVideo
};
