const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'voltage.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT UNIQUE NOT NULL,
      number TEXT,
      name TEXT,
      alias TEXT,
      age TEXT,
      role TEXT,
      bio TEXT,
      introduced INTEGER DEFAULT 0,
      introduction_requested INTEGER DEFAULT 0,
      joined_at INTEGER,
      introduced_at INTEGER,
      last_seen INTEGER,
      message_count INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jid TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      owner TEXT,
      member_count INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_jid TEXT NOT NULL,
      user_jid TEXT NOT NULL,
      joined_at INTEGER,
      last_seen INTEGER,
      is_admin INTEGER DEFAULT 0,
      is_group_owner INTEGER DEFAULT 0,
      UNIQUE(group_jid, user_jid)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_jid TEXT,
      group_jid TEXT,
      memory TEXT NOT NULL,
      importance INTEGER DEFAULT 1,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS introductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_jid TEXT NOT NULL,
      group_jid TEXT NOT NULL,
      raw_text TEXT,
      name TEXT,
      age TEXT,
      role TEXT,
      alias TEXT,
      extra TEXT,
      created_at INTEGER
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_jid
    ON users(jid)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_members_group
    ON group_members(group_jid)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_user
    ON memories(user_jid)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_group
    ON memories(group_jid)
  `);
});

function now() {
  return Date.now();
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        id: this.lastID,
        changes: this.changes
      });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
}

async function getUser(jid) {
  return get(
    `SELECT * FROM users WHERE jid = ?`,
    [jid]
  );
}

async function createUser({
  jid,
  number = '',
  name = '',
  groupJid = null
}) {
  const timestamp = now();

  await run(
    `
    INSERT OR IGNORE INTO users
    (
      jid,
      number,
      name,
      joined_at,
      last_seen,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      jid,
      number,
      name,
      timestamp,
      timestamp,
      timestamp,
      timestamp
    ]
  );

  await run(
    `
    UPDATE users
    SET
      number = COALESCE(NULLIF(?, ''), number),
      name = COALESCE(NULLIF(?, ''), name),
      last_seen = ?,
      updated_at = ?,
      message_count = message_count + 1
    WHERE jid = ?
    `,
    [
      number,
      name,
      timestamp,
      timestamp,
      jid
    ]
  );

  if (groupJid) {
    await addGroupMember(
      groupJid,
      jid,
      timestamp
    );
  }

  return getUser(jid);
}

async function updateUser(jid, fields = {}) {
  const allowed = [
    'number',
    'name',
    'alias',
    'age',
    'role',
    'bio',
    'introduced',
    'introduction_requested',
    'joined_at',
    'introduced_at',
    'last_seen'
  ];

  const keys = Object.keys(fields)
    .filter(key => allowed.includes(key));

  if (!keys.length) {
    return getUser(jid);
  }

  const values = keys.map(
    key => fields[key]
  );

  const assignments = keys
    .map(key => `${key} = ?`)
    .join(', ');

  values.push(now());
  values.push(jid);

  await run(
    `
    UPDATE users
    SET ${assignments},
        updated_at = ?
    WHERE jid = ?
    `,
    values
  );

  return getUser(jid);
}

async function markIntroductionRequested(jid) {
  return updateUser(jid, {
    introduction_requested: 1
  });
}

async function markIntroduced(jid, data = {}) {
  const timestamp = now();

  return updateUser(jid, {
    name: data.name || undefined,
    alias: data.alias || undefined,
    age: data.age || undefined,
    role: data.role || undefined,
    bio: data.bio || undefined,
    introduced: 1,
    introduction_requested: 0,
    introduced_at: timestamp
  });
}

