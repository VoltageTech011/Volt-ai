const express = require("express");
const path = require("path");

const config = require("./config");
const healthRoute = require("./routes/health");

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/health", healthRoute);

app.get("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
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
