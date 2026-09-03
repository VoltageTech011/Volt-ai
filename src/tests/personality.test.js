const personality = require('../ai/personality');
const { buildPromptContext } = require('../ai/context');

function runPersonalityTests() {
  console.log('--- RUNNING VOLTAGE PERSONALITY TESTS ---\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // Test 1: Identity Integrity
  assert(personality.name === 'Voltage', 'Identity: Correct name defined');
  assert(personality.creator === 'My owner/creator', 'Identity: Creator reference intact');
  assert(personality.type.includes('experimental text AI'), 'Identity: Correct AI type');

  // Test 2: Rules and Boundaries
  assert(personality.behaviorRules.length >= 5, 'Rules: Comprehensive behavior rules present');
  assert(
    personality.behaviorRules.some(rule => rule.includes('human')),
    'Rules: Explicit rule against claiming human identity'
  );

  // Test 3: System Prompt Generation
  const prompt = personality.getSystemPrompt();
  assert(prompt.includes('Voltage'), 'System Prompt: Contains AI name');
  assert(prompt.includes(personality.creator), 'System Prompt: Contains creator reference');

  // Test 4: Context Building
  const history = [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hey there!' }];
  const fullContext = buildPromptContext(history, "What is your name?");
  
  assert(fullContext.includes('System: Your name is Voltage.'), 'Context: System prompt included');
  assert(fullContext.includes('User: Hi'), 'Context: History correctly formatted');
  assert(fullContext.endsWith('Voltage:'), 'Context: Formatted for response continuation');

  console.log(`\nResults: ${passed}/${total} tests passed.\n-----------------------------------------`);
}

runPersonalityTests();
