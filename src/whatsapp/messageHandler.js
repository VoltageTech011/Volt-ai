const brainRouter = require("../ai/brains/brainRouter");

function isGroupMessage(jid) {
  return jid.endsWith("@g.us");
}

function extractText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  ).trim();
}

function wasVoltageMentioned(message, socket) {
  const mentionedJid =
    message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

  const botJid = socket.user?.id?.split(":")[0];

  if (!botJid) {
    return false;
  }

  return mentionedJid.some((jid) => {
    return jid.split("@")[0].split(":")[0] === botJid;
  });
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

      if (group && !wasVoltageMentioned(message.message, socket)) {
        continue;
      }

      const text = extractText(message.message);

      if (!text) {
        continue;
      }

      console.log(
        `${group ? "Group" : "DM"} message from ${remoteJid}: ${text}`
      );

      await socket.sendPresenceUpdate("composing", remoteJid);

      const result = await brainRouter.route(text);

      const response =
        result?.result?.text ||
        "I couldn't generate a response right now.";

      await socket.sendMessage(remoteJid, {
        text: response
      });

      await socket.sendPresenceUpdate("paused", remoteJid);
    } catch (error) {
      console.error("Message handling error:", error);
    }
  }
}

module.exports = {
  handleMessages
};
