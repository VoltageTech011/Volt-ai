const {
default: makeWASocket,
useMultiFileAuthState,
DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const { handleMessages } = require("./messageHandler");

const BOT_NUMBER = String(
process.env.BOT_NUMBER || "2349110231750"
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
let connectionReady = null;
let connectionResolve = null;
let connectionReject = null;

function normalizePhone(phone) {
return String(phone || "").replace(/\D/g, "");
}

function isRegistered() {
return Boolean(state?.creds?.registered);
}

function createConnectionReadyPromise() {
connectionReady = new Promise((resolve, reject) => {
connectionResolve = resolve;
connectionReject = reject;
});

return connectionReady;
}

async function createConnection() {
if (socket) {
return socket;
}

if (connecting) {
if (connectionReady) {
await connectionReady;
}

return socket;

}

connecting = true;

const readyPromise = createConnectionReadyPromise();

try {
fs.mkdirSync(authPath, {
recursive: true
});

const auth = await useMultiFileAuthState(
  authPath
);

state = auth.state;
saveCreds = auth.saveCreds;

socket = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  markOnlineOnConnect: false,
  syncFullHistory: false,
  browser: [
    "Voltage",
    "Chrome",
    "1.0.0"
  ]
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

      if (connectionResolve) {
        connectionResolve(socket);
        connectionResolve = null;
        connectionReject = null;
      }

      return;
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output
          ?.statusCode;

      const wasLoggedOut =
        statusCode ===
        DisconnectReason.loggedOut;

      const currentSocket = socket;

      socket = null;
      connecting = false;

      if (connectionReject) {
        connectionReject(
          lastDisconnect?.error ||
            new Error(
              "WhatsApp connection closed"
            )
        );

        connectionResolve = null;
        connectionReject = null;
      }

      if (wasLoggedOut) {
        console.error(
          "================================"
        );
        console.error(
          "⚡ VOLTAGE WHATSAPP LOGGED OUT"
        );
        console.error(
          `Number: ${BOT_NUMBER}`
        );
        console.error(
          "================================"
        );

        pairingCode = null;

        if (currentSocket) {
          try {
            currentSocket.ws?.close();
          } catch {}
        }

        return;
      }

      console.log(
        "Voltage WhatsApp disconnected."
      );

      scheduleReconnect();
    }
  }
);

return socket;

} catch (error) {
connecting = false;
socket = null;

if (connectionReject) {
  connectionReject(error);
  connectionResolve = null;
  connectionReject = null;
}

throw error;

} finally {
void readyPromise;
}
}

async function waitForConnection() {
if (!socket) {
await createConnection();
}

if (!socket) {
throw new Error(
"WhatsApp socket could not be created."
);
}

if (isRegistered()) {
return socket;
}

if (!connectionReady) {
createConnectionReadyPromise();
}

await connectionReady;

if (!socket) {
throw new Error(
"WhatsApp socket closed before pairing."
);
}

return socket;
}

async function requestPairingCode() {
if (isRegistered()) {
console.log(
"Voltage WhatsApp is already registered."
);

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
"Number: ${BOT_NUMBER}"
);
console.log(
"Connecting to WhatsApp..."
);

const currentSocket =
await createConnection();

if (!currentSocket) {
throw new Error(
"WhatsApp socket could not be created."
);
}

if (isRegistered()) {
return null;
}

/*

* Give the WhatsApp WebSocket a moment
* to complete its initial handshake.
  */
  await new Promise((resolve) =>
  setTimeout(resolve, 1500)
  );

if (!socket) {
throw new Error(
"WhatsApp connection closed before pairing code request."
);
}

if (isRegistered()) {
return null;
}

console.log(
"Requesting pairing code..."
);

try {
pairingCode =
await socket.requestPairingCode(
normalizePhone(BOT_NUMBER)
);

console.log(
  "================================"
);
console.log(
  `⚡ PAIRING CODE: ${pairingCode}`
);
console.log(
  "================================"
);
console.log(
  "Open WhatsApp on the phone."
);
console.log(
  "Go to Linked Devices."
);
console.log(
  "Choose Link a device."
);
console.log(
  "Choose Link with phone number instead."
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
    console.log(
      "Attempting to reconnect Voltage WhatsApp..."
    );

    await createConnection();

    if (
      socket &&
      isRegistered()
    ) {
      console.log(
        "Voltage WhatsApp reconnected."
      );
    }
  } catch (error) {
    console.error(
      "Voltage reconnect error:",
      error
    );

    scheduleReconnect();
  }
},
5000

);
}

async function connectWhatsApp() {
await createConnection();

if (!isRegistered()) {
await requestPairingCode();
}

return socket;
}

function getSocket() {
return socket;
}

function hasSession() {
return Boolean(
socket && isRegistered()
);
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
