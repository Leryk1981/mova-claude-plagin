const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { sha256Hex } = require('./sha256');

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || '').trim() };
  }
  return { ok: true, stdout: (result.stdout || '').trimEnd() };
}

function parseStatusSummary(statusText) {
  const lines = statusText.split(/\r?\n/).filter(Boolean);
  const summary = {
    changed_files: lines.length,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    untracked: 0
  };

  for (const line of lines) {
    const code = line.slice(0, 2);
    if (code.includes('A')) summary.added += 1;
    if (code.includes('M')) summary.modified += 1;
    if (code.includes('D')) summary.deleted += 1;
    if (code.includes('R')) summary.renamed += 1;
    if (code === '??') summary.untracked += 1;
  }

  return summary;
}

function isGitRepo(cwd) {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], cwd);
  return result.ok && result.stdout === 'true';
}

function captureGitSnapshot(cwd, outputs) {
  if (!isGitRepo(cwd)) {
    return { isGit: false, reason: 'NOT_A_GIT_REPO' };
  }

  const head = runGit(['rev-parse', 'HEAD'], cwd).stdout;
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd).stdout;
  const status = runGit(['status', '--porcelain'], cwd).stdout || '';
  const diff = runGit(['diff'], cwd).stdout || '';
  const diffHash = sha256Hex(diff);

  if (outputs?.statusPath) {
    fs.writeFileSync(outputs.statusPath, status + (status ? '\n' : ''), 'utf8');
  }
  if (outputs?.diffPath) {
    fs.writeFileSync(outputs.diffPath, diff, 'utf8');
  }

  return {
    isGit: true,
    snapshot: {
      head,
      branch,
      status_summary: parseStatusSummary(status),
      diff_hash: diffHash
    },
    statusText: status,
    diffText: diff,
    diffHash
  };
}

function writeRepoSnapshot(path, snapshot) {
  fs.writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
}

module.exports = {
  captureGitSnapshot,
  writeRepoSnapshot
};
