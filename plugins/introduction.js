const groupMemory = require('../lib/groupMemory');

module.exports = {
  name: 'introduction',
  aliases: ['intro', 'introduce'],

  async execute(sock, m) {
    if (!m.isGroup) {
      return m.reply(
        'This command is only useful inside a group.'
      );
    }

    const member = groupMemory.ensureMember(
      m.from,
      m.sender,
      {
        name: m.pushName
      }
    );

    if (member.introduced) {
      return m.reply(
        `@${m.senderNumber}, you already introduced yourself. I remember you.`,
        {
          mentions: [m.sender]
        }
      );
    }

    await m.reply(
      `@${m.senderNumber}\n\n` +
      `You haven't introduced yourself properly yet.\n\n` +
      `Do it in this format:\n\n` +
      `*Name:* Your real name\n` +
      `*Age:* Your age\n` +
      `*Role:* What you do\n` +
      `*Alias:* Your nickname\n\n` +
      `Don't freestyle it. I need the information properly.`,
      {
        mentions: [m.sender]
      }
    );
  }
};
