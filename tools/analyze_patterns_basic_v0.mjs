import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { stableStringify } = require('../src/capture_run/stable_stringify');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--run-dir') {
      args.runDir = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonLines(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function buildPatterns(episodes) {
  const kinds = episodes.map((ep) => ep.kind).filter(Boolean);
  const hasRepoDiff = kinds.includes('EP.REPO_DIFF');
  const cmdFail = episodes.some((ep) => ep.kind === 'EP.CMD_FINISHED' && Number(ep.outcome?.exit_code) !== 0);
  const signature = ['EP.RUN_START', 'EP.CMD_FINISHED', 'EP.RUN_FINISH'].slice();

  const patterns = [
    {
      pattern_id: 'p1',
      kind: 'PATTERN.SEQUENCE',
      signature,
      counts: {
        seen: 1,
        cmd_fail: cmdFail ? 1 : 0,
        repo_diff: hasRepoDiff ? 1 : 0
      },
      score: {
        confidence: 0.7,
        stability: 0.6
      }
    }
  ];

  return patterns.sort((a, b) => a.pattern_id.localeCompare(b.pattern_id));
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.runDir) {
    console.error('Missing required --run-dir argument');
    process.exit(1);
  }

  const absRunDir = path.resolve(args.runDir);
  const episodesPath = path.join(absRunDir, 'episodes', 'episodes.jsonl');
  if (!fs.existsSync(episodesPath)) {
    console.error(`episodes.jsonl not found: ${episodesPath}`);
    process.exit(1);
  }

  const episodes = readJsonLines(episodesPath);
  const runId = episodes[0]?.run_id || path.basename(absRunDir);
  const patterns = buildPatterns(episodes);

  const patternsDir = path.join(absRunDir, 'patterns');
  ensureDir(patternsDir);

  const coreOutput = {
    run_id: runId,
    patterns
  };
  const corePath = path.join(patternsDir, 'patterns_core.json');
  fs.writeFileSync(corePath, stableStringify(coreOutput) + '\n', 'utf8');

  const output = {
    run_id: runId,
    generated_at_ms: Date.now(),
    patterns
  };

  const outputPath = path.join(patternsDir, 'patterns.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(outputPath);
}

main();
