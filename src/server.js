const express = require("express");
const path = require("path");

const config = require("./config");
const healthRoute = require("./routes/health");
const whatsappRoute = require("./routes/whatsapp");

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

app.use(express.static(
  path.join(__dirname, "../public")
));

app.use("/api/health", healthRoute);
app.use("/api/whatsapp", whatsappRoute);

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../public/index.html"
    )
  );
});

app.get("/api", (req, res) => {
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
      success: false,
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

    console.log(
      "Voltage pairing dashboard is ready."
    );
  }
);

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
      processconst express = require("express");
const path = require("path");

const config = require("./config");
const healthRoute = require("./routes/health");
const whatsappRoute = require("./routes/whatsapp");

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

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/health", healthRoute);
app.use("/api/whatsapp", whatsappRoute);

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    error: "Internal server error"
  });
});

const server = app.listen(
  config.port,
  "0.0.0.0",
  () => {
    console.log("================================");
    console.log("⚡ VOLTAGE AI");
    console.log("================================");
    console.log(
      `Server running on port ${config.port}`
    );
    console.log(
      `Mode: ${config.mode || "private"}`
    );
    console.log(
      `Version: ${config.version || "1.0.0"}`
    );
    console.log(
      "WhatsApp: Waiting for pairing request"
    );
    console.log("================================");
  }
);

function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down Voltage...`
  );

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});
