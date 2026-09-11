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
  if (reconnecting) {
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
      reconnecting = false;

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("WhatsApp session logged out.");
        socket = null;
        return;
      }

      console.log("WhatsApp connection closed. Reconnecting...");

      setTimeout(() => {
        connectWhatsApp().catch(console.error);
      }, 3000);
    }
  });

  return socket;
}

function getSocket() {
  return socket;
}

module.exports = {
  connectWhatsApp,
  getSocket
};
