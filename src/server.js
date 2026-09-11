const express = require("express");

const config = require("./config");
const healthRoute = require("./routes/health");
const whatsappRoute = require("./routes/whatsapp");
const {
  connectWhatsApp
} = require("./whatsapp/connection");

const app = express();

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: false
  })
);

app.use("/api/health", healthRoute);
app.use("/api/whatsapp", whatsappRoute);

app.get("/", (req, res) => {
  res.json({
    name: "Voltage AI",
    status: "online",
    owner: "Voltage Lord",
    platform: "WhatsApp",
    runtime: "Node.js",
    version: config.version,
    mode: config.mode
  });
});

app.use(
  (err, req, res, next) => {
    console.error(
      "Server error:",
      err
    );

    res.status(500).json({
      error: "Internal server error"
    });
  }
);

const server = app.listen(
  config.port,
  "0.0.0.0",
  () => {
    console.log(
      `Voltage running on port ${config.port}`
    );

    startWhatsApp();
  }
);

async function startWhatsApp() {
  try {
    console.log(
      "Starting Voltage WhatsApp..."
    );

    await connectWhatsApp();

    console.log(
      "Voltage WhatsApp initialization complete."
    );
  } catch (error) {
    console.error(
      "Voltage WhatsApp startup error:",
      error
    );

    console.log(
      "The HTTP server will remain online."
    );
  }
}

process.on(
  "SIGTERM",
  () => {
    console.log(
      "SIGTERM received. Shutting down Voltage..."
    );

    server.close(() => {
      process.exit(0);
    });
  }
);

process.on(
  "SIGINT",
  () => {
    console.log(
      "SIGINT received. Shutting down Voltage..."
    );

    server.close(() => {
      process.exit(0);
    });
  }
);
