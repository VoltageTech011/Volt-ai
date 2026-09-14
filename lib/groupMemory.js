const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'groupMembers.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  try {
    if (!fs.existsSync(FILE)) return {};
    return JSON.parse(fs.readFileSync(FILE, 'utf8') || '{}');
  } catch {
    return {};
  }
}

let database = load();

function save() {
  fs.writeFileSync(
    FILE,
    JSON.stringify(database, null, 2)
  );
}

function ensureGroup(groupId) {
  if (!database[groupId]) {
    database[groupId] = {
      members: {},
      settings: {
        introductions: true
      }
    };
  }

  return database[groupId];
}

function ensureMember(groupId, userId, data = {}) {
  const group = ensureGroup(groupId);

  if (!group.members[userId]) {
    group.members[userId] = {
      id: userId,
      number: userId.split('@')[0],
      name: data.name || 'Unknown',
      alias: null,
      age: null,
      role: null,
      introduced: false,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    };
  } else {
    if (data.name) {
      group.members[userId].name = data.name;
    }

    group.members[userId].lastSeen = Date.now();
  }

  save();

  return group.members[userId];
}

function getMember(groupId, userId) {
  return database[groupId]?.members?.[userId] || null;
}

function updateMember(groupId, userId, updates = {}) {
  const member = ensureMember(groupId, userId);

  Object.assign(member, updates);

  member.lastSeen = Date.now();

  save();

  return member;
}

function markIntroduced(groupId, userId, profile = {}) {
  return updateMember(groupId, userId, {
    ...profile,
    introduced: true,
    introducedAt: Date.now()
  });
}

function getUnintroduced(groupId) {
  const group = database[groupId];

  if (!group) return [];

  return Object.values(group.members)
    .filter(member => !member.introduced);
}

function getGroup(groupId) {
  return database[groupId] || null;
}

function getAllGroups() {
  return database;
}

module.exports = {
  ensureGroup,
  ensureMember,
  getMember,
  updateMember,
  markIntroduced,
  getUnintroduced,
  getGroup,
  getAllGroups
};
