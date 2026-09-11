const db = require("../database/database");

const insertMessage = db.prepare(`
  INSERT INTO messages (
    chat_id,
    role,
    content,
    created_at
  )
  VALUES (?, ?, ?, ?)
`);

const selectMessages = db.prepare(`
  SELECT role, content, created_at
  FROM messages
  WHERE chat_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`);

const deleteMessages = db.prepare(`
  DELETE FROM messages
  WHERE chat_id = ?
`);

function addMessage(chatId, role, content) {
  insertMessage.run(
    chatId,
    role,
    content,
    Date.now()
  );
}

function getMessages(chatId, limit = 20) {
  return selectMessages
    .all(chatId, limit)
    .reverse();
}

function formatConversation(chatId, limit = 20) {
  const messages = getMessages(chatId, limit);

  if (!messages.length) {
    return "";
  }

  return messages
    .map((message) => {
      const speaker =
        message.role === "user"
          ? "USER"
          : "VOLTAGE";

      return `${speaker}: ${message.content}`;
    })
    .join("\n");
}

function clearConversation(chatId) {
  deleteMessages.run(chatId);
}

module.exports = {
  addMessage,
  getMessages,
  formatConversation,
  clearConversation
};
