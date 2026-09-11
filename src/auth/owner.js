const config = require("../config");

function normalizeNumber(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "");
}

function getSenderNumber(message) {
  const jid =
    message.key?.participant ||
    message.key?.remoteJid ||
    "";

  return normalizeNumber(
    jid.split("@")[0].split(":")[0]
  );
}

function isOwner(message) {
  const owner =
    normalizeNumber(config.owner.number);

  const sender =
    getSenderNumber(message);

  return Boolean(owner && sender === owner);
}

module.exports = {
  normalizeNumber,
  getSenderNumber,
  isOwner
};
