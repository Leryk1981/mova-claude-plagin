#!/usr/bin/env node
/**
 * MOVA Skill Evaluator - Match user prompts to skills
 * Adapted for plugin architecture
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const SKILL_RULES_PATH = path.join(PLUGIN_ROOT, 'config', 'skill-rules.json');

const prompt = process.env.CLAUDE_USER_PROMPT || process.env.CLAUDE_PROMPT || '';

// Default rules if config not available
const defaultRules = {
  threshold: 0.6,
  skills: [
    {
      id: 'testing-patterns',
      keywords: ['test', 'tdd', 'mock', 'coverage', 'jest', 'vitest', 'spec'],
      weight: 0.8
    },
    {
      id: 'systematic-debugging',
      keywords: ['debug', 'trace', 'repro', 'bug', 'error', 'fix', 'issue'],
      weight: 0.7
    },
    {
      id: 'security-basics',
      keywords: ['security', 'vuln', 'xss', 'csrf', 'auth', 'injection', 'sanitize'],
      weight: 0.8
    },
    {
      id: 'git-workflow',
      keywords: ['git', 'branch', 'merge', 'rebase', 'commit', 'push', 'pull'],
      weight: 0.7
    },
    {
      id: 'mova-layer-v0',
      keywords: ['mova', 'observe', 'guard', 'episode', 'hook'],
      weight: 0.9
    }
  ]
};

function loadRules() {
  try {
    if (fs.existsSync(SKILL_RULES_PATH)) {
      return JSON.parse(fs.readFileSync(SKILL_RULES_PATH, 'utf8'));
    }
  } catch {}
  return defaultRules;
}

function evaluateSkill(prompt, rules) {
  const promptLower = prompt.toLowerCase();
  let bestMatch = { id: 'general', score: 0 };

  for (const skill of rules.skills) {
    let matchCount = 0;
    for (const keyword of skill.keywords) {
      if (promptLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const score = (matchCount / skill.keywords.length) * skill.weight;
      if (score > bestMatch.score) {
        bestMatch = { id: skill.id, score };
      }
    }
  }

  // Only return skill if above threshold
  if (bestMatch.score >= rules.threshold) {
    return bestMatch;
  }

  return { id: 'general', score: 0 };
}

function main() {
  const rules = loadRules();
  const result = evaluateSkill(prompt, rules);

  const output = {
    feedback: `[MOVA] skill: ${result.id}${result.score > 0 ? ` (${(result.score * 100).toFixed(0)}%)` : ''}`,
    suppressOutput: true
  };

  // Set environment variable for downstream hooks
  if (result.id !== 'general') {
    output.env = { MOVA_ACTIVE_SKILL: result.id };
  }

  process.stdout.write(JSON.stringify(output));
}

main();
