const brainRouter = require("../ai/brains/brainRouter");
const memory = require("../memory/store");

function isGroupMessage(jid) {
  return jid.endsWith("@g.us");
}

function getContextInfo(message) {
  return (
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    message?.audioMessage?.contextInfo ||
    message?.documentMessage?.contextInfo ||
    null
  );
}

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    ""
  ).trim();
}

function wasVoltageMentioned(message, socket) {
  const contextInfo = getContextInfo(message);

  const mentionedJid = contextInfo?.mentionedJid || [];

  const botJid = socket.user?.id?.split(":")[0];

  if (!botJid) {
    return false;
  }

  return mentionedJid.some((jid) => {
    return jid.split("@")[0].split(":")[0] === botJid;
  });
}

function getQuotedText(message) {
  const contextInfo = getContextInfo(message);

  if (!contextInfo?.quotedMessage) {
    return "";
  }

  return extractText(contextInfo.quotedMessage);
}

function removeMention(text) {
  return text
    .replace(/@\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function downloadMedia(socket, message) {
  const type = Object.keys(message)[0];

  if (
    type !== "imageMessage" &&
    type !== "audioMessage" &&
    type !== "videoMessage" &&
    type !== "documentMessage"
  ) {
    return null;
  }

  const stream = await require("@whiskeysockets/baileys")
    .downloadContentFromMessage(
      message[type],
      type.replace("Message", "")
    );

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function handleImage(socket, message, text) {
  const imageMessage = message.imageMessage;

  const buffer = await downloadMedia(socket, message);

  if (!buffer) {
    throw new Error("Unable to download image");
  }

  const base64 = buffer.toString("base64");

  const mime =
    imageMessage.mimetype || "image/jpeg";

  const dataUrl = `data:${mime};base64,${base64}`;

  return brainRouter.vision(
    text || "Describe and analyze this image.",
    dataUrl
  );
}

async function handleAudio(socket, message, text) {
  const audioMessage = message.audioMessage;

  const buffer = await downloadMedia(socket, message);

  if (!buffer) {
    throw new Error("Unable to download audio");
  }

  const base64 = buffer.toString("base64");

  const mime =
    audioMessage.mimetype || "audio/mp4";

  const dataUrl = `data:${mime};base64,${base64}`;

  return brainRouter.audio(
    text || "Analyze this audio.",
    dataUrl,
    mime
  );
}

async function handleVideo(socket, message, text) {
  const videoMessage = message.videoMessage;

  const buffer = await downloadMedia(socket, message);

  if (!buffer) {
    throw new Error("Unable to download video");
  }

  const base64 = buffer.toString("base64");

  const mime =
    videoMessage.mimetype || "video/mp4";

  const dataUrl = `data:${mime};base64,${base64}`;

  return brainRouter.video(
    text || "Analyze this video.",
    dataUrl,
    mime
  );
}

async function handleDocument(socket, message, text) {
  const documentMessage = message.documentMessage;

  const buffer = await downloadMedia(socket, message);

  if (!buffer) {
    throw new Error("Unable to download document");
  }

  const base64 = buffer.toString("base64");

  const mime =
    documentMessage.mimetype ||
    "application/octet-stream";

  const dataUrl = `data:${mime};base64,${base64}`;

  return brainRouter.document(
    text || "Analyze this document.",
    dataUrl
  );
}

async function handleMessages(socket, messages) {
  for (const message of messages) {
    try {
      if (!message?.message) {
        continue;
      }

      if (message.key?.fromMe) {
        continue;
      }

      const remoteJid = message.key?.remoteJid;

      if (!remoteJid || remoteJid === "status@broadcast") {
        continue;
      }

      const group = isGroupMessage(remoteJid);

      if (
        group &&
        !wasVoltageMentioned(message.message, socket)
      ) {
        continue;
      }

      let text = extractText(message.message);

      if (group) {
        text = removeMention(text);
      }

      const quotedText = getQuotedText(message.message);
      const previousConversation =
        memory.formatConversation(remoteJid);

      let context = "";

      if (previousConversation) {
        context += `CONVERSATION HISTORY:\n${previousConversation}\n\n`;
      }

      if (quotedText) {
        context += `QUOTED WHATSAPP MESSAGE:\n${quotedText}\n`;
      }

      console.log(
        `${group ? "Group" : "DM"} message from ${remoteJid}`
      );

      let result;

      if (message.message.imageMessage) {
        result = await handleImage(
          socket,
          message.message,
          text
        );
      } else if (message.message.audioMessage) {
        result = await handleAudio(
          socket,
          message.message,
          text
        );
      } else if (message.message.videoMessage) {
        result = await handleVideo(
          socket,
          message.message,
          text
        );
      } else if (message.message.documentMessage) {
        result = await handleDocument(
          socket,
          message.message,
          text
        );
      } else {
        if (!text) {
          continue;
        }

        result = await brainRouter.route(
          text,
          context
        );
      }

      const response =
        result?.text ||
        result?.result?.text ||
        "I couldn't process that right now.";

      memory.addMessage(
        remoteJid,
        "user",
        text || "[media]"
      );

      memory.addMessage(
        remoteJid,
        "assistant",
        response
      );

      await socket.sendPresenceUpdate(
        "composing",
        remoteJid
      );

      await socket.sendMessage(remoteJid, {
        text: response
      });

      await socket.sendPresenceUpdate(
        "paused",
        remoteJid
      );
    } catch (error) {
      console.error(
        "Message handling error:",
        error
      );
    }
  }
}

module.exports = {
  handleMessages
};
