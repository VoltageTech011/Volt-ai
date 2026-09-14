const groupMemory = require('../lib/groupMemory');

module.exports = {
  name: 'groupinfo',
  aliases: ['members', 'groupmembers'],

  async execute(sock, m) {
    if (!m.isGroup) {
      return m.reply('This command only works in groups.');
    }

    const group = groupMemory.getGroup(m.from);

    if (!group || !Object.keys(group.members).length) {
      return m.reply(
        'I haven't built enough memory for this group yet.'
      );
    }

    const members = Object.values(group.members);

    const introduced = members.filter(
      member => member.introduced
    ).length;

    const pending = members.length - introduced;

    let text =
      `⚡ *VOLTAGE GROUP MEMORY*\n\n` +
      `Members remembered: ${members.length}\n` +
      `Introduced: ${introduced}\n` +
      `Pending: ${pending}\n\n`;

    for (const member of members.slice(0, 30)) {
      text +=
        `• @${member.number} — ${member.name}\n` +
        `  ${member.introduced ? '✓ Introduced' : '○ Pending'}\n`;
    }

    const mentions = members
      .slice(0, 30)
      .map(member => member.id);

    await m.reply(text, { mentions });
  }
};
