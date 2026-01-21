#!/usr/bin/env node
/**
 * MOVA Episode Writer
 * Writes episodes in MOVA 4.1.1 format with correlation and tracing
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

class EpisodeWriter {
  constructor(options = {}) {
    this.episodesDir = options.episodesDir || path.join(PROJECT_DIR, '.mova', 'episodes');
    this.sessionId = options.sessionId || null;
    this.correlationId = options.correlationId || null;
    this.traceId = options.traceId || null;
    this.otelEnabled = options.otelEnabled || false;
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  generateId(prefix) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  getSessionId() {
    if (this.sessionId) return this.sessionId;

    const currentPath = path.join(this.episodesDir, '.current_session_id');
    if (fs.existsSync(currentPath)) {
      this.sessionId = fs.readFileSync(currentPath, 'utf8').trim();
      return this.sessionId;
    }

    this.sessionId = this.generateId('sess');
    this.ensureDir(this.episodesDir);
    fs.writeFileSync(currentPath, this.sessionId, 'utf8');
    return this.sessionId;
  }

  getCorrelationId() {
    if (this.correlationId) return this.correlationId;

    const currentPath = path.join(this.episodesDir, '.correlation_id');
    if (fs.existsSync(currentPath)) {
      this.correlationId = fs.readFileSync(currentPath, 'utf8').trim();
      return this.correlationId;
    }

    this.correlationId = `corr_${crypto.randomUUID()}`;
    this.ensureDir(this.episodesDir);
    fs.writeFileSync(currentPath, this.correlationId, 'utf8');
    return this.correlationId;
  }

  getTraceId() {
    if (this.traceId) return this.traceId;
    this.traceId = process.env.MOVA_TRACE_ID || this.generateId('trace');
    return this.traceId;
  }

  getSessionDir() {
    const sessionId = this.getSessionId();
    const sessionDir = path.join(this.episodesDir, sessionId);
    this.ensureDir(sessionDir);
    return sessionDir;
  }

  validateEpisode(episode) {
    const required = ['episode_id', 'episode_type', 'mova_version', 'recorded_at', 'executor', 'result_status', 'result_summary'];
    for (const field of required) {
      if (!episode[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const validTypes = ['execution', 'plan', 'security_event', 'other'];
    if (!validTypes.includes(episode.episode_type)) {
      throw new Error(`Invalid episode_type: ${episode.episode_type}`);
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'partial', 'cancelled', 'skipped'];
    if (!validStatuses.includes(episode.result_status)) {
      throw new Error(`Invalid result_status: ${episode.result_status}`);
    }

    return true;
  }

  createEpisode(options) {
    const now = new Date().toISOString();

    const episode = {
      episode_id: options.episode_id || this.generateId('ep'),
      episode_type: options.episode_type || 'execution',
      mova_version: '4.1.1',
      recorded_at: now,
      started_at: options.started_at || now,
      executor: options.executor || {
        executor_id: 'claude-code',
        role: 'agent',
        executor_kind: 'AI model'
      },
      result_status: options.result_status || 'completed',
      result_summary: options.result_summary || '',
      result_details: options.result_details || {},
      meta_episode: {
        correlation_id: this.getCorrelationId(),
        session_id: this.getSessionId(),
        parent_episode_id: options.parent_episode_id || null,
        trace_id: this.getTraceId()
      }
    };

    if (options.finished_at) {
      episode.finished_at = options.finished_at;
    }

    if (options.security_event) {
      episode.security_event = options.security_event;
    }

    if (options.compliance) {
      episode.compliance = options.compliance;
    }

    return episode;
  }

  writeEpisode(episode) {
    this.validateEpisode(episode);

    const sessionDir = this.getSessionDir();
    const eventsPath = path.join(sessionDir, 'events.jsonl');

    // Add meta_episode if not present
    if (!episode.meta_episode) {
      episode.meta_episode = {
        correlation_id: this.getCorrelationId(),
        session_id: this.getSessionId(),
        parent_episode_id: null,
        trace_id: this.getTraceId()
      };
    }

    const line = JSON.stringify(episode);
    fs.appendFileSync(eventsPath, line + '\n', 'utf8');

    // Update index
    this.updateIndex(episode);

    // Export to OTEL if enabled
    if (this.otelEnabled) {
      this.exportToOtel(episode);
    }

    return episode.episode_id;
  }

  writeSecurityEvent(options) {
    const episode = this.createEpisode({
      episode_type: 'security_event',
      executor: {
        executor_id: options.detector || 'mova-security',
        role: 'validator',
        executor_kind: 'service'
      },
      result_status: options.blocked ? 'failed' : 'completed',
      result_summary: options.details || options.event_type,
      security_event: {
        event_type: options.event_type,
        severity: options.severity,
        actions_taken: options.actions || [],
        detection_confidence: options.confidence || 1.0,
        rule_id: options.rule_id || null
      }
    });

    return this.writeEpisode(episode);
  }

  updateIndex(episode) {
    const indexPath = path.join(this.episodesDir, 'index.jsonl');
    const entry = {
      ts: episode.recorded_at,
      session_id: episode.meta_episode?.session_id || this.getSessionId(),
      episode_id: episode.episode_id,
      episode_type: episode.episode_type,
      result_status: episode.result_status
    };

    if (episode.result_details?.tool_name) {
      entry.tool = episode.result_details.tool_name;
    }

    fs.appendFileSync(indexPath, JSON.stringify(entry) + '\n', 'utf8');
  }

  exportToOtel(episode) {
    // Delegate to otel_exporter if available
    try {
      const OtelExporter = require('./otel_exporter');
      const exporter = new OtelExporter();
      exporter.exportEpisode(episode);
    } catch {
      // OTEL exporter not available or failed
    }
  }

  readEpisodes(limit = 100) {
    const sessionDir = this.getSessionDir();
    const eventsPath = path.join(sessionDir, 'events.jsonl');

    if (!fs.existsSync(eventsPath)) {
      return [];
    }

    const lines = fs.readFileSync(eventsPath, 'utf8')
      .split('\n')
      .filter(Boolean);

    const episodes = [];
    for (const line of lines.slice(-limit)) {
      try {
        episodes.push(JSON.parse(line));
      } catch {
        // Skip invalid lines
      }
    }

    return episodes;
  }

  getSummary() {
    const sessionDir = this.getSessionDir();
    const summaryPath = path.join(sessionDir, 'summary.json');

    if (fs.existsSync(summaryPath)) {
      return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    }

    return null;
  }

  finalize() {
    const episodes = this.readEpisodes(10000);
    const now = new Date().toISOString();

    const summary = {
      session_id: this.getSessionId(),
      correlation_id: this.getCorrelationId(),
      started_at: episodes[0]?.recorded_at || now,
      finished_at: now,
      total_episodes: episodes.length,
      episodes_by_type: {},
      episodes_by_status: {},
      tools_used: {},
      security_events: {
        total: 0,
        by_severity: {},
        by_type: {}
      },
      duration_ms: 0,
      errors: 0
    };

    for (const ep of episodes) {
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
    if (episodes.length > 0 && episodes[0].recorded_at) {
      summary.duration_ms = new Date(now) - new Date(episodes[0].recorded_at);
    }

    // Write summary
    const sessionDir = this.getSessionDir();
    fs.writeFileSync(
      path.join(sessionDir, 'summary.json'),
      JSON.stringify(summary, null, 2),
      'utf8'
    );

    // Update index with session end
    fs.appendFileSync(
      path.join(this.episodesDir, 'index.jsonl'),
      JSON.stringify({
        ts: now,
        session_id: this.getSessionId(),
        event: 'session_end',
        episodes: episodes.length,
        duration_ms: summary.duration_ms
      }) + '\n',
      'utf8'
    );

    // Clean up current session markers
    const currentSessionPath = path.join(this.episodesDir, '.current_session_id');
    const correlationPath = path.join(this.episodesDir, '.correlation_id');

    try { fs.unlinkSync(currentSessionPath); } catch {}
    try { fs.unlinkSync(correlationPath); } catch {}

    return summary;
  }
}

// CLI interface
function main() {
  const [command, ...args] = process.argv.slice(2);
  const writer = new EpisodeWriter();

  switch (command) {
    case 'init':
      writer.getSessionId();
      console.log(`Session: ${writer.sessionId}`);
      console.log(`Correlation: ${writer.getCorrelationId()}`);
      break;

    case 'write':
      const episode = writer.createEpisode({
        result_summary: args.join(' ') || 'Manual episode'
      });
      writer.writeEpisode(episode);
      console.log(`Written: ${episode.episode_id}`);
      break;

    case 'read':
      const limit = parseInt(args[0]) || 10;
      const episodes = writer.readEpisodes(limit);
      console.log(JSON.stringify(episodes, null, 2));
      break;

    case 'summary':
      const summary = writer.getSummary();
      if (summary) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        console.log('No summary available');
      }
      break;

    case 'finalize':
      const finalSummary = writer.finalize();
      console.log(JSON.stringify(finalSummary, null, 2));
      break;

    default:
      console.log('Usage: episode_writer.js <init|write|read|summary|finalize> [args]');
  }
}

module.exports = EpisodeWriter;

if (require.main === module) {
  main();
}
