const brainRouter = require("../ai/brains/brainRouter");
const memory = require("../memory/store");
const {
  downloadMedia,
  toDataUrl
} = require("./media");

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
  const quotedMessage = contextInfo?.quotedMessage;

  if (!quotedMessage) {
    return "";
  }

  return extractText(quotedMessage);
}

function removeMention(text) {
  return text
    .replace(/@\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function processImage(message, text) {
  const media = message.imageMessage;

  const buffer = await downloadMedia(
    message,
    "imageMessage"
  );

  const mime =
    media.mimetype || "image/jpeg";

  return brainRouter.vision(
    text || "Analyze this image.",
    toDataUrl(buffer, mime)
  );
}

async function processAudio(message, text) {
  const media = message.audioMessage;

  const buffer = await downloadMedia(
    message,
    "audioMessage"
  );

  const mime =
    media.mimetype || "audio/mp4";

  return brainRouter.audio(
    text || "Analyze this audio.",
    toDataUrl(buffer, mime),
    mime
  );
}

async function processVideo(message, text) {
  const media = message.videoMessage;

  const buffer = await downloadMedia(
    message,
    "videoMessage"
  );

  const mime =
    media.mimetype || "video/mp4";

  return brainRouter.video(
    text || "Analyze this video.",
    toDataUrl(buffer, mime),
    mime
  );
}

async function processDocument(message, text) {
  const media = message.documentMessage;

  const buffer = await downloadMedia(
    message,
    "documentMessage"
  );

  const mime =
    media.mimetype ||
    "application/octet-stream";

  return brainRouter.document(
    text || "Analyze this document.",
    toDataUrl(buffer, mime)
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

      if (
        !remoteJid ||
        remoteJid === "status@broadcast"
      ) {
        continue;
      }

      const group = isGroupMessage(remoteJid);

      if (
        group &&
        !wasVoltageMentioned(
          message.message,
          socket
        )
      ) {
        continue;
      }

      let text = extractText(message.message);

      if (group) {
        text = removeMention(text);
      }

      const quotedText =
        getQuotedText(message.message);

      const history =
        memory.formatConversation(remoteJid);

      let context = "";

      if (history) {
        context +=
          `CONVERSATION HISTORY:\n${history}\n\n`;
      }

      if (quotedText) {
        context +=
          `QUOTED WHATSAPP MESSAGE:\n${quotedText}\n\n`;
      }

      console.log(
        `${group ? "Group" : "DM"} message from ${remoteJid}: ${text || "[media]"}`
      );

      await socket.sendPresenceUpdate(
        "composing",
        remoteJid
      );

      let result;

      if (message.message.imageMessage) {
        result = await processImage(
          message.message,
          text
        );
      } else if (message.message.audioMessage) {
        result = await processAudio(
          message.message,
          text
        );
      } else if (message.message.videoMessage) {
        result = await processVideo(
          message.message,
          text
        );
      } else if (message.message.documentMessage) {
        result = await processDocument(
          message.message,
          text
        );
      } else {
        if (!text) {
          await socket.sendPresenceUpdate(
            "paused",
            remoteJid
          );

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

      await socket.sendMessage(
        remoteJid,
        {
          text: response
        }
      );

      await socket.sendPresenceUpdate(
        "paused",
        remoteJid
      );
    } catch (error) {
      console.error(
        "Message handling error:",
        error
      );

      try {
        const remoteJid =
          message?.key?.remoteJid;

        if (remoteJid) {
          await socket.sendMessage(
            remoteJid,
            {
              text:
                "I couldn't process that message right now. Try again."
            }
          );

          await socket.sendPresenceUpdate(
            "paused",
            remoteJid
          );
        }
      } catch (sendError) {
        console.error(
          "Failed to send error response:",
          sendError
        );
      }
    }
  }
}

module.exports = {
  handleMessages
};
