require('dotenv').config();

global.BOT_NAME = process.env.BOT_NAME || 'Voltage';
global.BOT_PREFIX = process.env.BOT_PREFIX || '.';

global.owners = (process.env.OWNERS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

global.dev = (process.env.DEV || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

global.menuImage = process.env.MENU_IMAGE || '';

module.exports = {
  botName: global.BOT_NAME,
  prefix: global.BOT_PREFIX,
  owners: global.owners,
  dev: global.dev
};
