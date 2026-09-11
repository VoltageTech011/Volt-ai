const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");

let socket = null;
let reconnecting = false;

const authPath = path.join(process.cwd(), "auth");

async function connectWhatsApp() {
  if (socket) {
    return socket;
  }

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      reconnecting = false;
      console.log("WhatsApp connected.");
    }

    if (connection === "close") {
      socket = null;

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("WhatsApp session logged out.");
        return;
      }

      if (!reconnecting) {
        reconnecting = true;

        console.log("WhatsApp connection closed. Reconnecting...");

        setTimeout(() => {
          connectWhatsApp().catch((error) => {
            reconnecting = false;
            console.error("WhatsApp reconnect error:", error);
          });
        }, 3000);
      }
    }
  });

  return socket;
}

async function requestPairingCode(phone) {
  if (!socket) {
    await connectWhatsApp();
  }

  return socket.requestPairingCode(phone);
}

function getSocket() {
  return socket;
}

module.exports = {
  connectWhatsApp,
  requestPairingCode,
  getSocket
};
