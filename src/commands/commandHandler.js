const config = require("../config");
const { buildMenu } = require("./menu");
const memory = require("../memory/store");

const OWNER_NUMBER = String(
  process.env.OWNER_NUMBER || "2349110231750"
).replace(/\D/g, "");

const PREFIX =
  process.env.VOLTAGE_PREFIX ||
  config.prefix ||
  ".";

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/\D/g, "");
}

function isGroup(message) {
  return String(
    message?.key?.remoteJid || ""
  ).endsWith("@g.us");
}

function getSender(message) {
  const remoteJid =
    message?.key?.remoteJid || "";

  const participant =
    message?.key?.participant;

  return normalizePhone(
    participant || remoteJid
  );
}

function isOwner(message) {
  return (
    getSender(message) ===
    OWNER_NUMBER
  );
}

function getText(message) {
  return (
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption ||
    message?.message?.audioMessage?.caption ||
    message?.message?.documentMessage?.caption ||
    ""
  ).trim();
}

function getContextInfo(message) {
  return (
    message?.message?.extendedTextMessage
      ?.contextInfo ||
    message?.message?.imageMessage
      ?.contextInfo ||
    message?.message?.videoMessage
      ?.contextInfo ||
    message?.message?.audioMessage
      ?.contextInfo ||
    message?.message?.documentMessage
      ?.contextInfo ||
    null
  );
}

function getCommand(text) {
  if (!text) {
    return null;
  }

  const normalized =
    text.trim();

  if (
    normalized.toLowerCase() ===
    "menu"
  ) {
    return {
      name: "menu",
      args: [],
      rawArgs: ""
    };
  }

  if (
    !normalized.startsWith(PREFIX)
  ) {
    return null;
  }

  const body =
    normalized
      .slice(PREFIX.length)
      .trim();

  if (!body) {
    return null;
  }

  const parts =
    body.split(/\s+/);

  const name =
    parts.shift().toLowerCase();

  return {
    name,
    args: parts,
    rawArgs: parts.join(" ")
  };
}

async function getGroupMetadata(
  socket,
  jid
) {
  try {
    return await socket.groupMetadata(
      jid
    );
  } catch (error) {
    console.error(
      "Group metadata error:",
      error
    );

    return null;
  }
}

async function isGroupAdmin(
  socket,
  message
) {
  if (!isGroup(message)) {
    return false;
  }

  const jid =
    message.key.remoteJid;

  const metadata =
    await getGroupMetadata(
      socket,
      jid
    );

  if (!metadata) {
    return false;
  }

  const sender =
    getSender(message);

  return metadata.participants.some(
    (participant) =>
      normalizePhone(
        participant.id
      ) === sender &&
      Boolean(participant.admin)
  );
}

async function isBotAdmin(
  socket,
  message
) {
  if (!isGroup(message)) {
    return false;
  }

  const jid =
    message.key.remoteJid;

  const metadata =
    await getGroupMetadata(
      socket,
      jid
    );

  if (!metadata) {
    return false;
  }

  const botNumber =
    normalizePhone(
      socket.user?.id
    );

  return metadata.participants.some(
    (participant) =>
      normalizePhone(
        participant.id
      ) === botNumber &&
      Boolean(participant.admin)
  );
}

function getTargetFromReply(
  message
) {
  const context =
    getContextInfo(message);

  return (
    context?.participant ||
    null
  );
}

function getTargetJid(
  message,
  args
) {
  const quoted =
    getTargetFromReply(message);

  if (quoted) {
    return quoted;
  }

  const number =
    normalizePhone(args?.[0]);

  if (!number) {
    return null;
  }

  return `${number}@s.whatsapp.net`;
}

async function sendOwnerContact(
  socket,
  jid
) {
  await socket.sendMessage(
    jid,
    {
      contacts: {
        displayName:
          "Thereal_VoltageLord",

        contacts: [
          {
            vcard:
              "BEGIN:VCARD\n" +
              "VERSION:3.0\n" +
              "FN:Thereal_VoltageLord\n" +
              "ORG:Voltage\n" +
              "TEL;type=CELL;type=VOICE;waid=2349110231750:+2349110231750\n" +
              "END:VCARD"
          }
        ]
      }
    }
  );
}

