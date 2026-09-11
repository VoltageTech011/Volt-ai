const brainRouter = require("../ai/brains/brainRouter");

async function handleMessages(socket, messages) {
  for (const message of messages) {
    try {
      if (!message.message) {
        continue;
      }

      if (message.key.fromMe) {
        continue;
      }

      if (message.key.remoteJid === "status@broadcast") {
        continue;
      }

      const remoteJid = message.key.remoteJid;

      if (!remoteJid) {
        continue;
      }

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      if (!text.trim()) {
        continue;
      }

      console.log(`WhatsApp message from ${remoteJid}: ${text}`);

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

      try {
        await socket.sendMessage(message.key.remoteJid, {
          text: "I hit an internal error while processing that. Try again."
        });
      } catch (sendError) {
        console.error("Failed to send error message:", sendError);
      }
    }
  }
}

module.exports = {
  handleMessages
};
