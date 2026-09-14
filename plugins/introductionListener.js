const groupMemory = require('../lib/groupMemory');
const { parseIntroduction } = require('../lib/introductionParser');

module.exports = {
  name: 'introduction-listener',

  async onMessage(sock, m) {
    if (!m.isGroup || !m.body) return false;

    const parsed = parseIntroduction(m.body);

    if (!parsed.valid) return false;

    const member = groupMemory.getMember(
      m.from,
      m.sender
    );

    if (!member) {
      groupMemory.ensureMember(
        m.from,
        m.sender,
        {
          name: m.pushName
        }
      );
    }

    groupMemory.markIntroduced(
      m.from,
      m.sender,
      {
        name: parsed.name,
        age: parsed.age,
        role: parsed.role,
        alias: parsed.alias
      }
    );

    await m.reply(
      `⚡ *INTRODUCTION SAVED*\n\n` +
      `Name: ${parsed.name}\n` +
      `Age: ${parsed.age}\n` +
      `Role: ${parsed.role}\n` +
      `Alias: ${parsed.alias}\n\n` +
      `You're officially registered in my memory, @${m.senderNumber}.`,
      {
        mentions: [m.sender]
      }
    );

    return true;
  }
};
