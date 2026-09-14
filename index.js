require('./config');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  generateWAMessageContent,
  generateWAMessageFromContent,
  generateMessageID,
  prepareWAMessageMedia,
  fetchLatestWaWebVersion,
  proto,
  generateProfilePicture
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { Boom } = require('@hapi/boom');
const express = require('express');
const crypto = require('crypto');
const serializeMessage = require('./handler.js');
const { applyBrandStyleToSocket } = require('./branding');
const { toSmallCaps } = require('./lib/smallcaps');

const groupMemory = require('./lib/groupMemory');
const {
  startIntroductionScheduler
} = require('./lib/introductionScheduler');

const JimpImport = require('jimp');

const Jimp = JimpImport.read
  ? JimpImport
  : JimpImport.Jimp
    ? JimpImport.Jimp
    : JimpImport.default;

global.generateWAMessageContent = generateWAMessageContent;
global.generateWAMessageFromContent = generateWAMessageFromContent;
global.generateMessageID = generateMessageID;
global.prepareWAMessageMedia = prepareWAMessageMedia;
global.proto = proto;
global.Jimp = Jimp;
global.generateProfilePicture = generateProfilePicture;
global.downloadMediaMessage = downloadMediaMessage;

global.bannedChats = global.bannedChats || [];

global.antiDeleteStore = (() => {
  try {
    const file = path.join(
      __dirname,
      'data',
      'antiDelete.json'
    );

    if (fs.existsSync(file)) {
      return JSON.parse(
        fs.readFileSync(file, 'utf8') || '{}'
      );
    }
  } catch (_) {}

  return {};
})();

global.autoStatusView =
  global.autoStatusView || false;

global.autoStatusLike =
  global.autoStatusLike || false;

global.normalizeJid = function (jid = '') {
  return String(jid).replace(/:\d+(?=@)/, '');
};

global.getNumberFromJid = function (jid = '') {
  return global
    .normalizeJid(jid)
    .split('@')[0];
};

global.isOwner = function (sender, sockUser) {
  const { checkOwner } = require('./handler.js');
  return checkOwner(sender, sockUser);
};

const PLUGIN_FOLDER = './plugins';

const PORT =
  process.env.PORT || 3000;

const SESSIONS_DIR =
  path.join(__dirname, 'sessions');

const COOKIE_NAME = 'voltage_sid';

const COOKIE_MAX =
  7 * 24 * 60 * 60;

const PAIR_CODE =
  'VOLTAGE1';

const MAX_SESSIONS =
  parseInt(process.env.MAX_SESSIONS, 10) || 1;

const sessions = new Map();

function mkSessionDir(id) {
  const dir = path.join(
    SESSIONS_DIR,
    id
  );

  fs.mkdirSync(dir, {
    recursive: true
  });

  return dir;
}

function genId() {
  return crypto
    .randomBytes(8)
    .toString('hex');
}

function getIP(req) {
  return (
    req.headers['x-forwarded-for']
      ?.split(',')[0]
      .trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function activeSessionCount() {
  let count = 0;

  for (const [, state] of sessions) {
    if (
      state.sock &&
      state.status !== 'disconnected'
    ) {
      count++;
    }
  }

  return count;
}

const commandMap = new Map();
const hookPlugins = [];

global.commandMap = commandMap;

const pluginPath = path.join(
  __dirname,
  PLUGIN_FOLDER
);

if (fs.existsSync(pluginPath)) {
  for (
    const file of fs
      .readdirSync(pluginPath)
      .filter(f => f.endsWith('.js'))
  ) {
    try {
      const plugin = require(
        path.join(pluginPath, file)
      );

      if (!plugin?.name) continue;

      if (
        typeof plugin.execute ===
        'function'
      ) {
        commandMap.set(
          plugin.name.toLowerCase(),
          plugin
        );

        if (
          Array.isArray(plugin.aliases)
        ) {
          plugin.aliases.forEach(alias => {
            commandMap.set(
              alias.toLowerCase(),
              plugin
            );
          });
        }
      }

      if (
        typeof plugin.onMessage ===
        'function'
      ) {
        hookPlugins.push(plugin);
      }

      console.log(
        `Plugin loaded: ${plugin.name}`
      );
    } catch (error) {
      console.error(
        `Plugin error [${file}]:`,
        error.message
      );
    }
  }
}

console.log(
  `${commandMap.size} commands | ${hookPlugins.length} hooks`
);

const cfgPath = path.join(
  __dirname,
  'config.json'
);

if (fs.existsSync(cfgPath)) {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(
        cfgPath,
        'utf8'
      )
    );

    if (cfg.prefix) {
      global.BOT_PREFIX =
        cfg.prefix;
    }
  } catch (_) {}
}

