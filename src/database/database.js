const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const databaseDirectory = path.join(
  process.cwd(),
  "data"
);

fs.mkdirSync(databaseDirectory, {
  recursive: true
});

const databasePath = path.join(
  databaseDirectory,
  "voltage.db"
);

const db = new Database(databasePath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_id
  ON messages(chat_id);

  CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages(created_at);
`);

module.exports = db;
