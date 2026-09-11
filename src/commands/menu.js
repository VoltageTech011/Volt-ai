const config = require("../config");

const commands = {
  group: [
    ["tagall", "Mention everyone"],
    ["tagadmin", "Mention group admins"],
    ["promote", "Promote a member"],
    ["demote", "Demote an admin"],
    ["kick", "Remove a member"],
    ["del", "Delete a message"],
    ["warn", "Warn a member"],
    ["add", "Add a member"],
    ["leave", "Leave the group"],
    ["open", "Open group chat"],
    ["close", "Close group chat"]
  ],

  system: [
    ["menu", "Show this menu"],
    ["help", "Show command help"],
    ["ping", "Check Voltage response"],
    ["about", "About Voltage"],
    ["owner", "Get owner contact"],
    ["memory", "Show memory status"],
    ["clear", "Clear chat memory"],
    ["private", "Private mode"],
    ["public", "Public mode"],
    ["status", "Show system status"]
  ]
};

function getCommandCount() {
  return (
    commands.group.length +
    commands.system.length
  );
}

function buildMenu() {
  const groupCommands =
    commands.group
      .map(
        ([command, description]) =>
          `┋ ⬡ ${command} — ${description}`
      )
      .join("\n");

  const systemCommands =
    commands.system
      .map(
        ([command, description]) =>
          `┋ ⬡ ${command} — ${description}`
      )
      .join("\n");

  return `╭┈───〔 ${String(
    config.name || "Voltage"
  ).toUpperCase()} ASSISTANT 〕┈───⊷
├✦ Owner: Thereal_VoltageLord
├✦ Commands: ${getCommandCount()}
├✦ Runtime: Node.js
├✦ Prefix: ${
    config.prefix || "."
  }
├✦ Mode: ${
    config.mode || "private"
  }
├✦ Version: ${
    config.version || "1.0.0"
  }
╰──────────────────────────────⊷

『 GROUP 』
╭──────────────────────────────⊷
${groupCommands}
╰──────────────────────────────⊷

『 SYSTEM 』
╭──────────────────────────────⊷
${systemCommands}
╰──────────────────────────────⊷

> ©️ Powered by Thereal_VoltageLord`;
}

module.exports = {
  commands,
  getCommandCount,
  buildMenu
};
