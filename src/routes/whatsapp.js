const express = require("express");

const {
  connectWhatsApp,
  requestPairingCode,
  getSocket,
  hasSession,
  getBotNumber,
  getPairingCode,
  getConnectionState,
  subscribeLogs
} = require("../whatsapp/connection");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    success: true,
    connected: getConnectionState() === "open",
    state: getConnectionState(),
    number: getBotNumber(),
    pairingCode: getPairingCode(),
    session: hasSession()
  });
});

router.post("/pair", async (req, res) => {
  try {
    const number = String(
      req.body?.number || ""
    ).replace(/\D/g, "");

    if (!number) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp number is required"
      });
    }

    if (number.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Invalid WhatsApp number"
      });
    }

    console.log(
      `WhatsApp pairing requested for ${number}`
    );

    const result = await connectWhatsApp(
      number
    );

    return res.json({
      success: true,
      state: getConnectionState(),
      number,
      pairingCode:
        result?.pairingCode ||
        getPairingCode()
    });
  } catch (error) {
    console.error(
      "WhatsApp pairing error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Failed to start WhatsApp pairing"
    });
  }
});

router.get("/logs", (req, res) => {
  res.setHeader(
    "Content-Type",
    "text/event-stream"
  );

  res.setHeader(
    "Cache-Control",
    "no-cache"
  );

  res.setHeader(
    "Connection",
    "keep-alive"
  );

  res.flushHeaders?.();

  const send = (log) => {
    res.write(
      `data: ${JSON.stringify(log)}\n\n`
    );
  };

  send({
    type: "state",
    state: getConnectionState(),
    number: getBotNumber()
  });

  const unsubscribe =
    subscribeLogs(send);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);

    if (typeof unsubscribe === "function") {
      unsubscribe();
    }

    res.end();
  });
});

router.get("/session", (req, res) => {
  const socket = getSocket();

  res.json({
    success: true,
    connected:
      getConnectionState() === "open",
    state: getConnectionState(),
    number: getBotNumber(),
    session: Boolean(socket)
  });
});

module.exports = router;
