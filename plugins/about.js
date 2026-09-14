module.exports = {
  name: 'about',
  aliases: ['voltage', 'botinfo'],

  async execute(sock, m) {
    await m.reply(
      `⚡ *VOLTAGE*\n\n` +
      `Version: ${global.VOLTAGE_VERSION}\n` +
      `Mode: ${global.VOLTAGE_MODE}\n` +
      `Prefix: ${global.BOT_PREFIX}\n\n` +
      `Built by ${global.OWNER_NAME || 'Voltage Lord'}.\n` +
      `The brain is still being upgraded.`
    );
  }
};
