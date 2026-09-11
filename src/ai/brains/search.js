const config = require("../../config");

async function searchWeb(query) {
  const url = new URL(config.brains.search);

  url.searchParams.set("q", query);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Search brain returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (!data.status) {
    throw new Error("Search brain returned an unsuccessful response");
  }

  return {
    text: data.answer || "",
    sources: data.sources || [],
    results: data.web_results || [],
    raw: data
  };
}

module.exports = {
  searchWeb
};
