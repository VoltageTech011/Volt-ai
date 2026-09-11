const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const config = require("../config");

const baseAuthPath = path.resolve(
  process.env.VOLTAGE_AUTH_DIR || path.join(process.cwd(), "auth")
);

let sessions = new Map();
let reconnecting = new Map();

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function getSessionPath(phone) {
  const cleanPhone = normalizePhone(phone);

  return path.join(baseAuthPath, cleanPhone);
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

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  const socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sessions.set(cleanPhone, socket);

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      reconnecting.set(cleanPhone, false);

      console.log(`WhatsApp connected: ${cleanPhone}`);
    }

    if (connection === "close") {
      sessions.delete(cleanPhone);

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        reconnecting.delete(cleanPhone);

        console.log(`WhatsApp logged out: ${cleanPhone}`);

        return;
      }

      if (!reconnecting.get(cleanPhone)) {
        reconnecting.set(cleanPhone, true);

        console.log(
          `WhatsApp connection closed. Reconnecting: ${cleanPhone}`
        );

        setTimeout(() => {
          reconnecting.set(cleanPhone, false);

          connectWhatsApp(cleanPhone).catch((error) => {
            console.error(
              `WhatsApp reconnect error for ${cleanPhone}:`,
              error
            );
          });
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
    throw new Error("This WhatsApp session is already registered");
  }

  return socket.requestPairingCode(cleanPhone);
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
