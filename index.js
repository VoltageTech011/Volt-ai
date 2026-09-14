require('./config');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const express = require('express');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const serializeMessage = require('./lib/serializer');

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_DIR = path.join(__dirname, 'sessions');

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let sock = null;
let reconnectTimer = null;
let pairingRequested = false;

function getOwnerJid() {
  return `${global.OWNER_NUMBER}@s.whatsapp.net`;
}

async function startVoltage() {
  if (sock) return;

  console.log('');
  console.log('⚡ Starting Voltage...');
  console.log(`⚡ Version: ${global.BOT_VERSION}`);
  console.log(`👑 Owner: ${global.OWNER_NAME}`);
  console.log('');

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Voltage', 'Chrome', '1.0.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false,
    keepAliveIntervalMs: 10000
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update;

    if (connection === 'connecting') {
      console.log('🔌 Connecting to WhatsApp...');
    }

    if (connection === 'open') {
      pairingRequested = false;

      console.log('');
      console.log('╔════════════════════════════╗');
      console.log('║      ⚡ VOLTAGE ONLINE     ║');
      console.log('╚════════════════════════════╝');
      console.log(`👑 Owner: ${global.OWNER_NAME}`);
      console.log(`📱 Number: ${global.OWNER_NUMBER}`);
      console.log(`🔧 Prefix: ${global.BOT_PREFIX}`);
      console.log('');

      try {
        await sock.sendMessage(getOwnerJid(), {
          text:
`⚡ *VOLTAGE ONLINE*

System connected successfully.

Name: ${global.BOT_NAME}
Version: ${global.BOT_VERSION}
Prefix: ${global.BOT_PREFIX}

WhatsApp core is operational.`
        });
      } catch (_) {}
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode
          : 0;

      sock = null;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('❌ Voltage was logged out.');
        console.log('Delete the sessions folder and pair again.');
        return;
      }

      console.log(`🔄 Connection closed (${statusCode}). Reconnecting...`);

      clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(() => {
        startVoltage().catch(err => {
          console.error('❌ Restart error:', err.message);
        });
      }, 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      if (!message?.message) continue;

      try {
        const m = await serializeMessage(sock, message);

        console.log(
          `[${m.isGroup ? 'GROUP' : 'DM'}] ${m.senderNumber}: ${m.body || '[media]'}`
        );

        if (!m.body) continue;

        if (m.body.trim().toLowerCase() === `${global.BOT_PREFIX}ping`) {
          await m.reply('⚡ pong');
        }

      } catch (err) {
        console.error('❌ Message error:', err.message);
      }
    }
  });

  if (!state.creds.registered) {
    await requestPairingCode();
  }
}

async function requestPairingCode() {
  if (pairingRequested || !sock) return;

  pairingRequested = true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('📱 Enter WhatsApp number with country code: ', async number => {
    rl.close();

    number = number.replace(/\D/g, '');

    if (!number) {
      console.log('❌ Invalid phone number.');
      pairingRequested = false;
      return requestPairingCode();
    }

    try {
      const code = await sock.requestPairingCode(number);

      console.log('');
      console.log('╔════════════════════════════╗');
      console.log(`║     PAIRING CODE           ║`);
      console.log(`║       ${code}              ║`);
      console.log('╚════════════════════════════╝');
      console.log('');
      console.log('WhatsApp → Linked Devices → Link a Device');
      console.log('Enter the pairing code above.');
      console.log('');

    } catch (err) {
      console.error('❌ Pairing error:', err.message);
      pairingRequested = false;
    }
  });
}

app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Voltage</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #07101f;
            color: #dde7f5;
            font-family: system-ui, sans-serif;
          }

          .box {
            text-align: center;
            padding: 40px;
          }

          h1 {
            margin-bottom: 10px;
          }

          p {
            color: #71849b;
          }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>⚡ Voltage</h1>
          <p>WhatsApp core is running.</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'online',
    bot: global.BOT_NAME,
    version: global.BOT_VERSION,
    connected: !!sock
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Voltage server running on port ${PORT}`);

  startVoltage().catch(err => {
    console.error('❌ Voltage startup failed:', err.message);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Voltage...');

  clearTimeout(reconnectTimer);

  try {
    sock?.end(undefined);
  } catch (_) {}

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Voltage...');

  clearTimeout(reconnectTimer);

  try {
    sock?.end(undefined);
  } catch (_) {}

  process.exit(0);
});

process.on('uncaughtException', err => {
  console.error('⚠️ Uncaught:', err.message);
});

process.on('unhandledRejection', err => {
  console.error('⚠️ Rejection:', err);
});