function applyPlaceholders(
  template,
  {
    userId,
    groupName,
    groupDesc,
    memberCount
  }
) {
  return String(template)
    .replace(
      /\{user\}/g,
      `@${userId.split('@')[0]}`
    )
    .replace(
      /\{group\}/g,
      groupName || 'the group'
    )
    .replace(
      /\{desc\}/g,
      groupDesc || ''
    )
    .replace(
      /\{count\}/g,
      String(memberCount ?? '')
    );
}

function getGroupSettings(groupId) {
  const settingsPath =
    path.join(
      __dirname,
      'data',
      'groupSettings.json'
    );

  try {
    if (!fs.existsSync(settingsPath)) {
      return {
        welcome: false,
        goodbye: false
      };
    }

    const data = JSON.parse(
      fs.readFileSync(
        settingsPath,
        'utf8'
      )
    );

    return (
      data[groupId] || {
        welcome: false,
        goodbye: false
      }
    );
  } catch {
    return {
      welcome: false,
      goodbye: false
    };
  }
}

async function startSession(sessionId) {
  const existing =
    sessions.get(sessionId);

  if (existing?.starting) {
    return;
  }

  if (
    existing?.sock &&
    existing.status === 'connected'
  ) {
    return;
  }

  const authFolder =
    mkSessionDir(sessionId);

  const state = {
    id: sessionId,
    sock: null,
    status: 'connecting',
    qr: null,
    pairingCode: null,
    pairingCodeTime: 0,
    presenceInterval: null,
    paired: false,
    lockedIP:
      existing?.lockedIP || null,
    starting: true,
    authFolder
  };

  sessions.set(
    sessionId,
    state
  );

  console.log(
    `[${sessionId}] Starting Voltage...`
  );

  try {
    const { version } =
      await fetchLatestWaWebVersion();

    const {
      state: authState,
      saveCreds
    } =
      await useMultiFileAuthState(
        authFolder
      );

    const sock =
      makeWASocket({
        version,

        logger: pino({
          level: 'silent'
        }),

        auth: authState,

        printQRInTerminal: false,

        keepAliveIntervalMs:
          10000,

        markOnlineOnConnect:
          true,

        syncFullHistory:
          false,

        browser: [
          'Voltage',
          'Chrome',
          '1.0.0'
        ]
      });

    applyBrandStyleToSocket(sock);

    state.sock = sock;
    state.starting = false;

    sock.ev.on(
      'connection.update',
      async update => {
        const {
          connection,
          lastDisconnect,
          qr
        } = update;

        if (qr) {
          QRCode.toDataURL(
            qr,
            (error, url) => {
              if (!error) {
                state.qr = url;
              }
            }
          );

          state.status =
            'connecting';
        }

        if (
          connection === 'close'
        ) {
          state.status =
            'disconnected';

          state.qr = null;
          state.starting = false;

          if (
            state.presenceInterval
          ) {
            clearInterval(
              state.presenceInterval
            );

            state.presenceInterval =
              null;
          }

          const statusCode =
            lastDisconnect?.error
              instanceof Boom
              ? lastDisconnect.error
                  .output.statusCode
              : 0;

          const shouldReconnect =
            statusCode !==
            DisconnectReason.loggedOut;

          if (!shouldReconnect) {
            try {
              fs.rmSync(
                authFolder,
                {
                  recursive: true,
                  force: true
                }
              );
            } catch (_) {}

            state.paired = false;
            state.lockedIP = null;

            console.log(
              `[${sessionId}] Logged out`
            );
          } else {
            console.log(
              `[${sessionId}] Reconnecting...`
            );

            state.sock = null;

            setTimeout(
              () =>
                startSession(
                  sessionId
                ),
              5000
            );
          }
        }

        if (
          connection === 'open'
        ) {
          state.status =
            'connected';

          state.qr = null;
          state.paired = true;
          state.starting = false;

          startIntroductionScheduler(
            sock
          );

          state.presenceInterval =
            setInterval(() => {
              if (
                sock?.ws
                  ?.readyState === 1
              ) {
                sock.sendPresenceUpdate(
                  'available'
                );
              }
            }, 10000);

          const userJid =
            sock.user.id;

          console.log(
            `Voltage connected as ${userJid}`
          );

          try {
            await sock.sendMessage(
              userJid,
              {
                text:
                  `⚡ *VOLTAGE ONLINE*\n\n` +
                  `Version: ${global.VOLTAGE_VERSION}\n` +
                  `Prefix: ${global.BOT_PREFIX}\n` +
                  `Commands: ${commandMap.size}\n\n` +
                  `Voltage is connected and ready.`
              }
            );
          } catch (_) {}
        }

        if (
          connection ===
          'connecting'
        ) {
          state.status =
            'connecting';
        }
      }
    );

    sock.ev.on(
      'creds.update',
      saveCreds
    );

    async function notifyDeletedMessage(
      jid,
      msgId,
      deleterJidHint
    ) {
      try {
        if (!jid || !msgId) {
          return;
        }

        if (
          !global.antiDeleteStore?.[
            jid
          ]?.enabled
        ) {
          return;
        }

        const cached =
          global.msgCache?.get(
            msgId
          );

        if (!cached) return;

        const sendTo =
          global.antiDeleteStore[
            jid
          ].notifyJid || jid;

        const originalMsg =
          cached.msg;

        const isGroupChat =
          jid.endsWith('@g.us');

        const deleterJid =
          deleterJidHint ||
          originalMsg.key
            ?.participant ||
          (
            originalMsg.key
              ?.fromMe
              ? sock.user?.id
              : jid
          );

        const deleterNumber =
          deleterJid
            ? deleterJid.split('@')[0]
            : 'unknown';

        const msgType =
          Object.keys(
            originalMsg.message || {}
          )[0] || '';

        const mediaLabel =
          msgType
            ? toSmallCaps(
                msgType.replace(
                  'Message',
                  ''
                )
              )
            : '';

        const card = [
          `╭─〔 ✦ *ᴅᴇʟᴇᴛᴇᴅ ᴍᴇssᴀɢᴇ* ✦ 〕`,
          `│ ᴅᴇʟᴇᴛᴇᴅ ʙʏ: @${deleterNumber}`,
          isGroupChat
            ? `│ ᴄʜᴀᴛ: ɢʀᴏᴜᴘ`
            : `│ ᴄʜᴀᴛ: ᴅᴍ`,
          mediaLabel
            ? `│ ᴛʏᴘᴇ: ${mediaLabel}`
            : null,
          `╰──────────────`
        ]
          .filter(Boolean)
          .join('\n');

        try {
          await sock.sendMessage(
            sendTo,
            {
              text: card,
              mentions: deleterJid
                ? [deleterJid]
                : []
            }
          );

          if (
            originalMsg.message
          ) {
            await sock.copyNForward(
              sendTo,
              originalMsg,
              true
            );
          }
        } catch (_) {}
      } catch (error) {
        console.error(
          'Anti-delete:',
          error.message
        );
      }
    }

    sock.ev.on(
      'messages.upsert',
      async ({
        messages,
        type
      }) => {
        if (
          type !== 'notify' &&
          type !== 'append'
        ) {
          return;
        }

        const CHANNEL_ID =
          '120363230794474148@newsletter';

        for (
          const rawMsg of messages
        ) {
          const jid =
            rawMsg.key
              ?.remoteJid || '';

          if (
            jid === CHANNEL_ID &&
            rawMsg.key?.server_id
          ) {
            const emojis = [
              '❤️',
              '💛',
              '👍',
              '💜',
              '😮',
              '🤍',
              '💙',
              '🔥',
              '💯',
              '⚡'
            ];

            try {
              await sock.newsletterReactMessage(
                CHANNEL_ID,
                rawMsg.key.server_id
                  .toString(),
                emojis[
                  Math.floor(
                    Math.random() *
                    emojis.length
                  )
                ]
              );
            } catch (_) {}

            continue;
          }

          if (
            jid ===
            'status@broadcast'
          ) {
            if (
              global.autoStatusView
            ) {
              try {
                await sock.readMessages([
                  rawMsg.key
                ]);
              } catch (_) {}
            }

            if (
              global.autoStatusLike &&
              rawMsg.key
                .participant
            ) {
              try {
                await sock.sendMessage(
                  'status@broadcast',
                  {
                    react: {
                      key: rawMsg.key,
                      text: '❤️'
                    }
                  }
                );
              } catch (_) {}
            }

            continue;
          }

          if (!rawMsg.message) {
            continue;
          }

          const revokeInfo =
            rawMsg.message
              ?.protocolMessage;

          if (
            revokeInfo &&
            revokeInfo.type === 0 &&
            revokeInfo.key?.id
          ) {
            const deleterJid =
              rawMsg.key?.participant ||
              rawMsg.key?.remoteJid;

            await notifyDeletedMessage(
              jid,
              revokeInfo.key.id,
              deleterJid
            );

            continue;
          }

          if (
            global.antiDeleteStore
          ) {
            const chatId = jid;

            if (
              !global.msgCache
            ) {
              global.msgCache =
                new Map();
            }

            const msgId =
              rawMsg.key.id;

            global.msgCache.set(
              msgId,
              {
                msg: rawMsg,
                time: Date.now(),
                jid: chatId
              }
            );

            if (
              global.msgCache.size >
              500
            ) {
              const cutoff =
                Date.now() -
                30 * 60 * 1000;

              for (
                const [
                  key,
                  value
                ] of global.msgCache
              ) {
                if (
                  value.time <
                  cutoff
                ) {
                  global.msgCache.delete(
                    key
                  );
                }
              }
            }
          }

          let m;

          try {
            m =
              await serializeMessage(
                sock,
                rawMsg
              );
          } catch (error) {
            console.error(
              `[${sessionId}] Serializer:`,
              error.message
            );

            continue;
          }

          let blocked = false;

          for (
            const plugin of hookPlugins
          ) {
            if (
              rawMsg.key?.fromMe &&
              !plugin.allowFromMe
            ) {
              continue;
            }

            try {
              if (
                await plugin.onMessage(
                  sock,
                  m
                ) === true
              ) {
                blocked = true;
                break;
              }
            } catch (error) {
              console.error(
                `Hook [${plugin.name}]:`,
                error.message
              );
            }
          }

          if (blocked) {
            continue;
          }

          const body =
            m.body || '';

          if (
            !body.startsWith(
              global.BOT_PREFIX
            )
          ) {
            continue;
          }

          const parts =
            body
              .slice(
                global.BOT_PREFIX.length
              )
              .trim()
              .split(/\s+/);

          const commandName =
            parts[0]?.toLowerCase();

          if (!commandName) {
            continue;
          }

          const plugin =
            commandMap.get(
              commandName
            );

          if (!plugin) {
            continue;
          }

          console.log(
            `[${sessionId}] ${m.senderNumber} -> .${commandName}`
          );

          try {
            await plugin.execute(
              sock,
              m,
              parts.slice(1)
            );
          } catch (error) {
            console.error(
              `Command [${commandName}]:`,
              error.message
            );

            try {
              await m.reply(
                `Error: ${error.message}`
              );
            } catch (_) {}
          }
        }
      }
    );

    sock.ev.on(
      'messages.delete',
      async item => {
        try {
          const keys =
            item.keys || [];

          for (
            const key of keys
          ) {
            await notifyDeletedMessage(
              key.remoteJid,
              key.id,
              key.participant
            );
          }
        } catch (error) {
          console.error(
            'Anti-delete:',
            error.message
          );
        }
      }
    );

    sock.ev.on(
      'group-participants.update',
      async update => {
        try {
          const {
            id: groupId,
            participants,
            action
          } = update;

          const settings =
            getGroupSettings(
              groupId
            );

          /*
           * NEW MEMBER SYSTEM
           */

          if (action === 'add') {
            for (
              const participant of participants
            ) {
              const userId =
                typeof participant ===
                'string'
                  ? participant
                  : participant.id ||
                    participant.phoneNumber;

              if (!userId) continue;

              if (
                global.normalizeJid(
                  userId
                ) ===
                global.normalizeJid(
                  sock.user?.id || ''
                )
              ) {
                continue;
              }

              let groupMeta;

              try {
                groupMeta =
                  await sock.groupMetadata(
                    groupId
                  );
              } catch (_) {}

              const participantData =
                groupMeta?.participants
                  ?.find(p => {
                    const id =
                      p?.id ||
                      p?.jid ||
                      '';

                    const phone =
                      p?.phoneNumber ||
                      '';

                    return (
                      global.getNumberFromJid(
                        id
                      ) ===
                      global.getNumberFromJid(
                        userId
                      ) ||
                      global.getNumberFromJid(
                        phone
                      ) ===
                      global.getNumberFromJid(
                        userId
                      )
                    );
                  });

              const pushName =
                participantData?.notify ||
                participantData?.name ||
                'New member';

              groupMemory.ensureMember(
                groupId,
                userId,
                {
                  name: pushName
                }
              );

              try {
                await sock.sendMessage(
                  groupId,
                  {
                    text:
                      `⚡ @${userId.split('@')[0]}\n\n` +
                      `Welcome to the group.\n\n` +
                      `Before you start causing problems, introduce yourself properly.\n\n` +
                      `*Name:* Your real name\n` +
                      `*Age:* Your age\n` +
                      `*Role:* What you do\n` +
                      `*Alias:* Your nickname\n\n` +
                      `I need all four.`,
                    mentions: [
                      userId
                    ]
                  }
                );
              } catch (_) {}
            }
          }

          /*
           * REMOVE MEMBER FROM MEMORY
           */

          if (action === 'remove') {
            const database =
              groupMemory.getAllGroups();

            const group =
              database[groupId];

            if (group) {
              for (
                const participant
                of participants
              ) {
                const userId =
                  typeof participant ===
                  'string'
                    ? participant
                    : participant.id ||
                      participant.phoneNumber;

                if (
                  userId &&
                  group.members?.[
                    userId
                  ]
                ) {
                  delete group.members[
                    userId
                  ];
                }
              }

              const dataDir =
                path.join(
                  __dirname,
                  'data'
                );

              if (
                !fs.existsSync(
                  dataDir
                )
              ) {
                fs.mkdirSync(
                  dataDir,
                  {
                    recursive: true
                  }
                );
              }

              fs.writeFileSync(
                path.join(
                  dataDir,
                  'groupMembers.json'
                ),
                JSON.stringify(
                  database,
                  null,
                  2
                )
              );
            }
          }

          /*
           * EXISTING WELCOME / GOODBYE
           */

          for (
            const participant of participants
          ) {
            const userId =
              typeof participant ===
              'string'
                ? participant
                : participant.id ||
                  participant.phoneNumber;

            if (!userId) continue;

            if (
              global.normalizeJid(
                userId
              ) ===
              global.normalizeJid(
                sock.user?.id || ''
              )
            ) {
              continue;
            }

            const name =
              userId.split('@')[0];

            let groupMeta;

            try {
              groupMeta =
                await sock.groupMetadata(
                  groupId
                );
            } catch (_) {}

            const groupName =
              groupMeta?.subject ||
              'the group';

            const groupDesc =
              (
                groupMeta?.desc || ''
              ).trim();

            const memberCount =
              groupMeta
                ?.participants
                ?.length || 0;

            let ppUrl;

            try {
              ppUrl =
                await sock.profilePictureUrl(
                  userId,
                  'image'
                );
            } catch (_) {
              ppUrl =
                global.menuImage;
            }

            if (
              action === 'add' &&
              settings.welcome
            ) {
              const card =
                settings.welcomeText
                  ? applyPlaceholders(
                      settings.welcomeText,
                      {
                        userId,
                        groupName,
                        groupDesc,
                        memberCount
                      }
                    )
                  : [
                      `╭─〔 ✦ *ᴡᴇʟᴄᴏᴍᴇ* ✦ 〕`,
                      `│ ᴜsᴇʀ: @${name}`,
                      `│ ɢʀᴏᴜᴘ: ${toSmallCaps(groupName)}`,
                      `│ ᴍᴇᴍʙᴇʀ ᴄᴏᴜɴᴛ: ${memberCount}`,
                      `╰──────────────`,
                      ``,
                      groupDesc
                        ? `✦ *ɢʀᴏᴜᴘ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ*\n${toSmallCaps(groupDesc)}\n`
                        : null,
                      `ᴇɴᴊᴏʏ ʏᴏᴜʀ sᴛᴀʏ 🌟`
                    ]
                      .filter(Boolean)
                      .join('\n');

              try {
                await sock.sendMessage(
                  groupId,
                  {
                    image: {
                      url: ppUrl
                    },
                    caption: card,
                    mentions: [
                      userId
                    ]
                  }
                );
              } catch (_) {
                await sock.sendMessage(
                  groupId,
                  {
                    text: card,
                    mentions: [
                      userId
                    ]
                  }
                );
              }
            }

            if (
              action === 'remove' &&
              settings.goodbye
            ) {
              const card =
                settings.goodbyeText
                  ? applyPlaceholders(
                      settings.goodbyeText,
                      {
                        userId,
                        groupName,
                        groupDesc,
                        memberCount
                      }
                    )
                  : [
                      `╭─〔 ✦ *ɢᴏᴏᴅʙʏᴇ* ✦ 〕`,
                      `│ ᴜsᴇʀ: @${name}`,
                      `│ ɢʀᴏᴜᴘ: ${toSmallCaps(groupName)}`,
                      `│ ᴍᴇᴍʙᴇʀ ᴄᴏᴜɴᴛ: ${memberCount}`,
                      `╰──────────────`,
                      ``,
                      groupDesc
                        ? `✦ *ɢʀᴏᴜᴘ ᴅᴇsᴄʀɪᴘᴛɪᴏɴ*\n${toSmallCaps(groupDesc)}\n`
                        : null,
                      `ᴡᴇ'ʟʟ ᴍɪss ʏᴏᴜ 💔`
                    ]
                      .filter(Boolean)
                      .join('\n');

              try {
                await sock.sendMessage(
                  groupId,
                  {
                    image: {
                      url: ppUrl
                    },
                    caption: card,
                    mentions: [
                      userId
                    ]
                  }
                );
              } catch (_) {
                await sock.sendMessage(
                  groupId,
                  {
                    text: card,
                    mentions: [
                      userId
                    ]
                  }
                );
              }
            }
          }
        } catch (error) {
          console.error(
            'Group participant handler:',
            error.message
          );
        }
      }
    );
  } catch (error) {
    console.error(
      `[${sessionId}] Startup:`,
      error.message
    );

    state.starting = false;
    state.sock = null;

    setTimeout(
      () => startSession(sessionId),
      10000
    );
  }
}

