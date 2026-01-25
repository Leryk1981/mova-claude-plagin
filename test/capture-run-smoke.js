#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const toolPath = path.join(ROOT, 'tools', 'capture_run_v0.mjs');
const episodesTool = path.join(ROOT, 'tools', 'capture_run_to_episodes_v0.mjs');
const patternsTool = path.join(ROOT, 'tools', 'analyze_patterns_basic_v0.mjs');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCapture() {
  const cmd = "node -e \"console.log('ok')\"";
  const result = spawnSync('node', [toolPath, '--cmd', cmd], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`capture_run_v0 failed: ${result.stderr || result.stdout}`);
  }

  const output = (result.stdout || '').trim();
  if (output.length > 0) {
    return output;
  }

  const captureDir = path.join(ROOT, 'artifacts', 'capture_run');
  const entries = fs.existsSync(captureDir) ? fs.readdirSync(captureDir) : [];
  assert(entries.length > 0, 'expected artifacts/capture_run directory to exist');
  const latest = entries
    .map((name) => ({
      name,
      mtime: fs.statSync(path.join(captureDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime)[0];
  assert(latest, 'expected capture_run artifacts to exist');
  return path.join(captureDir, latest.name);
}

function readEvents(eventsPath) {
  const lines = fs.readFileSync(eventsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function scanForSecrets(text) {
  const patterns = [
    /bearer\s+(?!\[REDACTED_LEN:)[A-Za-z0-9._-]{8,}/i,
    /(token|password|secret|key|authorization)\s*[:=]\s*(?!\[REDACTED_LEN:)[^\s]+/i
  ];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return pattern.toString();
    }
  }
  return null;
}

function run() {
  const artifactDir = runCapture();
  const episodesResult = spawnSync('node', [episodesTool, '--run-dir', artifactDir], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (episodesResult.status !== 0) {
    throw new Error(`capture_run_to_episodes_v0 failed: ${episodesResult.stderr || episodesResult.stdout}`);
  }
  const patternsResult = spawnSync('node', [patternsTool, '--run-dir', artifactDir], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (patternsResult.status !== 0) {
    throw new Error(`analyze_patterns_basic_v0 failed: ${patternsResult.stderr || patternsResult.stdout}`);
  }

  const requiredFiles = [
    'env.json',
    'events.jsonl',
    'hashes.json',
    'stdout_tail.txt',
    'stderr_tail.txt',
    'repo_before.json',
    'repo_after.json',
    'repo_diff.patch'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(artifactDir, file);
    assert(fs.existsSync(filePath), `missing required file: ${file}`);
  }

  const events = readEvents(path.join(artifactDir, 'events.jsonl'));
  const types = events.map((event) => event.type);
  const expectedOrder = [
    'run_start',
    'repo_snapshot_before',
    'command_started',
    'command_finished',
    'repo_snapshot_after',
    'run_finish'
  ];

  assert(types.length >= expectedOrder.length, 'events.jsonl missing required events');
  for (let i = 0; i < expectedOrder.length; i += 1) {
    assert(types[i] === expectedOrder[i], `event order mismatch at ${i}: ${types[i]} != ${expectedOrder[i]}`);
  }

  const hashes = JSON.parse(fs.readFileSync(path.join(artifactDir, 'hashes.json'), 'utf8'));
  const shaRe = /^[a-f0-9]{64}$/;
  assert(shaRe.test(hashes.stdout_tail_hash), 'stdout_tail_hash invalid');
  assert(shaRe.test(hashes.stderr_tail_hash), 'stderr_tail_hash invalid');
  assert(shaRe.test(hashes.env_hash), 'env_hash invalid');
  assert(shaRe.test(hashes.repo_diff_hash), 'repo_diff_hash invalid');

  const files = fs.readdirSync(artifactDir);
  for (const file of files) {
    const fullPath = path.join(artifactDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const hit = scanForSecrets(content);
    assert(!hit, `secret pattern detected in ${file}: ${hit}`);
  }

  const episodesPath = path.join(artifactDir, 'episodes', 'episodes.jsonl');
  assert(fs.existsSync(episodesPath), 'episodes.jsonl not found');
  const episodes = readEvents(episodesPath);
  const episodeKinds = episodes.map((ep) => ep.kind);
  assert(episodeKinds.includes('EP.RUN_START'), 'missing EP.RUN_START');
  assert(episodeKinds.includes('EP.RUN_FINISH'), 'missing EP.RUN_FINISH');
  if (fs.existsSync(path.join(artifactDir, 'repo_diff.patch'))) {
    assert(episodeKinds.includes('EP.REPO_DIFF'), 'missing EP.REPO_DIFF');
  }
  const patternsPath = path.join(artifactDir, 'patterns', 'patterns.json');
  assert(fs.existsSync(patternsPath), 'patterns.json not found');
  const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
  assert(patterns.patterns && patterns.patterns[0], 'patterns missing');
  assert(patterns.patterns[0].kind === 'PATTERN.SEQUENCE', 'pattern kind mismatch');

  console.log(`[PASS] capture_run_v0 smoke test -> ${artifactDir}`);
}

run();
