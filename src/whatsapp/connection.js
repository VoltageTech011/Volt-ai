const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const { handleMessages } = require("./messageHandler");

const BOT_NUMBER =
  String(
    process.env.BOT_NUMBER ||
    "2349110231750"
  ).replace(/\D/g, "");

const baseAuthPath = path.resolve(
  process.env.VOLTAGE_AUTH_DIR ||
    path.join(process.cwd(), "auth")
);

const authPath = path.join(
  baseAuthPath,
  BOT_NUMBER
);

let socket = null;
let state = null;
let saveCreds = null;
let connecting = false;
let reconnectTimer = null;
let pairingCode = null;

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function isRegistered() {
  return Boolean(
    state?.creds?.registered
  );
}

async function createConnection() {
  if (connecting) {
    return socket;
  }

  connecting = true;

  try {
    fs.mkdirSync(authPath, {
      recursive: true
    });

    const auth =
      await useMultiFileAuthState(
        authPath
      );

    state = auth.state;
    saveCreds = auth.saveCreds;

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    socket.ev.on(
      "creds.update",
      saveCreds
    );

    socket.ev.on(
      "messages.upsert",
      async ({ messages }) => {
        try {
          await handleMessages(
            socket,
            messages
          );
        } catch (error) {
          console.error(
            "Voltage message handler error:",
            error
          );
        }
      }
    );

    socket.ev.on(
      "connection.update",
      async (update) => {
        const {
          connection,
          lastDisconnect
        } = update;

        if (connection === "open") {
          connecting = false;
          pairingCode = null;

          console.log(
            "================================"
          );
          console.log(
            "⚡ VOLTAGE WHATSAPP CONNECTED"
          );
          console.log(
            `Number: ${BOT_NUMBER}`
          );
          console.log(
            "Status: ONLINE"
          );
          console.log(
            "================================"
          );

          return;
        }

        if (connection === "close") {
          socket = null;
          connecting = false;

          const statusCode =
            lastDisconnect?.error?.output
              ?.statusCode;

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {
            console.error(
              "Voltage WhatsApp session was logged out."
            );

            console.error(
              "Delete the saved auth session and pair again."
            );

            return;
          }

          console.log(
            "Voltage WhatsApp disconnected."
          );

          scheduleReconnect();
        }
      }
    );

    connecting = false;

    return socket;
  } catch (error) {
    connecting = false;
    socket = null;

    throw error;
  }
}

async function requestPairingCode() {
  if (isRegistered()) {
    return null;
  }

  if (!socket) {
    await createConnection();
  }

  if (!socket) {
    throw new Error(
      "WhatsApp socket could not be created."
    );
  }

  if (isRegistered()) {
    return null;
  }

  if (pairingCode) {
    return pairingCode;
  }

  console.log(
    "================================"
  );
  console.log(
    "⚡ VOLTAGE WHATSAPP PAIRING"
  );
  console.log(
    `Number: ${BOT_NUMBER}`
  );
  console.log(
    "Requesting pairing code..."
  );

  try {
    pairingCode =
      await socket.requestPairingCode(
        BOT_NUMBER
      );

    console.log(
      "================================"
    );
    console.log(
      `PAIRING CODE: ${pairingCode}`
    );
    console.log(
      "================================"
    );
    console.log(
      "Open WhatsApp on the phone you want"
    );
    console.log(
      "to use for Voltage."
    );
    console.log(
      "Go to Linked Devices → Link a device"
    );
    console.log(
      "→ Link with phone number instead."
    );
    console.log(
      "Enter the pairing code above."
    );
    console.log(
      "================================"
    );

    return pairingCode;
  } catch (error) {
    pairingCode = null;

    console.error(
      "Failed to generate WhatsApp pairing code:",
      error
    );

    throw error;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(
    async () => {
      reconnectTimer = null;

      try {
        await createConnection();
      } catch (error) {
        console.error(
          "Voltage reconnect error:",
          error
        );

        scheduleReconnect();
      }
    },
    3000
  );
}

async function connectWhatsApp() {
  const currentSocket =
    await createConnection();

  if (!isRegistered()) {
    await requestPairingCode();
  }

  return currentSocket;
}

function getSocket() {
  return socket;
}

function hasSession() {
  return Boolean(socket);
}

function getBotNumber() {
  return BOT_NUMBER;
}

function getPairingCode() {
  return pairingCode;
}

module.exports = {
  connectWhatsApp,
  requestPairingCode,
  getSocket,
  hasSession,
  getBotNumber,
  getPairingCode
};
