const express = require("express");

const config = require("./config");
const healthRoute = require("./routes/health");
const whatsappRoute = require("./routes/whatsapp");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

app.use("/api/health", healthRoute);
app.use("/api/whatsapp", whatsappRoute);

app.get("/", (req, res) => {
  res.json({
    name: "Voltage AI",
    status: "online",
    owner: "Voltage Lord",
    platform: "WhatsApp",
    runtime: "Node.js"
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Voltage running on port ${config.port}`);
});