async function handleTagAll(
  socket,
  message,
  rawArgs
) {
  const jid =
    message.key.remoteJid;

  const metadata =
    await getGroupMetadata(
      socket,
      jid
    );

  if (!metadata) {
    throw new Error(
      "Unable to read group members."
    );
  }

  const participants =
    metadata.participants || [];

  const mentions =
    participants.map(
      (participant) =>
        participant.id
    );

  await socket.sendMessage(
    jid,
    {
      text:
        rawArgs ||
        "⚡ Voltage calling everyone.",
      mentions
    }
  );
}

async function handleTagAdmins(
  socket,
  message,
  rawArgs
) {
  const jid =
    message.key.remoteJid;

  const metadata =
    await getGroupMetadata(
      socket,
      jid
    );

  if (!metadata) {
    throw new Error(
      "Unable to read group information."
    );
  }

  const admins =
    metadata.participants
      .filter(
        (participant) =>
          Boolean(participant.admin)
      )
      .map(
        (participant) =>
          participant.id
      );

  if (!admins.length) {
    await socket.sendMessage(
      jid,
      {
        text:
          "No group admins found."
      }
    );

    return;
  }

  await socket.sendMessage(
    jid,
    {
      text:
        rawArgs ||
        "⚡ Admin attention required.",
      mentions: admins
    }
  );
}

async function handlePromote(
  socket,
  message,
  args
) {
  const target =
    getTargetJid(
      message,
      args
    );

  if (!target) {
    await socket.sendMessage(
      message.key.remoteJid,
      {
        text:
          `Reply to a member or use ${PREFIX}promote 234xxxxxxxxxx`
      }
    );

    return;
  }

  await socket.groupParticipantsUpdate(
    message.key.remoteJid,
    [target],
    "promote"
  );

  await socket.sendMessage(
    message.key.remoteJid,
    {
      text:
        "⚡ Member promoted."
    }
  );
}

async function handleDemote(
  socket,
  message,
  args
) {
  const target =
    getTargetJid(
      message,
      args
    );

  if (!target) {
    await socket.sendMessage(
      message.key.remoteJid,
      {
        text:
          `Reply to a member or use ${PREFIX}demote 234xxxxxxxxxx`
      }
    );

    return;
  }

  await socket.groupParticipantsUpdate(
    message.key.remoteJid,
    [target],
    "demote"
  );

  await socket.sendMessage(
    message.key.remoteJid,
    {
      text:
        "⚡ Member demoted."
    }
  );
}

async function handleKick(
  socket,
  message,
  args
) {
  const target =
    getTargetJid(
      message,
      args
    );

  if (!target) {
    await socket.sendMessage(
      message.key.remoteJid,
      {
        text:
          `Reply to a member or use ${PREFIX}kick 234xxxxxxxxxx`
      }
    );

    return;
  }

  await socket.groupParticipantsUpdate(
    message.key.remoteJid,
    [target],
    "remove"
  );

  await socket.sendMessage(
    message.key.remoteJid,
    {
      text:
        "⚡ Member removed."
    }
  );
}

async function handleAdd(
  socket,
  message,
  args
) {
  const number =
    normalizePhone(args?.[0]);

  if (!number) {
    await socket.sendMessage(
      message.key.remoteJid,
      {
        text:
          `Use ${PREFIX}add 234xxxxxxxxxx`
      }
    );

    return;
  }

  const target =
    `${number}@s.whatsapp.net`;

  await socket.groupParticipantsUpdate(
    message.key.remoteJid,
    [target],
    "add"
  );

  await socket.sendMessage(
    message.key.remoteJid,
    {
      text:
        `⚡ Add request sent for ${number}.`
    }
  );
}

