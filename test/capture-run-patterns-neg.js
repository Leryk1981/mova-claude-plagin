#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const patternsTool = path.join(ROOT, 'tools', 'analyze_patterns_basic_v0.mjs');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const fakeDir = path.join(ROOT, 'artifacts', 'capture_run', 'missing_run');
  const result = spawnSync('node', [patternsTool, '--run-dir', fakeDir], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert(result.status !== 0, 'expected nonzero exit for missing episodes.jsonl');
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  assert(/episodes\.jsonl not found/i.test(output), 'expected missing episodes.jsonl error');
  console.log('[PASS] capture_run:patterns:neg');
}

run();
