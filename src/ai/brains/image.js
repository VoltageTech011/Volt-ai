const config = require("../../config");

async function analyzeImage(prompt, imageUrl) {
  const url = new URL(config.brains.image);

  url.searchParams.set("q", prompt);
  url.searchParams.set("url", imageUrl);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Image brain returned an unsuccessful response");
  }

  return {
    text: data.BK9 || data.content || data.result || "",
    raw: data
  };
}

module.exports = {
  analyzeImage
};