async function handleDelete(
  socket,
  message
) {
  const jid =
    message.key.remoteJid;

  const context =
    getContextInfo(message);

  const stanzaId =
    context?.stanzaId;

  if (!stanzaId) {
    await socket.sendMessage(
      jid,
      {
        text:
          "Reply to the message you want me to delete."
      }
    );

    return;
  }

  await socket.sendMessage(
    jid,
    {
      delete: {
        remoteJid: jid,
        fromMe: false,
        id: stanzaId,
        participant:
          context.participant
      }
    }
  );
}

async function handleWarn(
  socket,
  message,
  args
) {
  const target =
    getTargetJid(
      message,
      args
    );

  if (!target) {
    await socket.sendMessage(
      message.key.remoteJid,
      {
        text:
          `Reply to a member or use ${PREFIX}warn 234xxxxxxxxxx`
      }
    );

    return;
  }

  const number =
    normalizePhone(target);

  await socket.sendMessage(
    message.key.remoteJid,
    {
      text:
        `⚠️ Warning issued to @${number}`,
      mentions: [target]
    }
  );
}

async function handleStatus(
  socket,
  jid
) {
  const connected =
    Boolean(socket.user);

  await socket.sendMessage(
    jid,
    {
      text:
        `⚡ VOLTAGE STATUS\n\n` +
        `Status: ${
          connected
            ? "ONLINE"
            : "OFFLINE"
        }\n` +
        `Platform: WhatsApp\n` +
        `Runtime: Node.js\n` +
        `Mode: ${
          config.mode ||
          "private"
        }\n` +
        `Version: ${
          config.version ||
          "1.0.0"
        }\n` +
        `Bot: ${OWNER_NUMBER}`
    }
  );
}

