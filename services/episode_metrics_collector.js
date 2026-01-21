#!/usr/bin/env node
/**
 * MOVA Episode Metrics Collector
 * Aggregates and displays metrics from episodes
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

class EpisodeMetricsCollector {
  constructor(options = {}) {
    this.episodesDir = options.episodesDir || path.join(PROJECT_DIR, '.mova', 'episodes');
  }

  // Get all sessions
  getSessions() {
    if (!fs.existsSync(this.episodesDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.episodesDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && e.name.startsWith('sess_'))
      .map(e => e.name)
      .sort()
      .reverse();
  }

  // Get session summary
  getSessionSummary(sessionId) {
    const summaryPath = path.join(this.episodesDir, sessionId, 'summary.json');
    if (fs.existsSync(summaryPath)) {
      return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    }
    return null;
  }

  // Get session episodes
  getSessionEpisodes(sessionId, limit = 1000) {
    const eventsPath = path.join(this.episodesDir, sessionId, 'events.jsonl');
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

  // Aggregate metrics across all sessions
  aggregateMetrics(sessionLimit = 10) {
    const sessions = this.getSessions().slice(0, sessionLimit);
    const aggregate = {
      total_sessions: sessions.length,
      total_episodes: 0,
      total_duration_ms: 0,
      episodes_by_type: {},
      episodes_by_status: {},
      tools_used: {},
      security_events: {
        total: 0,
        by_severity: {},
        by_type: {}
      },
      performance: {
        durations: [],
        avg_duration_ms: 0,
        p95_duration_ms: 0,
        max_duration_ms: 0
      },
      error_rate: 0,
      sessions: []
    };

    let totalErrors = 0;

    for (const sessionId of sessions) {
      const summary = this.getSessionSummary(sessionId);
      if (!summary) continue;

      aggregate.sessions.push({
        session_id: sessionId,
        started_at: summary.started_at,
        finished_at: summary.finished_at,
        episodes: summary.total_episodes,
        duration_ms: summary.duration_ms
      });

      aggregate.total_episodes += summary.total_episodes || 0;
      aggregate.total_duration_ms += summary.duration_ms || 0;

      // Merge episodes by type
      for (const [type, count] of Object.entries(summary.episodes_by_type || {})) {
        aggregate.episodes_by_type[type] = (aggregate.episodes_by_type[type] || 0) + count;
      }

      // Merge episodes by status
      for (const [status, count] of Object.entries(summary.episodes_by_status || {})) {
        aggregate.episodes_by_status[status] = (aggregate.episodes_by_status[status] || 0) + count;
      }

      // Merge tools
      for (const [tool, count] of Object.entries(summary.tools_used || {})) {
        aggregate.tools_used[tool] = (aggregate.tools_used[tool] || 0) + count;
      }

      // Merge security events
      if (summary.security_events) {
        aggregate.security_events.total += summary.security_events.total || 0;
        for (const [sev, count] of Object.entries(summary.security_events.by_severity || {})) {
          aggregate.security_events.by_severity[sev] = (aggregate.security_events.by_severity[sev] || 0) + count;
        }
        for (const [type, count] of Object.entries(summary.security_events.by_type || {})) {
          aggregate.security_events.by_type[type] = (aggregate.security_events.by_type[type] || 0) + count;
        }
      }

      totalErrors += summary.errors || 0;

      // Collect durations for performance stats
      if (summary.duration_ms) {
        aggregate.performance.durations.push(summary.duration_ms);
      }
    }

    // Calculate performance stats
    if (aggregate.performance.durations.length > 0) {
      const sorted = [...aggregate.performance.durations].sort((a, b) => a - b);
      aggregate.performance.avg_duration_ms = Math.round(
        sorted.reduce((a, b) => a + b, 0) / sorted.length
      );
      aggregate.performance.p95_duration_ms = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
      aggregate.performance.max_duration_ms = sorted[sorted.length - 1];
    }

    // Calculate error rate
    if (aggregate.total_episodes > 0) {
      aggregate.error_rate = totalErrors / aggregate.total_episodes;
    }

    // Clean up internal data
    delete aggregate.performance.durations;

    return aggregate;
  }

  // Format as table
  formatTable(metrics) {
    const lines = [];

    lines.push('╔════════════════════════════════════════════════════════════╗');
    lines.push('║                    MOVA Metrics Summary                    ║');
    lines.push('╠════════════════════════════════════════════════════════════╣');

    // Overview
    lines.push(`║ Sessions: ${String(metrics.total_sessions).padEnd(10)} Episodes: ${String(metrics.total_episodes).padEnd(10)} ║`);
    lines.push(`║ Total Duration: ${this.formatDuration(metrics.total_duration_ms).padEnd(40)} ║`);
    lines.push(`║ Error Rate: ${(metrics.error_rate * 100).toFixed(2)}%`.padEnd(61) + '║');

    // Episodes by type
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ Episodes by Type:                                          ║');
    for (const [type, count] of Object.entries(metrics.episodes_by_type)) {
      lines.push(`║   ${type.padEnd(20)} ${String(count).padStart(10)}                       ║`);
    }

    // Tool usage
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ Tool Usage:                                                ║');
    const toolEntries = Object.entries(metrics.tools_used).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [tool, count] of toolEntries) {
      lines.push(`║   ${tool.padEnd(20)} ${String(count).padStart(10)}                       ║`);
    }

    // Security events
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push(`║ Security Events: ${String(metrics.security_events.total).padEnd(40)} ║`);
    for (const [sev, count] of Object.entries(metrics.security_events.by_severity)) {
      const sevDisplay = sev.padEnd(12);
      lines.push(`║   ${sevDisplay} ${String(count).padStart(10)}                       ║`);
    }

    // Performance
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ Performance:                                               ║');
    lines.push(`║   Avg Duration: ${this.formatDuration(metrics.performance.avg_duration_ms).padEnd(40)} ║`);
    lines.push(`║   P95 Duration: ${this.formatDuration(metrics.performance.p95_duration_ms).padEnd(40)} ║`);
    lines.push(`║   Max Duration: ${this.formatDuration(metrics.performance.max_duration_ms).padEnd(40)} ║`);

    // Recent sessions
    lines.push('╠════════════════════════════════════════════════════════════╣');
    lines.push('║ Recent Sessions:                                           ║');
    for (const sess of metrics.sessions.slice(0, 5)) {
      const id = sess.session_id.slice(0, 20).padEnd(20);
      const eps = String(sess.episodes).padStart(5);
      const dur = this.formatDuration(sess.duration_ms).padEnd(15);
      lines.push(`║   ${id} ${eps} eps ${dur}        ║`);
    }

    lines.push('╚════════════════════════════════════════════════════════════╝');

    return lines.join('\n');
  }

  formatDuration(ms) {
    if (!ms) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  // Format debug output
  formatDebug(sessionId, limit = 10) {
    const episodes = this.getSessionEpisodes(sessionId, limit);
    const lines = [];

    lines.push(`Session: ${sessionId}`);
    lines.push(`Episodes: ${episodes.length}`);
    lines.push('─'.repeat(60));

    for (const ep of episodes) {
      lines.push(JSON.stringify(ep, null, 2));
      lines.push('─'.repeat(60));
    }

    return lines.join('\n');
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const collector = new EpisodeMetricsCollector();

  // Parse arguments
  let format = 'table';
  let debug = false;
  let tail = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (args[i] === '--debug') {
      debug = true;
    } else if (args[i] === '--tail' && args[i + 1]) {
      tail = parseInt(args[++i]) || 10;
    }
  }

  if (debug) {
    const sessions = collector.getSessions();
    if (sessions.length > 0) {
      console.log(collector.formatDebug(sessions[0], tail));
    } else {
      console.log('No sessions found');
    }
    return;
  }

  const metrics = collector.aggregateMetrics();

  switch (format) {
    case 'json':
      console.log(JSON.stringify(metrics, null, 2));
      break;

    case 'csv':
      console.log('metric,value');
      console.log(`total_sessions,${metrics.total_sessions}`);
      console.log(`total_episodes,${metrics.total_episodes}`);
      console.log(`total_duration_ms,${metrics.total_duration_ms}`);
      console.log(`error_rate,${metrics.error_rate}`);
      console.log(`security_events,${metrics.security_events.total}`);
      break;

    case 'table':
    default:
      console.log(collector.formatTable(metrics));
  }
}

module.exports = EpisodeMetricsCollector;

if (require.main === module) {
  main();
}
