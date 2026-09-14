const { downloadMediaMessage } = require('@whiskeysockets/baileys');

function normalizeJid(jid = '') {
  return String(jid).replace(/:\d+(?=@)/, '');
}

function getNumberFromJid(jid = '') {
  return normalizeJid(jid).split('@')[0];
}

global.lidMap = global.lidMap instanceof Map ? global.lidMap : new Map();

function learnLidMap(participants = []) {
  for (const p of participants) {
    const lid = p?.id?.endsWith?.('@lid')
      ? p.id
      : p?.lid || null;

    const phone =
      p?.phoneNumber ||
      (p?.jid && !p.jid.endsWith('@lid') ? p.jid : null);

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
  const owners = Array.isArray(global.owners)
    ? global.owners.map(normalizeJid)
    : [];

  const senderRaw = normalizeJid(sender);
  const senderResolved = resolveJid(sender);

  const senderNumber = getNumberFromJid(senderRaw);
  const resolvedNumber = getNumberFromJid(senderResolved);

  const ownerNumbers = owners.map(getNumberFromJid);

  const botIds = [
    normalizeJid(sockUser?.id),
    normalizeJid(sockUser?.lid)
  ].filter(Boolean);

  return (
    owners.includes(senderRaw) ||
    owners.includes(senderResolved) ||
    ownerNumbers.includes(senderNumber) ||
    ownerNumbers.includes(resolvedNumber) ||
    botIds.includes(senderRaw)
  );
}

function checkDev(sender = '') {
  if (!Array.isArray(global.dev)) return false;

  const user = normalizeJid(sender);
  const resolved = resolveJid(sender);

  const devIds = global.dev.map(normalizeJid);
  const devNumbers = devIds.map(getNumberFromJid);

  return (
    devIds.includes(user) ||
    devNumbers.includes(getNumberFromJid(resolved))
  );
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

async function serializeMessage(sock, msg) {
  const from = msg.key?.remoteJid || '';
  const isGroup = from.endsWith('@g.us');

  const sender = msg.key?.fromMe
    ? (sock.user?.id || sock.user?.lid || '')
    : (
        isGroup
          ? msg.key?.participant || ''
          : from
      );

  const type = Object.keys(msg.message || {})[0] || '';
  const body = extractBody(msg.message || {});

  const senderNumber = getNumberFromJid(sender);

  let groupMetadata = null;

  if (isGroup) {
    groupMetadata = await sock
      .groupMetadata(from)
      .catch(() => null);
  }

  const participants = Array.isArray(groupMetadata?.participants)
    ? groupMetadata.participants
    : [];

  if (participants.length) {
    learnLidMap(participants);
  }

  const participantData = participants.find(p => {
    const idNumber = getNumberFromJid(
      normalizeJid(p?.id || p?.jid || '')
    );

    const phoneNumber = p?.phoneNumber
      ? getNumberFromJid(normalizeJid(p.phoneNumber))
      : '';

    return (
      idNumber === senderNumber ||
      phoneNumber === senderNumber
    );
  });

  const botNumber = getNumberFromJid(
    sock.user?.id || sock.user?.lid || ''
  );

  const botData = participants.find(p => {
    const idNumber = getNumberFromJid(
      normalizeJid(p?.id || p?.jid || '')
    );

    const phoneNumber = p?.phoneNumber
      ? getNumberFromJid(normalizeJid(p.phoneNumber))
      : '';

    return (
      idNumber === botNumber ||
      phoneNumber === botNumber
    );
  });

  const groupOwner =
    normalizeJid(groupMetadata?.owner || '') ||
    normalizeJid(groupMetadata?.subjectOwner || '');

  const senderNormalized = normalizeJid(sender);

  const isOwner = checkOwner(sender, sock.user);
  const isDev = checkDev(sender);

  const isAdmin = isGroup
    ? !!participantData?.admin
    : false;

  const isBotAdmin = isGroup
    ? !!botData?.admin
    : false;

  const isGroupOwner = isGroup
    ? (
        senderNormalized === groupOwner ||
        normalizeJid(
          participantData?.id ||
          participantData?.jid ||
          ''
        ) === groupOwner
      )
    : false;

  const isMedia = [
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'audioMessage',
    'stickerMessage'
  ].includes(type);

  const mediaType = type
    ? type.replace('Message', '').toLowerCase()
    : '';

  const mimetype =
    msg.message?.[type]?.mimetype || null;

  let quoted = null;

  const ctxInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.documentMessage?.contextInfo;

  if (ctxInfo?.quotedMessage) {
    const quotedMessage = ctxInfo.quotedMessage;
    const quotedType =
      Object.keys(quotedMessage)[0] || '';

    const quotedKey = {
      remoteJid: from,
      id: ctxInfo.stanzaId,
      participant: ctxInfo.participant || from
    };

    quoted = {
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
        'documentMessage',
        'audioMessage',
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

  const messageObject = {
    key: msg.key,
    id: msg.key?.id,

    from,
    sender,
    senderNumber,

    pushName:
      msg.pushName ||
      senderNumber ||
      'Unknown',

    body,
    text: body,

    type,
    mtype: type,

    isGroup,

    groupMetadata,

    isMedia,
    mediaType,
    mimetype,

    quoted,

    isOwner,
    isDev,
    isAdmin,
    isBotAdmin,
    isGroupOwner,

    isFromMe: !!msg.key?.fromMe,

    isButtonResponse:
      !!msg.message?.interactiveResponseMessage,

    buttonId:
      msg.message?.interactiveResponseMessage?.buttonId ||
      null,

    reply: async (content, options = {}) => {
      const payload =
        typeof content === 'string'
          ? { text: content, ...options }
          : Buffer.isBuffer(content)
            ? { image: content, ...options }
            : typeof content === 'object'
              ? content
              : { text: String(content), ...options };

      return sock.sendMessage(
        from,
        payload,
        { quoted: msg }
      );
    },

    send: async (content, options = {}) => {
      const payload =
        typeof content === 'string'
          ? { text: content, ...options }
          : content;

      return sock.sendMessage(
        from,
        payload,
        { quoted: msg }
      );
    },

    react: async emoji => {
      return sock.sendMessage(
        from,
        {
          react: {
            text: emoji,
            key: msg.key
          }
        }
      );
    },

    forward: async (jid, force = false) => {
      return sock.sendMessage(
        jid,
        {
          forward: msg,
          force
        }
      );
    },

    download: async () => {
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
    }
  };

  return messageObject;
}

module.exports = serializeMessage;
module.exports.normalizeJid = normalizeJid;
module.exports.getNumberFromJid = getNumberFromJid;
module.exports.checkOwner = checkOwner;
module.exports.checkDev = checkDev;
module.exports.resolveJid = resolveJid;
module.exports.learnLidMap = learnLidMap;
