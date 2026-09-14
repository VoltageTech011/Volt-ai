module.exports = {
  name: 'ping',
  aliases: ['p'],

  async execute(sock, m) {
    const start = Date.now();

    const message = await m.reply(
      '⚡ Voltage is online...'
    );

    const latency = Date.now() - start;

    await m.reply(
      `⚡ PONG\n\nLatency: ${latency}ms\nStatus: ONLINE`
    );
  }
};
