const groupMemory = require('./groupMemory');

let schedulerStarted = false;

async function remindGroup(sock, groupId) {
  const group = groupMemory.getGroup(groupId);

  if (!group) return;

  if (group.settings?.introductions === false) {
    return;
  }

  const pending = groupMemory.getUnintroduced(groupId);

  if (!pending.length) return;

  const mentions = pending.map(member => member.id);

  const lines = pending
    .slice(0, 10)
    .map(
      member =>
        `• @${member.number} — ${member.name}`
    );

  let message =
    `⚡ *VOLTAGE REMINDER*\n\n` +
    `The following members still haven't introduced themselves properly:\n\n` +
    lines.join('\n') +
    `\n\nUse this format:\n` +
    `*Name:* Your name\n` +
    `*Age:* Your age\n` +
    `*Role:* What you do\n` +
    `*Alias:* Your nickname`;

  if (pending.length > 10) {
    message +=
      `\n\n+ ${pending.length - 10} more pending.`;
  }

  try {
    await sock.sendMessage(
      groupId,
      {
        text: message,
        mentions
      }
    );
  } catch (error) {
    console.error(
      `❌ Introduction reminder [${groupId}]:`,
      error.message
    );
  }
}

function startIntroductionScheduler(sock) {
  if (schedulerStarted) return;

  schedulerStarted = true;

  setInterval(
    async () => {
      const groups = groupMemory.getAllGroups();

      for (const groupId of Object.keys(groups)) {
        await remindGroup(sock, groupId);
      }
    },
    60 * 60 * 1000
  );
}

module.exports = {
  startIntroductionScheduler,
  remindGroup
};
