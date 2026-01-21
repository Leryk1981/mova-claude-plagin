#!/usr/bin/env node
/**
 * MOVA Export Manager
 * Exports episodes and metrics in various formats
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

class ExportManager {
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

  // Read episodes from a session
  getEpisodes(sessionId) {
    const eventsPath = path.join(this.episodesDir, sessionId, 'events.jsonl');
    if (!fs.existsSync(eventsPath)) {
      return [];
    }

    const lines = fs.readFileSync(eventsPath, 'utf8')
      .split('\n')
      .filter(Boolean);

    const episodes = [];
    for (const line of lines) {
      try {
        episodes.push(JSON.parse(line));
      } catch {}
    }

    return episodes;
  }

  // Export to JSONL format
  exportJsonl(sessionIds, outputPath) {
    const sessions = sessionIds || this.getSessions();
    const lines = [];

    for (const sessionId of sessions) {
      const episodes = this.getEpisodes(sessionId);
      for (const ep of episodes) {
        lines.push(JSON.stringify(ep));
      }
    }

    if (outputPath) {
      fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');
      return outputPath;
    }

    return lines.join('\n');
  }

  // Export to CSV format
  exportCsv(sessionIds, outputPath) {
    const sessions = sessionIds || this.getSessions();

    // Define CSV columns
    const columns = [
      'episode_id',
      'episode_type',
      'recorded_at',
      'result_status',
      'result_summary',
      'tool_name',
      'duration_ms',
      'session_id',
      'correlation_id',
      'security_event_type',
      'security_severity'
    ];

    const rows = [columns.join(',')];

    for (const sessionId of sessions) {
      const episodes = this.getEpisodes(sessionId);
      for (const ep of episodes) {
        const row = [
          this.csvEscape(ep.episode_id),
          this.csvEscape(ep.episode_type),
          this.csvEscape(ep.recorded_at),
          this.csvEscape(ep.result_status),
          this.csvEscape(ep.result_summary),
          this.csvEscape(ep.result_details?.tool_name || ''),
          ep.result_details?.duration_ms || '',
          this.csvEscape(ep.meta_episode?.session_id || sessionId),
          this.csvEscape(ep.meta_episode?.correlation_id || ''),
          this.csvEscape(ep.security_event?.event_type || ''),
          this.csvEscape(ep.security_event?.severity || '')
        ];
        rows.push(row.join(','));
      }
    }

    const csv = rows.join('\n');

    if (outputPath) {
      fs.writeFileSync(outputPath, csv + '\n', 'utf8');
      return outputPath;
    }

    return csv;
  }

  // Export summary to JSON
  exportSummary(sessionIds, outputPath) {
    const sessions = sessionIds || this.getSessions();
    const summaries = [];

    for (const sessionId of sessions) {
      const summaryPath = path.join(this.episodesDir, sessionId, 'summary.json');
      if (fs.existsSync(summaryPath)) {
        try {
          const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
          summaries.push(summary);
        } catch {}
      }
    }

    const json = JSON.stringify(summaries, null, 2);

    if (outputPath) {
      fs.writeFileSync(outputPath, json + '\n', 'utf8');
      return outputPath;
    }

    return json;
  }

  // Export security events only
  exportSecurityEvents(sessionIds, format = 'jsonl', outputPath) {
    const sessions = sessionIds || this.getSessions();
    const securityEvents = [];

    for (const sessionId of sessions) {
      const episodes = this.getEpisodes(sessionId);
      for (const ep of episodes) {
        if (ep.security_event) {
          securityEvents.push(ep);
        }
      }
    }

    if (format === 'csv') {
      const columns = [
        'episode_id',
        'recorded_at',
        'event_type',
        'severity',
        'actions_taken',
        'confidence',
        'rule_id',
        'details'
      ];

      const rows = [columns.join(',')];
      for (const ep of securityEvents) {
        const row = [
          this.csvEscape(ep.episode_id),
          this.csvEscape(ep.recorded_at),
          this.csvEscape(ep.security_event.event_type),
          this.csvEscape(ep.security_event.severity),
          this.csvEscape((ep.security_event.actions_taken || []).join(';')),
          ep.security_event.detection_confidence || '',
          this.csvEscape(ep.security_event.rule_id || ''),
          this.csvEscape(ep.result_summary || '')
        ];
        rows.push(row.join(','));
      }

      const csv = rows.join('\n');
      if (outputPath) {
        fs.writeFileSync(outputPath, csv + '\n', 'utf8');
        return outputPath;
      }
      return csv;
    }

    // Default: JSONL
    const lines = securityEvents.map(ep => JSON.stringify(ep));
    const jsonl = lines.join('\n');

    if (outputPath) {
      fs.writeFileSync(outputPath, jsonl + '\n', 'utf8');
      return outputPath;
    }

    return jsonl;
  }

  // Escape CSV value
  csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Generate audit report
  generateAuditReport(sessionIds) {
    const sessions = sessionIds || this.getSessions();
    const report = {
      generated_at: new Date().toISOString(),
      period: {
        from: null,
        to: null
      },
      summary: {
        total_sessions: sessions.length,
        total_episodes: 0,
        total_security_events: 0,
        security_by_severity: {},
        security_by_type: {},
        tools_used: {},
        episodes_by_status: {}
      },
      sessions: []
    };

    for (const sessionId of sessions) {
      const summaryPath = path.join(this.episodesDir, sessionId, 'summary.json');
      if (!fs.existsSync(summaryPath)) continue;

      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

        // Update period
        if (summary.started_at) {
          if (!report.period.from || summary.started_at < report.period.from) {
            report.period.from = summary.started_at;
          }
        }
        if (summary.finished_at) {
          if (!report.period.to || summary.finished_at > report.period.to) {
            report.period.to = summary.finished_at;
          }
        }

        // Aggregate
        report.summary.total_episodes += summary.total_episodes || 0;
        report.summary.total_security_events += summary.security_events?.total || 0;

        // Merge security by severity
        for (const [sev, count] of Object.entries(summary.security_events?.by_severity || {})) {
          report.summary.security_by_severity[sev] = (report.summary.security_by_severity[sev] || 0) + count;
        }

        // Merge security by type
        for (const [type, count] of Object.entries(summary.security_events?.by_type || {})) {
          report.summary.security_by_type[type] = (report.summary.security_by_type[type] || 0) + count;
        }

        // Merge tools
        for (const [tool, count] of Object.entries(summary.tools_used || {})) {
          report.summary.tools_used[tool] = (report.summary.tools_used[tool] || 0) + count;
        }

        // Merge status
        for (const [status, count] of Object.entries(summary.episodes_by_status || {})) {
          report.summary.episodes_by_status[status] = (report.summary.episodes_by_status[status] || 0) + count;
        }

        report.sessions.push({
          session_id: sessionId,
          started_at: summary.started_at,
          finished_at: summary.finished_at,
          episodes: summary.total_episodes,
          security_events: summary.security_events?.total || 0,
          duration_ms: summary.duration_ms
        });
      } catch {}
    }

    return report;
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const manager = new ExportManager();

  // Parse arguments
  let command = args[0];
  let format = 'jsonl';
  let output = null;
  let sessions = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
      format = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[++i];
    } else if (args[i] === '--sessions' && args[i + 1]) {
      sessions = args[++i].split(',');
    }
  }

  switch (command) {
    case 'episodes': {
      if (format === 'csv') {
        console.log(manager.exportCsv(sessions, output));
      } else {
        console.log(manager.exportJsonl(sessions, output));
      }
      break;
    }

    case 'summaries': {
      console.log(manager.exportSummary(sessions, output));
      break;
    }

    case 'security': {
      console.log(manager.exportSecurityEvents(sessions, format, output));
      break;
    }

    case 'audit': {
      const report = manager.generateAuditReport(sessions);
      console.log(JSON.stringify(report, null, 2));
      break;
    }

    default:
      console.log('Usage: export_manager.js <episodes|summaries|security|audit> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  episodes    Export all episodes');
      console.log('  summaries   Export session summaries');
      console.log('  security    Export security events only');
      console.log('  audit       Generate audit report');
      console.log('');
      console.log('Options:');
      console.log('  --format <jsonl|csv>    Output format (default: jsonl)');
      console.log('  --output <path>         Write to file');
      console.log('  --sessions <ids>        Comma-separated session IDs');
  }
}

module.exports = ExportManager;

if (require.main === module) {
  main();
}
