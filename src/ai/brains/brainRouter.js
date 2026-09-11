const gemini = require("./gemini");
const thinking = require("./thinking");
const bk92 = require("./bk92");
const image = require("./image");
const video = require("./video");
const audio = require("./audio");
const search = require("./search");
const document = require("./document");

const { buildSystemPrompt } = require("../prompt");

function buildPrompt(userText, context = "") {
  const systemPrompt = buildSystemPrompt();

  return [
    systemPrompt,
    "",
    context,
    `USER MESSAGE:\n${userText}`,
    "",
    "Respond naturally as Voltage."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function classify(text) {
  const input = String(text || "")
    .trim()
    .toLowerCase();

  if (!input) {
    return "text";
  }

  const searchPatterns = [
    /\b(search|google|look up|find online|find on the web|browse)\b/,
    /\b(latest|recent|today|tonight|current|currently|news)\b/,
    /\b(weather|score|scores|price|prices|rate|rates)\b/,
    /\b(who won|what happened|what is happening)\b/
  ];

  if (
    searchPatterns.some((pattern) =>
      pattern.test(input)
    )
  ) {
    return "search";
  }

  const reasoningPatterns = [
    /\bsolve\b/,
    /\bcalculate\b/,
    /\bdebug\b/,
    /\bfix this\b/,
    /\bwhy does\b/,
    /\bwhy is\b/,
    /\bexplain deeply\b/,
    /\banalyze\b/,
    /\bcompare\b/,
    /\bstep by step\b/,
    /\breason\b/
  ];

  if (
    reasoningPatterns.some((pattern) =>
      pattern.test(input)
    )
  ) {
    return "reasoning";
  }

  const modelPatterns = [
    /\bcode\b/,
    /\bjavascript\b/,
    /\bnode\.?js\b/,
    /\bpython\b/,
    /\bprogram\b/,
    /\bprogramming\b/,
    /\bapi\b/,
    /\bbackend\b/,
    /\bfrontend\b/,
    /\breact\b/,
    /\bexpress\b/
  ];

  if (
    modelPatterns.some((pattern) =>
      pattern.test(input)
    )
  ) {
    return "model";
  }

  return "text";
}

async function route(text, context = "") {
  const type = classify(text);

  const prompt = buildPrompt(
    text,
    context
  );

  console.log(
    `Voltage intelligence route: ${type}`
  );

  try {
    switch (type) {
      case "search": {
        const searchResult =
          await search.searchWeb(text);

        if (
          !searchResult?.text &&
          !searchResult?.results?.length
        ) {
          return gemini.generateText(
            prompt
          );
        }

        const sourceContext = [
          searchResult.text
            ? `SEARCH ANSWER:\n${searchResult.text}`
            : "",
          searchResult.results?.length
            ? `WEB RESULTS:\n${JSON.stringify(
                searchResult.results
              )}`
            : "",
          searchResult.sources?.length
            ? `SOURCES:\n${JSON.stringify(
                searchResult.sources
              )}`
            : ""
        ]
          .filter(Boolean)
          .join("\n\n");

        return gemini.generateText(
          buildPrompt(
            text,
            `${context}\n\n${sourceContext}`
          )
        );
      }

      case "reasoning":
        return thinking.generateThinking(
          prompt
        );

      case "model":
        return bk92.generateWithModel(
          prompt,
          {
            model:
              "openai/gpt-oss-120b",
            instruction:
              buildSystemPrompt()
          }
        );

      case "text":
      default:
        return gemini.generateText(
          prompt
        );
    }
  } catch (error) {
    console.error(
      `Voltage ${type} brain failed:`,
      error
    );

    if (type !== "text") {
      console.log(
        "Falling back to Voltage text brain."
      );

      return gemini.generateText(
        prompt
      );
    }

    throw error;
  }
}

const brainRouter = {
  route,

  classify,

  buildPrompt,

  async text(prompt) {
    return gemini.generateText(
      buildPrompt(prompt)
    );
  },

  async reasoning(prompt) {
    return thinking.generateThinking(
      buildPrompt(prompt)
    );
  },

  async model(prompt, options = {}) {
    return bk92.generateWithModel(
      buildPrompt(prompt),
      {
        ...options,
        instruction:
          options.instruction ||
          buildSystemPrompt()
      }
    );
  },

  async vision(prompt, imageUrl) {
    return image.analyzeImage(
      buildPrompt(prompt),
      imageUrl
    );
  },

  async video(prompt, videoUrl, mime) {
    return video.analyzeVideo(
      buildPrompt(prompt),
      videoUrl,
      mime
    );
  },

  async audio(prompt, audioUrl, mime) {
    return audio.analyzeAudio(
      buildPrompt(prompt),
      audioUrl,
      mime
    );
  },

  async search(query) {
    return search.searchWeb(query);
  },

  async document(prompt, documentUrl) {
    return document.analyzeDocument(
      buildPrompt(prompt),
      documentUrl
    );
  }
};

module.exports = brainRouter;
