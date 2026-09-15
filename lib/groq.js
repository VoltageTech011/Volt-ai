const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function askGroq(messages = [], options = {}) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_completion_tokens: options.maxTokens ?? 2048,
      reasoning_effort: options.reasoningEffort || 'high',
      stream: false
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Groq request failed with status ${response.status}`
    );
  }

  const choice = data?.choices?.[0];

  if (!choice) {
    throw new Error('Groq returned no response');
  }

  return {
    text: choice.message?.content || '',
    model: data.model || GROQ_MODEL,
    usage: data.usage || null,
    raw: data
  };
}

async function groqText(prompt, options = {}) {
  return askGroq(
    [
      {
        role: 'user',
        content: String(prompt)
      }
    ],
    options
  );
}

async function groqReason(messages = [], options = {}) {
  return askGroq(messages, {
    ...options,
    reasoningEffort: options.reasoningEffort || 'high'
  });
}

module.exports = {
  GROQ_MODEL,
  GROQ_URL,
  askGroq,
  groqText,
  groqReason
};
