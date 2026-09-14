const { downloadMediaMessage } = require('@whiskeysockets/baileys');

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
      (
        participant?.jid &&
        !participant.jid.endsWith('@lid')
          ? participant.jid
          : null
      );

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
  if (!Array.isArray(global.dev)) {
    return false;
  }

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

function getContextInfo(message = {}) {
  return (
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    message.audioMessage?.contextInfo ||
    message.stickerMessage?.contextInfo ||
    null
  );
}

function getMessageType(message = {}) {
  return Object.keys(message)[0] || '';
}

function getMediaInfo(message = {}, type = '') {
  const mediaTypes = [
    'imageMessage',
    'videoMessage',
    'documentMessage',
    'audioMessage',
    'stickerMessage'
  ];

  const isMedia = mediaTypes.includes(type);

  return {
    isMedia,
    mediaType: type
      ? type.replace('Message', '').toLowerCase()
      : '',
    mimetype: message?.[type]?.mimetype || null
  };
}

function participantMatches(participant, number) {
  if (!participant || !number) {
    return false;
  }

  const idNumber = getNumberFromJid(
    normalizeJid(
      participant.id ||
      participant.jid ||
      ''
    )
  );

  if (idNumber === number) {
    return true;
  }

  const phoneNumber = participant.phoneNumber
    ? getNumberFromJid(
        normalizeJid(participant.phoneNumber)
      )
    : '';

  return phoneNumber === number;
}

function getParticipant(participants, number) {
  return participants.find(
    participant => participantMatches(participant, number)
  ) || null;
}

function extractMentions(message = {}) {
  const contextInfo = getContextInfo(message);

  const mentions = Array.isArray(contextInfo?.mentionedJid)
    ? contextInfo.mentionedJid.map(normalizeJid)
    : [];

  return mentions;
}

function extractQuoted(sock, from, message) {
  const contextInfo = getContextInfo(message);

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

  const quotedBody =
    quotedMessage.conversation ||
    quotedMessage.extendedTextMessage?.text ||
    quotedMessage.imageMessage?.caption ||
    quotedMessage.videoMessage?.caption ||
    quotedMessage.documentMessage?.caption ||
    '';

  const media = getMediaInfo(
    quotedMessage,
    quotedType
  );

  return {
    key: quotedKey,
    message: quotedMessage,
    type: quotedType,
    body: quotedBody,
    text: quotedBody,

    isMedia: media.isMedia,
    mediaType: media.mediaType,
    mimetype: media.mimetype,

    sender:
      contextInfo.participant ||
      from,

    senderNumber: getNumberFromJid(
      contextInfo.participant ||
      from
    ),

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
  const from = msg.key?.remoteJid || '';

  const isGroup = from.endsWith('@g.us');

  const sender = msg.key?.fromMe
    ? (
        sock.user?.id ||
        sock.user?.lid ||
        ''
      )
    : (
        isGroup
          ? msg.key?.participant || ''
          : from
      );

  const senderNormalized = normalizeJid(sender);

  const senderResolved = resolveJid(sender);

  const senderNumber = getNumberFromJid(
    senderResolved
  );

  const type = getMessageType(
    msg.message || {}
  );

  const body = extractBody(
    msg.message || {}
  );

  const media = getMediaInfo(
    msg.message || {},
    type
  );

  const mentions = extractMentions(
    msg.message || {}
  );

  let groupMetadata = null;

  if (isGroup) {
    groupMetadata = await sock
      .groupMetadata(from)
      .catch(() => null);
  }

  const participants = Array.isArray(
    groupMetadata?.participants
  )
    ? groupMetadata.participants
    : [];

  if (participants.length) {
    learnLidMap(participants);
  }

  const participantData = getParticipant(
    participants,
    senderNumber
  );

  const botJid = normalizeJid(
    sock.user?.id ||
    sock.user?.lid ||
    ''
  );

  const botResolved = resolveJid(botJid);

  const botNumber = getNumberFromJid(
    botResolved
  );

  const botData = getParticipant(
    participants,
    botNumber
  );

  const groupOwner =
    normalizeJid(
      groupMetadata?.owner ||
      groupMetadata?.subjectOwner ||
      ''
    );

  const isOwner = checkOwner(
    sender,
    sock.user
  );

  const isDev = checkDev(sender);

  const isAdmin = isGroup
    ? !!participantData?.admin
    : false;

  const isBotAdmin = isGroup
    ? !!botData?.admin
    : false;

  const participantJid = normalizeJid(
    participantData?.id ||
    participantData?.jid ||
    ''
  );

  const isGroupOwner = isGroup
    ? (
        senderNormalized === groupOwner ||
        participantJid === groupOwner ||
        getNumberFromJid(senderResolved) ===
          getNumberFromJid(groupOwner)
      )
    : false;

  const quoted = extractQuoted(
    sock,
    from,
    msg.message || {}
  );

  const groupInfo = isGroup
    ? {
        id: from,
        name: groupMetadata?.subject || '',
        description: groupMetadata?.desc || '',
        owner: groupOwner,
        memberCount:
          groupMetadata?.participants?.length || 0,
        admins: participants
          .filter(p => !!p.admin)
          .map(p => ({
            jid: normalizeJid(
              p.id ||
              p.jid ||
              ''
            ),
            number: getNumberFromJid(
              resolveJid(
                p.id ||
                p.jid ||
                ''
              )
            ),
            role: p.admin
          }))
      }
    : null;

  const userInfo = {
    jid: senderResolved,
    number: senderNumber,
    name:
      msg.pushName ||
      senderNumber ||
      'Unknown',
    isOwner,
    isDev,
    isAdmin,
    isGroupOwner,
    isBot: senderNumber === botNumber
  };

  const messageObject = {
    key: msg.key,
    id: msg.key?.id,

    from,
    sender,
    senderResolved,
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
    isFromMe: !!msg.key?.fromMe,

    groupMetadata,
    group: groupInfo,
    user: userInfo,

    mentions,
    mentionedJids: mentions,

    isMedia: media.isMedia,
    mediaType: media.mediaType,
    mimetype: media.mimetype,

    quoted,

    isOwner,
    isDev,
    isAdmin,
    isBotAdmin,
    isGroupOwner,

    isButtonResponse:
      !!msg.message?.interactiveResponseMessage,

    buttonId:
      msg.message?.interactiveResponseMessage?.buttonId ||
      null,

    timestamp:
      msg.messageTimestamp ||
      Math.floor(Date.now() / 1000),

    raw: msg,

    reply: async (
      content,
      options = {}
    ) => {
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
      } else if (
        content &&
        typeof content === 'object'
      ) {
        payload = content;
      } else {
        payload = {
          text: String(content),
          ...options
        };
      }

      return sock.sendMessage(
        from,
        payload,
        { quoted: msg }
      );
    },

    send: async (
      content,
      options = {}
    ) => {
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

    forward: async (
      jid,
      force = false
    ) => {
      return sock.sendMessage(
        jid,
        {
          forward: msg,
          force
        }
      );
    },

    download: async () => {
      if (media.isMedia) {
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

module.exports.normalizeJid =
  normalizeJid;

module.exports.getNumberFromJid =
  getNumberFromJid;

module.exports.checkOwner =
  checkOwner;

module.exports.checkDev =
  checkDev;

module.exports.resolveJid =
  resolveJid;

module.exports.learnLidMap =
  learnLidMap;

module.exports.extractBody =
  extractBody;

module.exports.extractMentions =
  extractMentions;
