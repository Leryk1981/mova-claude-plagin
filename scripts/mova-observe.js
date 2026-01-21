#!/usr/bin/env node
/**
 * MOVA Observe - Event collection and episode recording
 * Adapted for plugin architecture with MOVA 4.1.1 episode structure
 * Phase 3: Enhanced with OTEL export and improved correlation
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');

const KEY_RE = /(api[_-]?key|token|secret|password|authorization|bearer)/i;
const INLINE_SECRET_RE = /(sk-[a-zA-Z0-9]{8,})/g;
const PLACEHOLDER_RE = /^\$\{[A-Z0-9_]+(?::-?[^}]+)?\}$/;

const args = process.argv.slice(2);
const isInit = args.includes('--init');
const isFinalize = args.includes('--finalize');

function readArg(name) {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}

function loadControlConfig() {
  try {
    if (fs.existsSync(CONTROL_FILE)) {
      return JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function isOtelEnabled() {
  const config = loadControlConfig();
  return config?.observability?.otel_enabled === true ||
         process.env.MOVA_OTEL_ENABLED === 'true';
}

const config = {
  eventType: readArg('--event') || process.env.CLAUDE_HOOK_EVENT || 'PostToolUse',
  stdoutTailBytes: Number(readArg('--stdout-tail-bytes') || process.env.MOVA_OBS_STDOUT_TAIL_BYTES || 4000),
  stderrTailBytes: Number(readArg('--stderr-tail-bytes') || process.env.MOVA_OBS_STDERR_TAIL_BYTES || 4000),
  maxEventBytes: Number(readArg('--max-event-bytes') || process.env.MOVA_OBS_MAX_EVENT_BYTES || 20000),
  tailLines: Number(readArg('--tail-lines') || process.env.MOVA_OBS_TAIL_LINES || 50),
  outputDir: readArg('--output-dir') || process.env.MOVA_OBS_OUTPUT_DIR || '.mova/episodes'
};

const env = process.env;
const now = new Date();
const iso = now.toISOString();

function generateId(prefix) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(3).toString('hex');
  return `${prefix}_${date}_${random}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getSessionId(root) {
  const currentPath = path.join(root, '.current_session_id');
  if (fs.existsSync(currentPath)) {
    return fs.readFileSync(currentPath, 'utf8').trim();
  }
  const sessionId = generateId('sess');
  ensureDir(root);
  fs.writeFileSync(currentPath, sessionId, 'utf8');
  return sessionId;
}

function getCorrelationId(root) {
  const currentPath = path.join(root, '.correlation_id');
  if (fs.existsSync(currentPath)) {
    return fs.readFileSync(currentPath, 'utf8').trim();
  }
  const correlationId = `session_${crypto.randomUUID()}`;
  ensureDir(root);
  fs.writeFileSync(currentPath, correlationId, 'utf8');
  return correlationId;
}

function tailLinesFn(text, maxLines) {
  const lines = text.split(/\r?\n/);
  return lines.length <= maxLines ? text : lines.slice(-maxLines).join('\n');
}

function tailBytesFn(text, maxBytes) {
  if (!maxBytes || maxBytes <= 0) return '';
  const buf = Buffer.from(text, 'utf8');
  return buf.length <= maxBytes ? text : buf.slice(buf.length - maxBytes).toString('utf8');
}

function trimText(text, maxBytes, maxLines) {
  return tailBytesFn(tailLinesFn(text, maxLines), maxBytes);
}

function redactText(input) {
  let out = input;
  out = out.replace(INLINE_SECRET_RE, '[REDACTED_TOKEN]');
  out = out.replace(/^([A-Z0-9_]{3,80})\s*=\s*(.+)$/gmi, (line, k, v) => {
    if (!KEY_RE.test(k)) return line;
    if (PLACEHOLDER_RE.test(String(v).trim())) return line;
    return `${k}=[REDACTED_VALUE_LEN_${String(v).length}]`;
  });
  return out;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

function mapResultStatus(toolStatus) {
  if (toolStatus === '0' || toolStatus === 0) return 'completed';
  if (toolStatus === undefined || toolStatus === null) return 'in_progress';
  return 'failed';
}

function initSession() {
  const root = path.join(PROJECT_DIR, config.outputDir);
  const sessionId = getSessionId(root);
  const correlationId = getCorrelationId(root);
  const sessionDir = path.join(root, sessionId);

  ensureDir(sessionDir);

  const initEpisode = {
    episode_id: generateId('ep'),
    episode_type: 'execution',
    mova_version: '4.1.1',
    recorded_at: iso,
    started_at: iso,
    executor: {
      executor_id: 'claude-code',
      role: 'agent',
      executor_kind: 'AI model'
    },
    result_status: 'in_progress',
    result_summary: 'Session started',
    meta_episode: {
      correlation_id: correlationId,
      session_id: sessionId,
      parent_episode_id: null,
      trace_id: generateId('trace')
    }
  };

  fs.appendFileSync(path.join(sessionDir, 'events.jsonl'), stableStringify(initEpisode) + '\n', 'utf8');

  process.stdout.write(JSON.stringify({
    feedback: `[MOVA] Session started | ${sessionId}`,
    suppressOutput: true
  }));
}

function finalizeSession() {
  const root = path.join(PROJECT_DIR, config.outputDir);
  const currentPath = path.join(root, '.current_session_id');

  if (!fs.existsSync(currentPath)) {
    process.stdout.write(JSON.stringify({ feedback: '[MOVA] No active session', suppressOutput: true }));
    return;
  }

  const sessionId = fs.readFileSync(currentPath, 'utf8').trim();
  const correlationId = getCorrelationId(root);
  const sessionDir = path.join(root, sessionId);

  // Read all events to calculate summary
  const eventsPath = path.join(sessionDir, 'events.jsonl');
  let events = [];
  if (fs.existsSync(eventsPath)) {
    const lines = fs.readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean);
    events = lines.map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  const summary = {
    session_id: sessionId,
    correlation_id: correlationId,
    started_at: events[0]?.recorded_at || iso,
    finished_at: iso,
    total_episodes: events.length,
    episodes_by_type: {},
    episodes_by_status: {},
    tools_used: {},
    security_events: { total: 0, by_severity: {}, by_type: {} },
    duration_ms: 0,
    errors: 0
  };

  for (const ep of events) {
    // Count by type
    const type = ep.episode_type || 'unknown';
    summary.episodes_by_type[type] = (summary.episodes_by_type[type] || 0) + 1;

    // Count by status
    const status = ep.result_status || 'unknown';
    summary.episodes_by_status[status] = (summary.episodes_by_status[status] || 0) + 1;

    if (status === 'failed') {
      summary.errors++;
    }

    // Count tools
    if (ep.result_details?.tool_name) {
      const tool = ep.result_details.tool_name;
      summary.tools_used[tool] = (summary.tools_used[tool] || 0) + 1;
    }

    // Count security events
    if (ep.security_event) {
      summary.security_events.total++;
      const sev = ep.security_event.severity || 'unknown';
      summary.security_events.by_severity[sev] = (summary.security_events.by_severity[sev] || 0) + 1;

      const evtType = ep.security_event.event_type || 'unknown';
      summary.security_events.by_type[evtType] = (summary.security_events.by_type[evtType] || 0) + 1;
    }
  }

  // Calculate duration
  if (events.length > 0 && events[0].recorded_at) {
    summary.duration_ms = new Date(iso) - new Date(events[0].recorded_at);
  }

  // Write summary
  fs.writeFileSync(path.join(sessionDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  // Update index
  fs.appendFileSync(path.join(root, 'index.jsonl'), stableStringify({
    ts: iso,
    session_id: sessionId,
    event: 'session_end',
    episodes: events.length,
    duration_ms: summary.duration_ms,
    errors: summary.errors
  }) + '\n', 'utf8');

  // Export to OTEL if enabled
  if (isOtelEnabled()) {
    try {
      const OtelExporter = require(path.join(PLUGIN_ROOT, 'services', 'otel_exporter.js'));
      const exporter = new OtelExporter();
      exporter.exportSummary(summary);
    } catch {
      // OTEL export failed, continue silently
    }
  }

  // Clean up current session markers
  try { fs.unlinkSync(currentPath); } catch {}
  try { fs.unlinkSync(path.join(root, '.correlation_id')); } catch {}

  const durationSec = Math.round(summary.duration_ms / 1000);
  const secEvents = summary.security_events.total;
  process.stdout.write(JSON.stringify({
    feedback: `[MOVA] Session ended | ${events.length} events | ${durationSec}s | ${secEvents} security`,
    suppressOutput: true
  }));
}

function recordEpisode() {
  const root = path.join(PROJECT_DIR, config.outputDir);
  const sessionId = getSessionId(root);
  const correlationId = getCorrelationId(root);
  const sessionDir = path.join(root, sessionId);

  ensureDir(sessionDir);

  // Build episode with MOVA 4.1.1 structure
  const episode = {
    episode_id: generateId('ep'),
    episode_type: 'execution',
    mova_version: '4.1.1',
    recorded_at: iso,
    executor: {
      executor_id: 'claude-code',
      role: 'agent',
      executor_kind: 'AI model'
    },
    result_status: mapResultStatus(env.CLAUDE_TOOL_STATUS),
    result_summary: `Tool: ${env.CLAUDE_TOOL_NAME || 'unknown'}`,
    result_details: {
      tool_name: env.CLAUDE_TOOL_NAME || null,
      duration_ms: env.CLAUDE_TOOL_DURATION_MS ? Number(env.CLAUDE_TOOL_DURATION_MS) : null,
      exit_code: env.CLAUDE_TOOL_STATUS ? Number(env.CLAUDE_TOOL_STATUS) : null,
      files_affected: env.CLAUDE_TOOL_INPUT_FILE_PATH ? [env.CLAUDE_TOOL_INPUT_FILE_PATH] : []
    },
    meta_episode: {
      correlation_id: correlationId,
      session_id: sessionId,
      parent_episode_id: null,
      trace_id: env.MOVA_TRACE_ID || null
    }
  };

  // Process stdout/stderr
  const stdoutRaw = env.CLAUDE_TOOL_STDOUT || env.CLAUDE_TOOL_OUTPUT || '';
  const stderrRaw = env.CLAUDE_TOOL_STDERR || '';
  let outputHashPayload = '';

  if (stdoutRaw) {
    const trimmed = trimText(stdoutRaw, config.stdoutTailBytes, config.tailLines);
    const redacted = redactText(trimmed);
    episode.result_details.stdout_tail = redacted;
    outputHashPayload += redacted;
  }

  if (stderrRaw) {
    const trimmed = trimText(stderrRaw, config.stderrTailBytes, config.tailLines);
    const redacted = redactText(trimmed);
    episode.result_details.stderr_tail = redacted;
    outputHashPayload += `\n${redacted}`;
  }

  // Compute hashes
  if (outputHashPayload) {
    episode.result_details.output_hash = sha256(outputHashPayload);
  }

  const inputRaw = env.CLAUDE_TOOL_INPUT || '';
  if (inputRaw) {
    const trimmed = trimText(inputRaw, config.stdoutTailBytes, config.tailLines);
    const redacted = redactText(trimmed);
    episode.result_details.input_hash = sha256(redacted);
  }

  // Write episode
  let line = stableStringify(episode);
  if (line.length > config.maxEventBytes) {
    delete episode.result_details.stdout_tail;
    delete episode.result_details.stderr_tail;
    line = stableStringify(episode);
  }

  fs.appendFileSync(path.join(sessionDir, 'events.jsonl'), line + '\n', 'utf8');

  // Update index
  fs.appendFileSync(path.join(root, 'index.jsonl'), stableStringify({
    ts: iso,
    session_id: sessionId,
    episode_id: episode.episode_id,
    event_type: config.eventType,
    tool: episode.result_details.tool_name,
    status: episode.result_status
  }) + '\n', 'utf8');

  // Export to OTEL if enabled
  if (isOtelEnabled()) {
    try {
      const OtelExporter = require(path.join(PLUGIN_ROOT, 'services', 'otel_exporter.js'));
      const exporter = new OtelExporter();
      exporter.exportEpisode(episode);
    } catch {
      // OTEL export failed, continue silently
    }
  }
}

function main() {
  try {
    if (isInit) {
      initSession();
    } else if (isFinalize) {
      finalizeSession();
    } else {
      recordEpisode();
    }
  } catch (err) {
    process.stdout.write(JSON.stringify({
      feedback: `[MOVA] observe error: ${err.message}`,
      suppressOutput: true
    }));
  }
}

main();