async function handleCommand(
  socket,
  message
) {
  const text =
    getText(message);

  if (!text) {
    return false;
  }

  const command =
    getCommand(text);

  if (!command) {
    return false;
  }

  const {
    name,
    args,
    rawArgs
  } = command;

  const jid =
    message.key.remoteJid;

  const group =
    isGroup(message);

  const owner =
    isOwner(message);

  const groupCommands = [
    "tagall",
    "tagadmin",
    "promote",
    "demote",
    "kick",
    "del",
    "warn",
    "add",
    "leave",
    "open",
    "close"
  ];

  if (
    groupCommands.includes(name) &&
    !group
  ) {
    await socket.sendMessage(
      jid,
      {
        text:
          "That command only works in groups."
      }
    );

    return true;
  }

  switch (name) {
    case "menu":
    case "help": {
      await socket.sendMessage(
        jid,
        {
          text: buildMenu()
        }
      );

      return true;
    }

    case "ping": {
      const start =
        Date.now();

      await socket.sendMessage(
        jid,
        {
          text:
            "⚡ Voltage is online."
        }
      );

      const latency =
        Date.now() - start;

      await socket.sendMessage(
        jid,
        {
          text:
            `PONG: ${latency}ms`
        }
      );

      return true;
    }

    case "about": {
      await socket.sendMessage(
        jid,
        {
          text:
            `⚡ VOLTAGE AI\n\n` +
            `A personal multi-capability AI system built by Voltage Lord.\n\n` +
            `Owner: Thereal_VoltageLord\n` +
            `Platform: WhatsApp\n` +
            `Runtime: Node.js\n` +
            `Version: ${
              config.version ||
              "1.0.0"
            }`
        }
      );

      return true;
    }

    case "owner": {
      await sendOwnerContact(
        socket,
        jid
      );

      return true;
    }

    case "status": {
      await handleStatus(
        socket,
        jid
      );

      return true;
    }

    case "memory": {
    case "memory": {
  const messages =
    memory.getMessages(jid, 100);

  await socket.sendMessage(
    jid,
    {
      text:
        `🧠 VOLTAGE MEMORY\n\n` +
        `Messages stored: ${messages.length}\n` +
        `Chat: ${group ? "Group" : "Private"}\n` +
        `Status: Active`
    }
  );

  return true;
    }

    case "clear": {
  memory.clearConversation(jid);

  await socket.sendMessage(
    jid,
    {
      text:
        "🧹 Conversation memory cleared for this chat."
    }
  );

  return true;
    }

    case "private": {
      if (!owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Owner-only command."
          }
        );

        return true;
      }

      await socket.sendMessage(
        jid,
        {
          text:
            "🔒 Voltage mode set to PRIVATE."
        }
      );

      return true;
    }

    case "public": {
      if (!owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Owner-only command."
          }
        );

        return true;
      }

      await socket.sendMessage(
        jid,
        {
          text:
            "🌐 Voltage mode set to PUBLIC."
        }
      );

      return true;
    }

    case "tagall": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      const botAdmin =
        await isBotAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use this command."
          }
        );

        return true;
      }

      if (!botAdmin) {
        await socket.sendMessage(
          jid,
          {
            text:
              "I need to be a group admin to tag everyone."
          }
        );

        return true;
      }

      await handleTagAll(
        socket,
        message,
        rawArgs
      );

      return true;
    }

    case "tagadmin": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use this command."
          }
        );

        return true;
      }

      await handleTagAdmins(
        socket,
        message,
        rawArgs
      );

      return true;
    }

    case "promote":
    case "demote": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      const botAdmin =
        await isBotAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use this command."
          }
        );

        return true;
      }

      if (!botAdmin) {
        await socket.sendMessage(
          jid,
          {
            text:
              "I need to be a group admin for that."
          }
        );

        return true;
      }

      if (name === "promote") {
        await handlePromote(
          socket,
          message,
          args
        );
      } else {
        await handleDemote(
          socket,
          message,
          args
        );
      }

      return true;
    }

    case "kick": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      const botAdmin =
        await isBotAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use this command."
          }
        );

        return true;
      }

      if (!botAdmin) {
        await socket.sendMessage(
          jid,
          {
            text:
              "I need to be a group admin to kick members."
          }
        );

        return true;
      }

      await handleKick(
        socket,
        message,
        args
      );

      return true;
    }

    case "add": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      const botAdmin =
        await isBotAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use this command."
          }
        );

        return true;
      }

      if (!botAdmin) {
        await socket.sendMessage(
          jid,
          {
            text:
              "I need to be a group admin to add members."
          }
        );

        return true;
      }

      await handleAdd(
        socket,
        message,
        args
      );

      return true;
    }

    case "del": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can delete messages."
          }
        );

        return true;
      }

      await handleDelete(
        socket,
        message
      );

      return true;
    }

    case "warn": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can use warn."
          }
        );

        return true;
      }

      await handleWarn(
        socket,
        message,
        args
      );

      return true;
    }

    case "leave": {
      if (!owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only Voltage's owner can make it leave a group."
          }
        );

        return true;
      }

      await socket.sendMessage(
        jid,
        {
          text:
            "⚡ Voltage is leaving this group."
        }
      );

      await socket.groupLeave(
        jid
      );

      return true;
    }

    case "open":
    case "close": {
      const admin =
        await isGroupAdmin(
          socket,
          message
        );

      const botAdmin =
        await isBotAdmin(
          socket,
          message
        );

      if (!admin && !owner) {
        await socket.sendMessage(
          jid,
          {
            text:
              "Only group admins can change group settings."
          }
        );

        return true;
      }

      if (!botAdmin) {
        await socket.sendMessage(
          jid,
          {
            text:
              "I need to be a group admin for that."
          }
        );

        return true;
      }

      await socket.groupSettingUpdate(
        jid,
        name === "open"
          ? "not_announcement"
          : "announcement"
      );

      await socket.sendMessage(
        jid,
        {
          text:
            name === "open"
              ? "🔓 Group opened."
              : "🔒 Group closed."
        }
      );

      return true;
    }

    default:
      return false;
  }
}

module.exports = {
  handleCommand,
  isOwner,
  isGroup,
  getText,
  getCommand
};
