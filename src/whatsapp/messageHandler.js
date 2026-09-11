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

function getContextInfo(message) {
  return (
    message?.extendedTextMessage?.contextInfo ||
    message?.imageMessage?.contextInfo ||
    message?.videoMessage?.contextInfo ||
    null
  );
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

function removeVoltageMention(text, socket) {
  const botJid = socket.user?.id?.split(":")[0];

  if (!botJid) {
    return text;
  }

  return text
    .replace(/@\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

      let text = extractText(message.message);

      if (!text) {
        continue;
      }

      if (group) {
        text = removeVoltageMention(text, socket);
      }

      const quotedText = getQuotedText(message.message);

      let context = "";

      if (quotedText) {
        context = `The user is replying to this previous WhatsApp message:

"${quotedText}"`;
      }

      console.log(
        `${group ? "Group" : "DM"} message from ${remoteJid}: ${text}`
      );

      await socket.sendPresenceUpdate("composing", remoteJid);

      const result = await brainRouter.route(text, context);

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
