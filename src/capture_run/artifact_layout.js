const path = require('node:path');
const fs = require('node:fs');

function buildArtifactLayout(rootDir, runId) {
  const baseDir = path.join(rootDir, 'artifacts', 'capture_run', runId);
  const paths = {
    baseDir,
    env: path.join(baseDir, 'env.json'),
    events: path.join(baseDir, 'events.jsonl'),
    hashes: path.join(baseDir, 'hashes.json'),
    stdoutTail: path.join(baseDir, 'stdout_tail.txt'),
    stderrTail: path.join(baseDir, 'stderr_tail.txt'),
    stdoutFull: path.join(baseDir, 'stdout_full.txt'),
    stderrFull: path.join(baseDir, 'stderr_full.txt'),
    redactionReport: path.join(baseDir, 'redaction_report.json'),
    repoBefore: path.join(baseDir, 'repo_before.json'),
    repoAfter: path.join(baseDir, 'repo_after.json'),
    repoDiff: path.join(baseDir, 'repo_diff.patch'),
    repoStatusBefore: path.join(baseDir, 'repo_status_before.txt'),
    repoStatusAfter: path.join(baseDir, 'repo_status_after.txt')
  };

  fs.mkdirSync(baseDir, { recursive: true });
  return { baseDir, paths };
}

module.exports = { buildArtifactLayout };
