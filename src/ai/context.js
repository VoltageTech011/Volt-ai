const personality = require('./personality');


function buildPromptContext(conversationHistory = [], userMessage = '') {
  const systemPrompt = personality.getSystemPrompt();
  
  let formattedHistory = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'User' : personality.name}: ${msg.content}`)
    .join('\n');

  if (formattedHistory.length > 0) {
    formattedHistory += '\n';
  }

  const currentMessage = `User: ${userMessage}\n${personality.name}:`;

  return `${systemPrompt}\n\n${formattedHistory}${currentMessage}`;
}

module.exports = {
  buildPromptContext
};
