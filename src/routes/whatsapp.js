const express = require("express");

const router = express.Router();

const {
  connectWhatsApp,
  requestPairingCode,
  getSocket
} = require("../whatsapp/connection");

router.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required"
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    if (cleanPhone.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number"
      });
    }

    await connectWhatsApp(cleanPhone);

    const code = await requestPairingCode(cleanPhone);

    return res.json({
      success: true,
      phone: cleanPhone,
      code,
      message: "Enter this code in WhatsApp Linked Devices."
    });
  } catch (error) {
    console.error("Pairing error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Unable to generate pairing code"
    });
  }
});

router.get("/status/:phone", (req, res) => {
  const phone = String(req.params.phone).replace(/\D/g, "");

  const socket = getSocket(phone);

  return res.json({
    success: true,
    phone,
    connected: Boolean(socket)
  });
});

module.exports = router;
