require('dotenv').config();

global.BOT_NAME = process.env.VOLTAGE_NAME || 'Voltage';
global.BOT_PREFIX = process.env.VOLTAGE_PREFIX || '.';
global.BOT_VERSION = process.env.VOLTAGE_VERSION || '1.0.0';
global.BOT_MODE = process.env.VOLTAGE_MODE || 'private';

global.OWNER_NUMBER = process.env.OWNER_NUMBER || '';
global.OWNER_NAME = process.env.OWNER_NAME || 'Thereal_VoltageLord';

global.owners = global.OWNER_NUMBER
  ? [global.OWNER_NUMBER]
  : [];

global.dev = [];

global.menuImage = '';

module.exports = {
  botName: global.BOT_NAME,
  prefix: global.BOT_PREFIX,
  version: global.BOT_VERSION,
  mode: global.BOT_MODE,
  ownerNumber: global.OWNER_NUMBER,
  ownerName: global.OWNER_NAME,
  owners: global.owners,
  dev: global.dev,
  port: process.env.PORT || 3000
};
