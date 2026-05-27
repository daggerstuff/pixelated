const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const prompt = readFileSync('.github/commands/gemini-plan-execute.toml', 'utf8');

test('execution prompt requires commit messages from LLM thinking blocks', () => {
  assert.match(prompt, /<thinking>/);
  assert.match(prompt, /first sentence/i);
  assert.match(prompt, /72 characters/i);
  assert.match(prompt, /full thinking/i);
  assert.match(prompt, /missing/i);
  assert.match(prompt, /fallback/i);
});