function restoreSessions() {
  if (
    !fs.existsSync(
      SESSIONS_DIR
    )
  ) {
    return;
  }

  const dirs =
    fs
      .readdirSync(
        SESSIONS_DIR
      )
      .filter(
        d =>
          /^[0-9a-f]{16}$/.test(d)
      )
      .filter(
        d =>
          fs.existsSync(
            path.join(
              SESSIONS_DIR,
              d,
              'creds.json'
            )
          )
      );

  if (!dirs.length) {
    return;
  }

  console.log(
    `Restoring ${dirs.length} session(s)...`
  );

  for (
    const sessionId of dirs
  ) {
    startSession(
      sessionId
    );
  }
}

const app = express();

app.set(
  'trust proxy',
  1
);

app.use(
  express.urlencoded({
    extended: false
  })
);

app.use(
  express.json()
);

const FRONTEND_DIR =
  path.join(
    __dirname,
    'frontend'
  );

app.use(
  express.static(
    FRONTEND_DIR
  )
);

app.use(
  (req, _res, next) => {
    req.cookies = {};

    for (
      const part of (
        req.headers.cookie || ''
      ).split(';')
    ) {
      const eq =
        part.indexOf('=');

      if (eq < 0) continue;

      const key =
        part
          .slice(0, eq)
          .trim();

      const value =
        part
          .slice(eq + 1)
          .trim();

      try {
        req.cookies[key] =
          decodeURIComponent(
            value
          );
      } catch (_) {
        req.cookies[key] =
          value;
      }
    }

    next();
  }
);

