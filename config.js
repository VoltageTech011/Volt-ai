require('dotenv').config();

global.BOT_NAME = process.env.VOLTAGE_NAME || 'Voltage';
global.BOT_PREFIX = process.env.VOLTAGE_PREFIX || '.';

global.VOLTAGE_MODE = process.env.VOLTAGE_MODE || 'private';
global.VOLTAGE_VERSION = process.env.VOLTAGE_VERSION || '1.0.0';

global.OWNER_NAME = process.env.OWNER_NAME || 'Thereal_VoltageLord';

global.owners = (process.env.OWNER_NUMBER || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

global.dev = (process.env.DEV || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

module.exports = {
  botName: global.BOT_NAME,
  prefix: global.BOT_PREFIX,
  mode: global.VOLTAGE_MODE,
  version: global.VOLTAGE_VERSION,
  ownerName: global.OWNER_NAME,
  owners: global.owners,
  dev: global.dev
};
