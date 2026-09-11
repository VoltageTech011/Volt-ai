const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  name: process.env.VOLTAGE_NAME || "Voltage",
  port: Number(process.env.PORT) || 3000,
  environment: process.env.NODE_ENV || "development"
};
