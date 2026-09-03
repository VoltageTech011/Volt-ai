const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'Voltage',
  version: process.env.VERSION || '1.0.0'
};
