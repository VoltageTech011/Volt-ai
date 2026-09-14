const {
  downloadMediaMessage
} = require('@whiskeysockets/baileys');

function normalizeJid(jid = '') {
  return String(jid).replace(/:\d+(?=@)/, '');
}

function getNumberFromJid(jid = '') {
  return normalizeJid(jid).split('@')[0];
}

global.lidMap = global.lidMap instanceof Map
  ? global.lidMap
  : new Map();

function learnLidMap(participants = []) {
  for (const participant of participants) {
    const lid =
      participant?.id?.endsWith?.('@lid')
        ? participant.id
        : participant?.lid || null;

    const phone =
      participant?.phoneNumber ||
      (participant?.jid && !participant.jid.endsWith('@lid')
        ? participant.jid
        : null);

    if (lid && phone) {
      global.lidMap.set(
        getNumberFromJid(lid),
        getNumberFromJid(phone)
      );
    }
  }
}

function resolveJid(jid = '') {
  const normalized = normalizeJid(jid);

  if (!normalized.endsWith('@lid')) {
    return normalized;
  }

  const number = getNumberFromJid(normalized);
  const resolved = global.lidMap.get(number);

  return resolved
    ? `${resolved}@s.whatsapp.net`
    : normalized;
}

function checkOwner(sender = '', sockUser = {}) {
  const senderJid = normalizeJid(sender);
  const resolvedSender = resolveJid(sender);

  const senderNumber = getNumberFromJid(senderJid);
  const resolvedNumber = getNumberFromJid(resolvedSender);

  const ownerNumber = String(global.OWNER_NUMBER || '')
    .replace(/\D/g, '');

  if (!ownerNumber) return false;

  const botIds = [
    normalizeJid(sockUser?.id),
    normalizeJid(sockUser?.lid)
  ].filter(Boolean);

  return (
    senderNumber === ownerNumber ||
    resolvedNumber === ownerNumber ||
    botIds.includes(senderJid)
  );
}

function checkDev(sender = '') {
  if (!Array.isArray(global.dev)) return false;

  const normalized = normalizeJid(sender);
  const resolved = resolveJid(sender);

  return global.dev.some(dev => {
    const devNumber = getNumberFromJid(dev);

    return (
      normalizeJid(dev) === normalized ||
      devNumber === getNumberFromJid(resolved)
    );
  });
}

function extractBody(message = {}) {
  if (message.conversation) {
    return message.conversation;
  }

  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }

  if (message.imageMessage?.caption) {
    return message.imageMessage.caption;
  }

  if (message.videoMessage?.caption) {
    return message.videoMessage.caption;
  }

  if (message.documentMessage?.caption) {
    return message.documentMessage.caption;
  }

  if (message.buttonsResponseMessage?.selectedButtonId) {
    return message.buttonsResponseMessage.selectedButtonId;
  }

  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return message.listResponseMessage.singleSelectReply.selectedRowId;
  }

  if (message.templateButtonReplyMessage?.selectedId) {
    return message.templateButtonReplyMessage.selectedId;
  }

  if (message.interactiveResponseMessage) {
    return (
      message.interactiveResponseMessage.buttonId ||
      message.interactiveResponseMessage.body?.text ||
      ''
    );
  }

  return '';
}

function getMessageType(message = {}) {
  return Object.keys(message)[0] || '';
}

function getQuotedMessage(sock, msg, from) {
  const message = msg.message || {};

  const contextInfo =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo;

  if (!contextInfo?.quotedMessage) {
    return null;
  }

  const quotedMessage = contextInfo.quotedMessage;
  const quotedType = getMessageType(quotedMessage);

  const quotedKey = {
    remoteJid: from,
    id: contextInfo.stanzaId,
    participant: contextInfo.participant || from
  };

  return {
    key: quotedKey,

    message: quotedMessage,

    type: quotedType,

    body:
      quotedMessage.conversation ||
      quotedMessage.extendedTextMessage?.text ||
      quotedMessage[quotedType]?.caption ||
      '',

    isMedia: [
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'documentMessage',
      'stickerMessage'
    ].includes(quotedType),

    mediaType: quotedType
      ? quotedType.replace('Message', '').toLowerCase()
      : '',

    mimetype:
      quotedMessage[quotedType]?.mimetype || null,

    download: async () => {
      return downloadMediaMessage(
        {
          key: quotedKey,
          message: quotedMessage
        },
        'buffer',
        {},
        sock
      );
    }
  };
}

