const config = require("../../config");

async function analyzeDocument(prompt, documentUrl) {
  const url = new URL(config.brains.document);

  url.searchParams.set("q", prompt);
  url.searchParams.set("url", documentUrl);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Document brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Document brain returned an unsuccessful response");
  }

  return {
    text: data.content || data.BK9 || data.result || "",
    raw: data
  };
}

module.exports = {
  analyzeDocument
};
