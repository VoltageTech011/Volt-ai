const express = require("express");
const router = express.Router();

const {
  connectWhatsApp,
  requestPairingCode
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

    await connectWhatsApp();

    const code = await requestPairingCode(cleanPhone);

    res.json({
      success: true,
      code,
      message: "Enter this code in WhatsApp Linked Devices."
    });
  } catch (error) {
    console.error("Pairing error:", error);

    res.status(500).json({
      success: false,
      error: "Unable to generate pairing code"
    });
  }
});

module.exports = router;