async function serializeMessage(sock, msg) {
  const message = msg.message || {};
  const from = msg.key?.remoteJid || '';

  const isGroup = from.endsWith('@g.us');

  const sender = msg.key?.fromMe
    ? sock.user?.id || sock.user?.lid || ''
    : isGroup
      ? msg.key?.participant || ''
      : from;

  const senderNormalized = normalizeJid(sender);
  const senderNumber = getNumberFromJid(sender);

  const pushName =
    msg.pushName ||
    (senderNumber ? senderNumber : 'Unknown');

  const type = getMessageType(message);

  const body = extractBody(message);

  const mediaTypes = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'documentMessage',
    'stickerMessage'
  ];

  const isMedia = mediaTypes.includes(type);

  const mediaType = type
    ? type.replace('Message', '').toLowerCase()
    : '';

  const mimetype =
    message[type]?.mimetype || null;

  let groupMetadata = null;

  if (isGroup) {
    try {
      groupMetadata = await sock.groupMetadata(from);
    } catch (_) {}
  }

  const participants =
    Array.isArray(groupMetadata?.participants)
      ? groupMetadata.participants
      : [];

  if (participants.length) {
    learnLidMap(participants);
  }

  const resolvedSender = resolveJid(sender);
  const resolvedSenderNumber =
    getNumberFromJid(resolvedSender);

  const participant = participants.find(p => {
    const id = getNumberFromJid(
      normalizeJid(p?.id || p?.jid || '')
    );

    const phone = p?.phoneNumber
      ? getNumberFromJid(
          normalizeJid(p.phoneNumber)
        )
      : '';

    return (
      id === senderNumber ||
      id === resolvedSenderNumber ||
      phone === senderNumber ||
      phone === resolvedSenderNumber
    );
  });

  const botJid = normalizeJid(
    sock.user?.id ||
    sock.user?.lid ||
    ''
  );

  const botNumber = getNumberFromJid(botJid);

  const botParticipant = participants.find(p => {
    const id = getNumberFromJid(
      normalizeJid(p?.id || p?.jid || '')
    );

    const phone = p?.phoneNumber
      ? getNumberFromJid(
          normalizeJid(p.phoneNumber)
        )
      : '';

    return (
      id === botNumber ||
      phone === botNumber
    );
  });

  const groupOwner =
    normalizeJid(
      groupMetadata?.owner ||
      groupMetadata?.subjectOwner ||
      ''
    );

  const isOwner =
    checkOwner(sender, sock.user);

  const isDev =
    checkDev(sender);

  const isAdmin =
    isGroup
      ? !!participant?.admin
      : false;

  const isBotAdmin =
    isGroup
      ? !!botParticipant?.admin
      : false;

  const isGroupOwner =
    isGroup
      ? normalizeJid(participant?.id || '') === groupOwner ||
        normalizeJid(participant?.jid || '') === groupOwner
      : false;

  const mentionedJid =
    message.extendedTextMessage?.contextInfo?.mentionedJid ||
    message.imageMessage?.contextInfo?.mentionedJid ||
    message.videoMessage?.contextInfo?.mentionedJid ||
    [];

  const quoted =
    getQuotedMessage(sock, msg, from);

  const reply = async (content, options = {}) => {
    let payload;

    if (typeof content === 'string') {
      payload = {
        text: content,
        ...options
      };
    } else if (Buffer.isBuffer(content)) {
      payload = {
        image: content,
        ...options
      };
    } else if (content && typeof content === 'object') {
      payload = content;
    } else {
      payload = {
        text: String(content)
      };
    }

    return sock.sendMessage(
      from,
      payload,
      { quoted: msg }
    );
  };

  const send = async (content, options = {}) => {
    const payload =
      typeof content === 'string'
        ? {
            text: content,
            ...options
          }
        : content;

    return sock.sendMessage(
      from,
      payload,
      { quoted: msg }
    );
  };

  const react = async emoji => {
    return sock.sendMessage(from, {
      react: {
        text: emoji,
        key: msg.key
      }
    });
  };

  const download = async () => {
    if (isMedia) {
      return downloadMediaMessage(
        msg,
        'buffer',
        {},
        sock
      );
    }

    if (quoted?.isMedia) {
      return quoted.download();
    }

    return null;
  };

  return {
    key: msg.key,
    id: msg.key?.id,

    from,
    sender,
    senderNumber,
    resolvedSender,
    resolvedSenderNumber,

    pushName,

    isGroup,
    groupMetadata,
    participant,

    body,
    text: body,

    type,
    mtype: type,

    isMedia,
    mediaType,
    mimetype,

    quoted,
    mentionedJid,

    isOwner,
    isDev,
    isAdmin,
    isBotAdmin,
    isGroupOwner,

    isFromMe: !!msg.key?.fromMe,

    isMentioned: mentionedJid.some(
      jid =>
        normalizeJid(jid) ===
        normalizeJid(sock.user?.id)
    ),

    reply,
    send,
    react,
    download,

    raw: msg
  };
}

module.exports = serializeMessage;

module.exports.normalizeJid = normalizeJid;
module.exports.getNumberFromJid = getNumberFromJid;
module.exports.checkOwner = checkOwner;
module.exports.checkDev = checkDev;
module.exports.resolveJid = resolveJid;
module.exports.learnLidMap = learnLidMap;
