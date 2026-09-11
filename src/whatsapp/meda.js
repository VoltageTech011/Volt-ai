const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

async function downloadMedia(message, type) {
  const media = message?.[type];

  if (!media) {
    throw new Error(`Missing ${type} message`);
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

function toDataUrl(buffer, mime) {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

module.exports = {
  downloadMedia,
  toDataUrl
};
