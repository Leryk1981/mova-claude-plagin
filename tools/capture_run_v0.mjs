import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  generateRunId,
  sha256Hex,
  stableStringify,
  createRedactionReport,
  finalizeRedactionReport,
  redactText,
  captureGitSnapshot,
  writeRepoSnapshot,
  EventWriter,
  buildArtifactLayout
} = require('../src/capture_run');

function parseBool(value, defaultValue) {
  if (value === undefined) return defaultValue;
  const lowered = String(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
  if (['false', '0', 'no', 'n'].includes(lowered)) return false;
  return defaultValue;
}

function parseArgs(argv) {
  const args = { git: true, allowRawLogs: false, stdoutBytes: 4000, stderrBytes: 4000 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cmd') {
      args.cmd = argv[i + 1];
      i += 1;
    } else if (arg === '--cwd') {
      args.cwd = argv[i + 1];
      i += 1;
    } else if (arg === '--git') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.git = parseBool(next, true);
        i += 1;
      } else {
        args.git = true;
      }
    } else if (arg === '--allow-raw-logs') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args.allowRawLogs = parseBool(next, false);
        i += 1;
      } else {
        args.allowRawLogs = true;
      }
    } else if (arg === '--stdout-bytes') {
      args.stdoutBytes = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--stderr-bytes') {
      args.stderrBytes = Number(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

class TailBuffer {
  constructor(maxBytes) {
    this.maxBytes = Math.max(0, maxBytes || 0);
    this.chunks = [];
    this.total = 0;
  }

  add(chunk) {
    if (!chunk || this.maxBytes === 0) return;
    this.chunks.push(chunk);
    this.total += chunk.length;
    while (this.total > this.maxBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift();
      this.total -= removed.length;
    }
  }

  toBuffer() {
    return Buffer.concat(this.chunks);
  }
}

function getToolVersions(cwd) {
  const versions = {};
  const git = spawnSync('git', ['--version'], { cwd, encoding: 'utf8' });
  if (git.status === 0 && git.stdout) {
    versions.git = git.stdout.trim();
  }
  return versions;
}

function ensureNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.cmd) {
    console.error('Missing required --cmd argument');
    process.exit(1);
  }

  const cwd = args.cwd ? path.resolve(args.cwd) : process.cwd();
  const gitEnabled = parseBool(args.git, true);
  const stdoutBytes = ensureNumber(args.stdoutBytes, 4000);
  const stderrBytes = ensureNumber(args.stderrBytes, 4000);

  const runId = generateRunId();
  const { baseDir, paths } = buildArtifactLayout(cwd, runId);

  const report = createRedactionReport();
  const redactedCmd = redactText(args.cmd, 'cmd', report);

  const writer = new EventWriter(paths.events, runId);
  const startedAt = Date.now();

  writer.write('run_start', {
    cwd,
    cmd_redacted: redactedCmd,
    git_enabled: gitEnabled
  });

  let gitBefore = null;
  let gitAfter = null;

  if (gitEnabled) {
    gitBefore = captureGitSnapshot(cwd, { statusPath: paths.repoStatusBefore, diffPath: paths.repoDiff });
    if (gitBefore.isGit) {
      writeRepoSnapshot(paths.repoBefore, gitBefore.snapshot);
      writer.write('repo_snapshot_before', gitBefore.snapshot);
    } else {
      writer.write('repo_snapshot_before', { reason: gitBefore.reason });
    }
  }

  const stdoutTail = new TailBuffer(stdoutBytes);
  const stderrTail = new TailBuffer(stderrBytes);
  const stdoutFull = [];
  const stderrFull = [];

  const child = spawn(args.cmd, {
    cwd,
    shell: true,
    windowsHide: true,
    env: process.env
  });

  writer.write('command_started', { pid: child.pid });

  child.stdout.on('data', (chunk) => {
    stdoutTail.add(chunk);
    if (args.allowRawLogs) stdoutFull.push(chunk);
  });

  child.stderr.on('data', (chunk) => {
    stderrTail.add(chunk);
    if (args.allowRawLogs) stderrFull.push(chunk);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });

  const stdoutTailText = stdoutTail.toBuffer().toString('utf8');
  const stderrTailText = stderrTail.toBuffer().toString('utf8');

  const redactedStdoutTail = redactText(stdoutTailText, 'stdout_tail', report);
  const redactedStderrTail = redactText(stderrTailText, 'stderr_tail', report);

  fs.writeFileSync(paths.stdoutTail, redactedStdoutTail, 'utf8');
  fs.writeFileSync(paths.stderrTail, redactedStderrTail, 'utf8');

  if (args.allowRawLogs) {
    const stdoutFullText = Buffer.concat(stdoutFull).toString('utf8');
    const stderrFullText = Buffer.concat(stderrFull).toString('utf8');
    const redactedStdoutFull = redactText(stdoutFullText, 'stdout_full', report);
    const redactedStderrFull = redactText(stderrFullText, 'stderr_full', report);
    fs.writeFileSync(paths.stdoutFull, redactedStdoutFull, 'utf8');
    fs.writeFileSync(paths.stderrFull, redactedStderrFull, 'utf8');
  }

  const stdoutTailHash = sha256Hex(redactedStdoutTail);
  const stderrTailHash = sha256Hex(redactedStderrTail);

  writer.write('command_finished', {
    exit_code: exitCode,
    stdout_tail_hash: stdoutTailHash,
    stderr_tail_hash: stderrTailHash
  });

  if (gitEnabled) {
    if (gitBefore?.isGit) {
      gitAfter = captureGitSnapshot(cwd, { statusPath: paths.repoStatusAfter, diffPath: paths.repoDiff });
      if (gitAfter.isGit) {
        writeRepoSnapshot(paths.repoAfter, gitAfter.snapshot);
        writer.write('repo_snapshot_after', gitAfter.snapshot);
      } else {
        writer.write('repo_snapshot_after', { reason: gitAfter.reason });
      }
    } else {
      writer.write('repo_snapshot_after', { reason: gitBefore?.reason || 'NOT_A_GIT_REPO' });
    }
  }

  const finishedAt = Date.now();
  const envData = {
    run_id: runId,
    started_at_ms: startedAt,
    finished_at_ms: finishedAt,
    cwd,
    cmd: redactedCmd,
    exit_code: exitCode,
    git_enabled: gitEnabled,
    host: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      node: process.version
    },
    tool_versions: getToolVersions(cwd)
  };

  fs.writeFileSync(paths.env, JSON.stringify(envData, null, 2) + '\n', 'utf8');

  const envHash = sha256Hex(stableStringify(envData));
  const hashes = {
    stdout_tail_hash: stdoutTailHash,
    stderr_tail_hash: stderrTailHash,
    env_hash: envHash
  };

  if (gitAfter?.diffHash) {
    hashes.repo_diff_hash = gitAfter.diffHash;
  } else if (gitBefore?.diffHash) {
    hashes.repo_diff_hash = gitBefore.diffHash;
  }

  fs.writeFileSync(paths.hashes, JSON.stringify(hashes, null, 2) + '\n', 'utf8');

  const finalizedReport = finalizeRedactionReport(report);
  if (finalizedReport.redacted_fields.length > 0) {
    fs.writeFileSync(paths.redactionReport, JSON.stringify(finalizedReport, null, 2) + '\n', 'utf8');
  }

  writer.write('run_finish', {
    exit_code: exitCode,
    artifact_dir: baseDir
  });

  const outputPath = path.join(baseDir, 'run_path.txt');
  fs.writeFileSync(outputPath, baseDir + '\n', 'utf8');
  console.log(baseDir);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