function ensureSession(
  req,
  res,
  next
) {
  const raw =
    req.cookies[
      COOKIE_NAME
    ] || '';

  const sessionId =
    /^[0-9a-f]{16}$/.test(raw)
      ? raw
      : null;

  if (
    sessionId &&
    sessions.has(sessionId)
  ) {
    req.sessionId =
      sessionId;

    return next();
  }

  if (
    activeSessionCount() >=
    MAX_SESSIONS
  ) {
    return res
      .status(503)
      .send(
        fullCapacityPage()
      );
  }

  const newId =
    genId();

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${newId}; Max-Age=${COOKIE_MAX}; HttpOnly; SameSite=Lax; Path=/`
  );

  req.sessionId =
    newId;

  startSession(
    newId
  );

  next();
}

function ipLockCheck(
  req,
  res,
  next
) {
  const state =
    sessions.get(
      req.sessionId
    );

  if (!state?.paired) {
    return next();
  }

  const ip =
    getIP(req);

  if (
    state.lockedIP &&
    ip === state.lockedIP
  ) {
    return res
      .status(200)
      .send(
        alreadyConnectedPage()
      );
  }

  next();
}

function alreadyConnectedPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voltage — Connected</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
min-height:100vh;
background:#07101f;
color:#dde7f5;
font-family:system-ui,sans-serif;
display:flex;
align-items:center;
justify-content:center;
padding:24px
}
.card{
width:min(420px,100%);
background:#0d1a2d;
border:1px solid #1a2e47;
border-radius:24px;
padding:40px 32px;
text-align:center
}
.icon{
width:72px;
height:72px;
margin:auto auto 20px;
border-radius:50%;
background:rgba(37,211,102,.1);
border:1px solid rgba(37,211,102,.3);
display:flex;
align-items:center;
justify-content:center;
font-size:32px
}
h1{font-size:1.5rem}
h1 em{
font-style:normal;
color:#25d366
}
p{
margin-top:15px;
color:#71859d;
font-size:.9rem;
line-height:1.7
}
.badge{
display:inline-block;
margin-top:20px;
padding:9px 18px;
border-radius:30px;
background:#111f33;
color:#25d366;
font-size:.8rem
}
</style>
</head>
<body>
<div class="card">
<div class="icon">✓</div>
<h1><em>Voltage</em> Connected</h1>
<p>
This WhatsApp account is already linked
and Voltage is currently running.
</p>
<div class="badge">● Bot Online</div>
</div>
</body>
</html>`;
}

function fullCapacityPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voltage — Full</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
min-height:100vh;
background:#07101f;
color:#dde7f5;
font-family:system-ui,sans-serif;
display:flex;
align-items:center;
justify-content:center;
padding:24px
}
.card{
width:min(420px,100%);
background:#0d1a2d;
border:1px solid #1a2e47;
border-radius:24px;
padding:40px 32px;
text-align:center
}
h1{font-size:1.5rem}
h1 em{
font-style:normal;
color:#f59e0b
}
p{
margin-top:15px;
color:#71859d;
font-size:.9rem;
line-height:1.7
}
a{
display:inline-block;
margin-top:20px;
padding:10px 22px;
background:#111f33;
border:1px solid #1a2e47;
border-radius:30px;
color:#dde7f5;
text-decoration:none
}
</style>
</head>
<body>
<div class="card">
<h1>All slots are <em>full</em></h1>
<p>
Voltage is already running the maximum
number of sessions allowed on this server.
</p>
<a href="/">Try again</a>
</div>
</body>
</html>`;
}

app.get(
  '/',
  ensureSession,
  ipLockCheck,
  (req, res) => {
    res.sendFile(
      path.join(
        FRONTEND_DIR,
        'pair.html'
      )
    );
  }
);

app.get(
  '/pair',
  ensureSession,
  ipLockCheck,
  (req, res) => {
    res.sendFile(
      path.join(
        FRONTEND_DIR,
        'pair.html'
      )
    );
  }
);

app.get(
  '/new-session',
  (req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/`
    );

    res.redirect('/');
  }
);

