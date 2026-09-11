const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const path = require("path");
const fs = require("fs");

const { handleMessages } = require("./messageHandler");

const baseAuthPath = path.resolve(
  process.env.VOLTAGE_AUTH_DIR ||
    path.join(process.cwd(), "auth")
);

let socket = null;
let currentPhone = null;
let currentState = null;
let currentSaveCreds = null;
let connecting = false;
let reconnectTimer = null;
let pairingCode = null;

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function validatePhone(phone) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("WhatsApp phone number is required.");
  }

  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    throw new Error("Invalid WhatsApp phone number.");
  }

  return cleanPhone;
}

function getAuthPath(phone) {
  return path.join(
    baseAuthPath,
    validatePhone(phone)
  );
}

function isRegistered() {
  return Boolean(
    currentState?.creds?.registered
  );
}

function isConnected() {
  return Boolean(socket && currentPhone);
}

async function createConnection(phone) {
  const cleanPhone = validatePhone(phone);

  if (
    socket &&
    currentPhone === cleanPhone
  ) {
    return socket;
  }

  if (connecting) {
    while (connecting) {
      await new Promise((resolve) =>
        setTimeout(resolve, 100)
      );
    }

    if (
      socket &&
      currentPhone === cleanPhone
    ) {
      return socket;
    }
  }

  if (
    socket &&
    currentPhone !== cleanPhone
  ) {
    try {
      socket.end(
        new Error("Switching WhatsApp session")
      );
    } catch {}

    socket = null;
    currentPhone = null;
    currentState = null;
    currentSaveCreds = null;
    pairingCode = null;
  }

  connecting = true;

  try {
    const authPath = getAuthPath(cleanPhone);

    fs.mkdirSync(authPath, {
      recursive: true
    });

    const {
      state,
      saveCreds
    } = await useMultiFileAuthState(
      authPath
    );

    currentState = state;
    currentSaveCreds = saveCreds;
    currentPhone = cleanPhone;

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
          pairingCode = null;

          console.log(
            "================================"
          );
          console.log(
            "⚡ VOLTAGE WHATSAPP CONNECTED"
          );
          console.log(
            `Number: ${currentPhone}`
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
          const closedPhone =
            currentPhone;

          socket = null;
          connecting = false;

          const statusCode =
            lastDisconnect?.error?.output
              ?.statusCode;

          if (
            statusCode ===
            DisconnectReason.loggedOut
          ) {
            pairingCode = null;

            console.error(
              `Voltage WhatsApp session logged out: ${closedPhone}`
            );

            console.error(
              "Delete the corresponding auth folder before pairing again."
            );

            return;
          }

          console.log(
            `Voltage WhatsApp disconnected: ${closedPhone}`
          );

          scheduleReconnect(
            closedPhone
          );
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

async function requestPairingCode(phone) {
  const cleanPhone = validatePhone(phone);

  if (
    socket &&
    currentPhone !== cleanPhone
  ) {
    try {
      socket.end(
        new Error("Switching WhatsApp number")
      );
    } catch {}

    socket = null;
    currentPhone = null;
    currentState = null;
    currentSaveCreds = null;
    pairingCode = null;
  }

  if (!socket) {
    await createConnection(
      cleanPhone
    );
  }

  if (!socket) {
    throw new Error(
      "WhatsApp socket could not be created."
    );
  }

  if (currentPhone !== cleanPhone) {
    throw new Error(
      "WhatsApp session number mismatch."
    );
  }

  if (isRegistered()) {
    throw new Error(
      "This WhatsApp number is already connected to Voltage."
    );
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
    `Number: ${cleanPhone}`
  );
  console.log(
    "Requesting pairing code..."
  );

  try {
    pairingCode =
      await socket.requestPairingCode(
        cleanPhone
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
      "Open WhatsApp on the phone/account"
    );
    console.log(
      "you want Voltage to use."
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

function scheduleReconnect(phone) {
  if (reconnectTimer) {
    return;
  }

  if (!phone) {
    return;
  }

  reconnectTimer = setTimeout(
    async () => {
      reconnectTimer = null;

      try {
        await createConnection(
          phone
        );
      } catch (error) {
        console.error(
          `Voltage reconnect error for ${phone}:`,
          error
        );

        scheduleReconnect(phone);
      }
    },
    3000
  );
}

async function connectWhatsApp(phone) {
  const cleanPhone =
    validatePhone(phone);

  const currentSocket =
    await createConnection(
      cleanPhone
    );

  if (!isRegistered()) {
    await requestPairingCode(
      cleanPhone
    );
  }

  return currentSocket;
}

function getSocket() {
  return socket;
}

function hasSession(phone) {
  if (!phone) {
    return Boolean(socket);
  }

  return (
    Boolean(socket) &&
    currentPhone ===
      normalizePhone(phone)
  );
}

function getBotNumber() {
  return currentPhone;
}

function getPairingCode() {
  return pairingCode;
}

function getCurrentPhone() {
  return currentPhone;
}

module.exports = {
  connectWhatsApp,
  requestPairingCode,
  getSocket,
  hasSession,
  getBotNumber,
  getPairingCode,
  getCurrentPhone,
  normalizePhone,
  validatePhone
};
