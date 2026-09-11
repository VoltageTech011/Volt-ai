function classifyMessage(message) {
  const text = String(message || "").trim().toLowerCase();

  if (!text) {
    return "text";
  }

  const searchPatterns = [
    /\b(latest|today|currently|current|recent|news|weather|price|stock|score|trending)\b/,
    /\b(search|look up|find online|google)\b/,
    /\b(who is|what happened)\b/
  ];

  const reasoningPatterns = [
    /\b(analyze|analyse|analysis|reason|reasoning|logic|calculate|calculation)\b/,
    /\b(prove|solve|debug|debugging|why does|why is|why would)\b/,
    /\b(step by step|think through|deeply)\b/
  ];

  const codingPatterns = [
    /\b(code|coding|program|programming|javascript|python|node|nodejs|react|html|css|api|function|class|database|sql|mongodb|express)\b/,
    /\b(build|create|implement|refactor)\b.*\b(app|bot|api|function|script|website|code)\b/
  ];

  if (searchPatterns.some(pattern => pattern.test(text))) {
    return "search";
  }

  if (reasoningPatterns.some(pattern => pattern.test(text))) {
    return "reasoning";
  }

  if (codingPatterns.some(pattern => pattern.test(text))) {
    return "model";
  }

  return "text";
}

module.exports = {
  classifyMessage
};