async function saveIntroduction({
  userJid,
  groupJid,
  rawText = '',
  name = '',
  age = '',
  role = '',
  alias = '',
  extra = ''
}) {
  await run(
    `
    INSERT INTO introductions
    (
      user_jid,
      group_jid,
      raw_text,
      name,
      age,
      role,
      alias,
      extra,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userJid,
      groupJid,
      rawText,
      name,
      age,
      role,
      alias,
      extra,
      now()
    ]
  );

  await markIntroduced(userJid, {
    name,
    age,
    role,
    alias,
    bio: extra
  });

  return getUser(userJid);
}

async function getGroup(jid) {
  return get(
    `SELECT * FROM groups WHERE jid = ?`,
    [jid]
  );
}

async function upsertGroup({
  jid,
  name = '',
  description = '',
  owner = '',
  memberCount = 0
}) {
  const timestamp = now();

  await run(
    `
    INSERT INTO groups
    (
      jid,
      name,
      description,
      owner,
      member_count,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(jid)
    DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      owner = excluded.owner,
      member_count = excluded.member_count,
      updated_at = excluded.updated_at
    `,
    [
      jid,
      name,
      description,
      owner,
      memberCount,
      timestamp,
      timestamp
    ]
  );

  return getGroup(jid);
}

async function addGroupMember(
  groupJid,
  userJid,
  joinedAt = now()
) {
  await run(
    `
    INSERT OR IGNORE INTO group_members
    (
      group_jid,
      user_jid,
      joined_at,
      last_seen
    )
    VALUES (?, ?, ?, ?)
    `,
    [
      groupJid,
      userJid,
      joinedAt,
      now()
    ]
  );

  await run(
    `
    UPDATE group_members
    SET last_seen = ?
    WHERE group_jid = ?
      AND user_jid = ?
    `,
    [
      now(),
      groupJid,
      userJid
    ]
  );

  return getGroupMember(
    groupJid,
    userJid
  );
}

async function updateGroupMember(
  groupJid,
  userJid,
  fields = {}
) {
  const allowed = [
    'joined_at',
    'last_seen',
    'is_admin',
    'is_group_owner'
  ];

  const keys = Object.keys(fields)
    .filter(key => allowed.includes(key));

  if (!keys.length) {
    return getGroupMember(
      groupJid,
      userJid
    );
  }

  const values = keys.map(
    key => fields[key]
  );

  const assignments = keys
    .map(key => `${key} = ?`)
    .join(', ');

  values.push(groupJid);
  values.push(userJid);

  await run(
    `
    UPDATE group_members
    SET ${assignments}
    WHERE group_jid = ?
      AND user_jid = ?
    `,
    values
  );

  return getGroupMember(
    groupJid,
    userJid
  );
}

async function getGroupMember(
  groupJid,
  userJid
) {
  return get(
    `
    SELECT
      gm.*,
      u.name,
      u.alias,
      u.age,
      u.role,
      u.introduced,
      u.bio,
      u.number
    FROM group_members gm
    LEFT JOIN users u
      ON u.jid = gm.user_jid
    WHERE gm.group_jid = ?
      AND gm.user_jid = ?
    `,
    [
      groupJid,
      userJid
    ]
  );
}

async function getGroupMembers(groupJid) {
  return all(
    `
    SELECT
      gm.*,
      u.name,
      u.alias,
      u.age,
      u.role,
      u.introduced,
      u.bio,
      u.number
    FROM group_members gm
    LEFT JOIN users u
      ON u.jid = gm.user_jid
    WHERE gm.group_jid = ?
    ORDER BY u.name COLLATE NOCASE ASC
    `,
    [groupJid]
  );
}

async function removeGroupMember(
  groupJid,
  userJid
) {
  return run(
    `
    DELETE FROM group_members
    WHERE group_jid = ?
      AND user_jid = ?
    `,
    [
      groupJid,
      userJid
    ]
  );
}

async function addMemory({
  userJid = null,
  groupJid = null,
  memory,
  importance = 1
}) {
  if (!memory) {
    return null;
  }

  const timestamp = now();

  return run(
    `
    INSERT INTO memories
    (
      user_jid,
      group_jid,
      memory,
      importance,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      userJid,
      groupJid,
      memory,
      importance,
      timestamp,
      timestamp
    ]
  );
}

async function getUserMemories(
  userJid,
  limit = 20
) {
  return all(
    `
    SELECT *
    FROM memories
    WHERE user_jid = ?
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
    `,
    [
      userJid,
      limit
    ]
  );
}

async function getGroupMemories(
  groupJid,
  limit = 20
) {
  return all(
    `
    SELECT *
    FROM memories
    WHERE group_jid = ?
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
    `,
    [
      groupJid,
      limit
    ]
  );
}

async function searchUsers(query, limit = 10) {
  const value = `%${String(query).toLowerCase()}%`;

  return all(
    `
    SELECT *
    FROM users
    WHERE
      LOWER(name) LIKE ?
      OR LOWER(alias) LIKE ?
      OR number LIKE ?
    ORDER BY last_seen DESC
    LIMIT ?
    `,
    [
      value,
      value,
      value,
      limit
    ]
  );
}

async function getUnintroducedUsers(groupJid) {
  return all(
    `
    SELECT
      u.*,
      gm.joined_at,
      gm.last_seen,
      gm.is_admin,
      gm.is_group_owner
    FROM group_members gm
    JOIN users u
      ON u.jid = gm.user_jid
    WHERE
      gm.group_jid = ?
      AND u.introduced = 0
    ORDER BY gm.joined_at ASC
    `,
    [groupJid]
  );
}

async function getUserIntroduction(
  userJid,
  groupJid = null
) {
  if (groupJid) {
    return get(
      `
      SELECT *
      FROM introductions
      WHERE user_jid = ?
        AND group_jid = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [
        userJid,
        groupJid
      ]
    );
  }

  return get(
    `
    SELECT *
    FROM introductions
    WHERE user_jid = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userJid]
  );
}

function close() {
  return new Promise((resolve, reject) => {
    db.close(error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  db,

  getUser,
  createUser,
  updateUser,

  markIntroductionRequested,
  markIntroduced,
  saveIntroduction,
  getUserIntroduction,

  getGroup,
  upsertGroup,

  addGroupMember,
  updateGroupMember,
  getGroupMember,
  getGroupMembers,
  removeGroupMember,

  addMemory,
  getUserMemories,
  getGroupMemories,

  searchUsers,
  getUnintroducedUsers,

  close
};
