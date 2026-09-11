const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

async function downloadMedia(message, type) {
  const media = message?.[type];

  if (!media) {
    throw new Error(`No ${type} found in message`);
  }

  const stream = await downloadContentFromMessage(
    media,
    type.replace("Message", "")
  );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function toDataUrl(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Expected media buffer");
  }

  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

module.exports = {
  downloadMedia,
  toDataUrl
};
