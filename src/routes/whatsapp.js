const express = require("express");

const {
  connectWhatsApp,
  requestPairingCode,
  getSocket,
  hasSession,
  getCurrentPhone,
  normalizePhone,
  validatePhone
} = require("../whatsapp/connection");

const router = express.Router();

router.get("/status", (req, res) => {
  const phone = getCurrentPhone();

  res.json({
    success: true,
    name: "Voltage AI",
    platform: "WhatsApp",
    connected: Boolean(getSocket()),
    phone: phone || null
  });
});

router.post("/pair", async (req, res) => {
  try {
    const phone = validatePhone(
      req.body?.phone
    );

    console.log(
      `Voltage pairing requested for ${phone}`
    );

    if (hasSession(phone)) {
      return res.status(409).json({
        success: false,
        error:
          "This WhatsApp number already has an active Voltage session.",
        phone
      });
    }

    const pairingCode =
      await requestPairingCode(phone);

    return res.json({
      success: true,
      message:
        "WhatsApp pairing code generated.",
      phone,
      pairingCode,
      instructions: [
        "Open WhatsApp on the phone using this number.",
        "Open Settings.",
        "Open Linked Devices.",
        "Choose Link a Device.",
        "Choose Link with phone number instead.",
        "Enter the pairing code."
      ]
    });
  } catch (error) {
    console.error(
      "WhatsApp pairing error:",
      error
    );

    return res.status(400).json({
      success: false,
      error:
        error?.message ||
        "Failed to generate pairing code."
    });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const phone = validatePhone(
      req.body?.phone
    );

    await connectWhatsApp(phone);

    return res.json({
      success: true,
      message:
        "Voltage WhatsApp connection started.",
      phone
    });
  } catch (error) {
    console.error(
      "WhatsApp connection error:",
      error
    );

    return res.status(400).json({
      success: false,
      error:
        error?.message ||
        "Failed to connect WhatsApp."
    });
  }
});

router.get("/pairing-code", (req, res) => {
  const phone = normalizePhone(
    req.query?.phone
  );

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: "Phone number is required."
    });
  }

  const socket = getSocket();

  if (!socket || !hasSession(phone)) {
    return res.status(404).json({
      success: false,
      error:
        "No active WhatsApp pairing session for this number."
    });
  }

  const {
    getPairingCode
  } = require("../whatsapp/connection");

  const pairingCode =
    getPairingCode();

  if (!pairingCode) {
    return res.status(404).json({
      success: false,
      error:
        "No active pairing code."
    });
  }

  return res.json({
    success: true,
    phone,
    pairingCode
  });
});

module.exports = router;
