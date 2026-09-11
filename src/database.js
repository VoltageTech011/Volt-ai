const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dataPath = path.join(process.cwd(), "data");

fs.mkdirSync(dataPath, {
  recursive: true
});

const db = new Database(
  path.join(dataPath, "voltage.db")
);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(chat_id, created_at);
`);

module.exports = db;