app.get(
  '/api/capacity',
  (req, res) => {
    res.json({
      active:
        activeSessionCount(),
      max:
        MAX_SESSIONS
    });
  }
);

app.get(
  '/api/status',
  ensureSession,
  (req, res) => {
    const state =
      sessions.get(
        req.sessionId
      );

    if (!state) {
      return res.json({
        status: 'connecting',
        qr: null,
        pairingCode: null
      });
    }

    const pairingCode =
      state.pairingCode &&
      Date.now() -
        state.pairingCodeTime <
        300000
        ? state.pairingCode
        : null;

    res.json({
      status:
        state.status,

      qr:
        state.qr,

      pairingCode,

      prefix:
        global.BOT_PREFIX,

      sessionId:
        req.sessionId,

      capacity: {
        active:
          activeSessionCount(),

        max:
          MAX_SESSIONS
      }
    });
  }
);

app.post(
  '/pair',
  ensureSession,
  ipLockCheck,
  async (req, res) => {
    try {
      const phone =
        (
          req.body.phone || ''
        )
          .replace(/\D/g, '')
          .trim();

      if (!phone) {
        return res
          .status(400)
          .json({
            error:
              'Phone number required'
          });
      }

      const state =
        sessions.get(
          req.sessionId
        );

      if (!state) {
        return res
          .status(400)
          .json({
            error:
              'Session not ready'
          });
      }

      if (!state.sock) {
        return res
          .status(400)
          .json({
            error:
              'Socket not ready'
          });
      }

      if (
        state.status !==
        'connecting'
      ) {
        return res
          .status(400)
          .json({
            error:
              `Cannot pair — bot is ${state.status}.`
          });
      }

      const code =
        await state.sock.requestPairingCode(
          phone,
          PAIR_CODE
        );

      state.pairingCode =
        code;

      state.pairingCodeTime =
        Date.now();

      const ip =
        getIP(req);

      if (!state.lockedIP) {
        state.lockedIP =
          ip;
      }

      res.json({
        code
      });
    } catch (error) {
      console.error(
        'Pairing:',
        error.message
      );

      res
        .status(500)
        .json({
          error:
            error.message
        });
    }
  }
);

app.use(
  (_req, res) =>
    res
      .status(404)
      .send(
        '<center><h2>404</h2><a href="/">Home</a></center>'
      )
);

app.listen(
  PORT,
  () => {
    console.log(
      `Voltage running on port ${PORT}`
    );

    restoreSessions();
  }
);

process.on(
  'SIGINT',
  () => {
    for (
      const [, state]
      of sessions
    ) {
      if (
        state.presenceInterval
      ) {
        clearInterval(
          state.presenceInterval
        );
      }

      try {
        state.sock?.end();
      } catch (_) {}
    }

    process.exit(0);
  }
);

process.on(
  'uncaughtException',
  error =>
    console.error(
      'Uncaught:',
      error.message
    )
);

process.on(
  'unhandledRejection',
  error =>
    console.error(
      'Rejection:',
      error
    )
);
