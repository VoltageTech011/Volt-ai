module.exports = {
  name: 'ping',
  aliases: ['p', 'speed'],

  async execute(sock, m) {
    const start = Date.now();

    const sent = await m.reply('Testing Voltage...');

    const latency = Date.now() - start;

    await m.reply(
      `⚡ *VOLTAGE ONLINE*\n\n` +
      `Response: ${latency}ms\n` +
      `User: ${m.pushName}\n` +
      `Number: ${m.senderNumber}\n` +
      `Mode: ${m.isGroup ? 'Group' : 'Private'}`
    );
  }
};
