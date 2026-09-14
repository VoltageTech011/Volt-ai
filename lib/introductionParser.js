function clean(value = '') {
  return String(value)
    .replace(/[*_~`]/g, '')
    .trim();
}

function parseIntroduction(text = '') {
  const result = {};

  const patterns = {
    name: /(?:name)\s*[:=-]\s*(.+)/i,
    age: /(?:age)\s*[:=-]\s*(\d{1,3})/i,
    role: /(?:role|occupation|work)\s*[:=-]\s*(.+)/i,
    alias: /(?:alias|nickname|nick\s*name)\s*[:=-]\s*(.+)/i
  };

  for (const [key, regex] of Object.entries(patterns)) {
    const match = String(text).match(regex);

    if (match?.[1]) {
      result[key] = clean(match[1]);
    }
  }

  if (result.age) {
    result.age = Number(result.age);

    if (
      result.age < 5 ||
      result.age > 100
    ) {
      delete result.age;
    }
  }

  const valid =
    !!result.name &&
    !!result.age &&
    !!result.role &&
    !!result.alias;

  return {
    valid,
    ...result
  };
}

module.exports = {
  parseIntroduction
};
