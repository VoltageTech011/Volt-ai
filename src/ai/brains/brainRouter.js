const gemini = require("./brains/gemini");
const thinking = require("./brains/thinking");
const bk92 = require("./brains/bk92");
const image = require("./brains/image");
const video = require("./brains/video");
const audio = require("./brains/audio");
const search = require("./brains/search");
const document = require("./brains/document");

const brainRouter = {
  async text(prompt) {
    return gemini.generateText(prompt);
  },

  async reasoning(prompt) {
    return thinking.generateThinking(prompt);
  },

  async model(prompt, options = {}) {
    return bk92.generateWithModel(prompt, options);
  },

  async vision(prompt, imageUrl) {
    return image.analyzeImage(prompt, imageUrl);
  },

  async video(prompt, videoUrl, mime) {
    return video.analyzeVideo(prompt, videoUrl, mime);
  },

  async audio(prompt, audioUrl, mime) {
    return audio.analyzeAudio(prompt, audioUrl, mime);
  },

  async search(query) {
    return search.searchWeb(query);
  },

  async document(prompt, documentUrl) {
    return document.analyzeDocument(prompt, documentUrl);
  }
};

module.exports = brainRouter;
