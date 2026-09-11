const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const { handleMessages } = require("./messageHandler");

const baseAuthPath = path.resolve(
  process.env.VOLTAGE_AUTH_DIR || path.join(process.cwd(), "auth")
);

const sessions = new Map();
const reconnecting = new Map();

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function getSessionPath(phone) {
  return path.join(baseAuthPath, normalizePhone(phone));
}

async function connectWhatsApp(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("A valid phone number is required");
  }

  if (sessions.has(cleanPhone)) {
    return sessions.get(cleanPhone);
  }

  const authPath = getSessionPath(cleanPhone);

  fs.mkdirSync(authPath, {
    recursive: true
  });

  const { state, saveCreds } =
    await useMultiFileAuthState(authPath);

  const socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sessions.set(cleanPhone, socket);

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("messages.upsert", async ({ messages }) => {
    await handleMessages(socket, messages);
  });

  socket.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect
    } = update;

    if (connection === "open") {
      reconnecting.set(cleanPhone, false);

      console.log(
        `WhatsApp connected: ${cleanPhone}`
      );
    }

    if (connection === "close") {
      sessions.delete(cleanPhone);

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        reconnecting.delete(cleanPhone);

        console.log(
          `WhatsApp logged out: ${cleanPhone}`
        );

        return;
      }

      if (!reconnecting.get(cleanPhone)) {
        reconnecting.set(cleanPhone, true);

        console.log(
          `WhatsApp connection closed. Reconnecting: ${cleanPhone}`
        );

        setTimeout(async () => {
          try {
            reconnecting.set(cleanPhone, false);

            await connectWhatsApp(cleanPhone);
          } catch (error) {
            reconnecting.set(cleanPhone, false);

            console.error(
              `WhatsApp reconnect error for ${cleanPhone}:`,
              error
            );
          }
        }, 3000);
      }
    }
  });

  return socket;
}

async function requestPairingCode(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("A valid phone number is required");
  }

  const socket = await connectWhatsApp(cleanPhone);

  if (socket.authState?.creds?.registered) {
    throw new Error(
      "This WhatsApp session is already registered"
    );
  }

  console.log(
    `Requesting WhatsApp pairing code for ${cleanPhone}`
  );

  const code =
    await socket.requestPairingCode(cleanPhone);

  console.log(
    `WhatsApp pairing code generated for ${cleanPhone}`
  );

  return code;
}

function getSocket(phone) {
  return sessions.get(normalizePhone(phone)) || null;
}

function hasSession(phone) {
  return sessions.has(normalizePhone(phone));
}

module.exports = {
  connectWhatsApp,
  requestPairingCode,
  getSocket,
  hasSession
};
