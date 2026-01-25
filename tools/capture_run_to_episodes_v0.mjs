import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sha256Hex } = require('../src/capture_run/sha256');

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

function mapEventToEpisode(event, index, runDir, patchExists) {
  const base = {
    episode_id: `${event.run_id}_${String(index + 1).padStart(4, '0')}`,
    run_id: event.run_id,
    ts_ms: event.ts_ms,
    refs: {
      event_index: index,
      run_dir: runDir
    },
    hashes: {},
    outcome: {}
  };

  if (event.type === 'run_start') {
    return { ...base, kind: 'EP.RUN_START' };
  }

  if (event.type === 'repo_snapshot_before') {
    if (event.data?.reason === 'NOT_A_GIT_REPO') {
      return { ...base, kind: 'EP.GIT_SKIP', outcome: { git: 'SKIP' } };
    }
    return { ...base, kind: 'EP.REPO_SNAPSHOT_BEFORE', outcome: { git: 'OK' } };
  }

  if (event.type === 'command_finished') {
    if (event.data?.stdout_tail_hash) {
      base.hashes.stdout_tail_hash = event.data.stdout_tail_hash;
    }
    if (event.data?.stderr_tail_hash) {
      base.hashes.stderr_tail_hash = event.data.stderr_tail_hash;
    }
    if (typeof event.data?.exit_code === 'number') {
      base.outcome.exit_code = event.data.exit_code;
    }
    return { ...base, kind: 'EP.CMD_FINISHED' };
  }

  if (event.type === 'repo_snapshot_after') {
    if (event.data?.reason === 'NOT_A_GIT_REPO') {
      return { ...base, kind: 'EP.GIT_SKIP', outcome: { git: 'SKIP' } };
    }
    return { ...base, kind: 'EP.REPO_SNAPSHOT_AFTER', outcome: { git: 'OK' } };
  }

  if (event.type === 'run_finish') {
    if (typeof event.data?.exit_code === 'number') {
      base.outcome.exit_code = event.data.exit_code;
    }
    return { ...base, kind: 'EP.RUN_FINISH' };
  }

  return null;
}

function buildRepoDiffEpisode(runId, tsMs, index, runDir, diffHash) {
  return {
    episode_id: `${runId}_PATCH_${String(index + 1).padStart(4, '0')}`,
    run_id: runId,
    ts_ms: tsMs,
    kind: 'EP.REPO_DIFF',
    refs: {
      event_index: index,
      run_dir: runDir,
      patch_ref: 'repo_diff.patch'
    },
    hashes: {
      repo_diff_hash: diffHash
    },
    outcome: {}
  };
}

function resolveRunDir(dir) {
  return path.resolve(dir);
}

function toRelativeRunDir(absRunDir, cwd) {
  const rel = path.relative(cwd, absRunDir);
  return rel || '.';
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.runDir) {
    console.error('Missing required --run-dir argument');
    process.exit(1);
  }

  const absRunDir = resolveRunDir(args.runDir);
  const eventsPath = path.join(absRunDir, 'events.jsonl');
  if (!fs.existsSync(eventsPath)) {
    console.error(`events.jsonl not found: ${eventsPath}`);
    process.exit(1);
  }

  const events = readJsonLines(eventsPath);
  const runId = events[0]?.run_id || path.basename(absRunDir);
  const repoDiffPath = path.join(absRunDir, 'repo_diff.patch');
  const hasRepoDiff = fs.existsSync(repoDiffPath);
  const diffContent = hasRepoDiff ? fs.readFileSync(repoDiffPath, 'utf8') : '';
  const diffHash = hasRepoDiff ? sha256Hex(diffContent) : null;

  const episodes = [];
  const relRunDir = toRelativeRunDir(absRunDir, process.cwd());

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const mapped = mapEventToEpisode(event, i, relRunDir, hasRepoDiff);
    if (mapped) {
      episodes.push(mapped);
    }

    if (event.type === 'command_finished' && hasRepoDiff) {
      episodes.push(buildRepoDiffEpisode(runId, event.ts_ms, i, relRunDir, diffHash));
    }
  }

  const episodesDir = path.join(absRunDir, 'episodes');
  ensureDir(episodesDir);
  const outputPath = path.join(episodesDir, 'episodes.jsonl');
  const output = episodes.map((ep) => JSON.stringify(ep)).join('\n') + '\n';
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(outputPath);
}

main();
