#!/usr/bin/env node
/**
 * MOVA Retention Manager
 * Manages episode retention and cleanup
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');

class RetentionManager {
  constructor(options = {}) {
    this.episodesDir = options.episodesDir || path.join(PROJECT_DIR, '.mova', 'episodes');
    this.archiveDir = options.archiveDir || path.join(PROJECT_DIR, '.mova', 'archives');
    this.config = options.config || this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONTROL_FILE)) {
        return JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
      }
    } catch {}
    return null;
  }

  getRetentionConfig() {
    return this.config?.retention || {
      episodes_days: 90,
      security_events_days: 365,
      metrics_days: 30,
      auto_cleanup: true,
      archive_before_delete: true,
      archive_format: 'gzip'
    };
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Get all sessions
  getSessions() {
    if (!fs.existsSync(this.episodesDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.episodesDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && e.name.startsWith('sess_'))
      .map(e => {
        const sessionDir = path.join(this.episodesDir, e.name);
        const summaryPath = path.join(sessionDir, 'summary.json');
        let summary = null;

        if (fs.existsSync(summaryPath)) {
          try {
            summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
          } catch {}
        }

        // Get creation time from session ID or directory stats
        let createdAt = null;
        const match = e.name.match(/sess_(\d+)_/);
        if (match) {
          createdAt = new Date(parseInt(match[1]));
        } else {
          const stats = fs.statSync(sessionDir);
          createdAt = stats.birthtime || stats.mtime;
        }

        return {
          sessionId: e.name,
          path: sessionDir,
          createdAt,
          summary
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Check if session is expired
  isExpired(session, retentionDays) {
    if (!session.createdAt) return false;

    const now = new Date();
    const age = now - session.createdAt;
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    return age > maxAge;
  }

  // Check if session contains security events
  hasSecurityEvents(session) {
    if (session.summary?.security_events?.total > 0) {
      return true;
    }
    return false;
  }

  // Archive a session
  archiveSession(session) {
    const retention = this.getRetentionConfig();
    if (!retention.archive_before_delete) {
      return null;
    }

    this.ensureDir(this.archiveDir);

    const archiveName = `${session.sessionId}.tar.gz`;
    const archivePath = path.join(this.archiveDir, archiveName);

    // Read all files in session directory
    const files = fs.readdirSync(session.path);
    const archive = {};

    for (const file of files) {
      const filePath = path.join(session.path, file);
      const content = fs.readFileSync(filePath, 'utf8');
      archive[file] = content;
    }

    // Compress and write archive
    const data = JSON.stringify(archive);
    const compressed = zlib.gzipSync(data);
    fs.writeFileSync(archivePath, compressed);

    return archivePath;
  }

  // Delete a session
  deleteSession(session) {
    const files = fs.readdirSync(session.path);
    for (const file of files) {
      fs.unlinkSync(path.join(session.path, file));
    }
    fs.rmdirSync(session.path);
  }

  // Run cleanup
  cleanup(options = {}) {
    const retention = this.getRetentionConfig();
    const dryRun = options.dryRun || false;

    const sessions = this.getSessions();
    const results = {
      checked: sessions.length,
      expired: 0,
      archived: 0,
      deleted: 0,
      retained_security: 0,
      errors: []
    };

    for (const session of sessions) {
      try {
        // Determine retention period
        let retentionDays = retention.episodes_days;
        if (this.hasSecurityEvents(session)) {
          retentionDays = retention.security_events_days;
        }

        if (this.isExpired(session, retentionDays)) {
          results.expired++;

          if (this.hasSecurityEvents(session) && retentionDays === retention.security_events_days) {
            // Still within security event retention
            results.retained_security++;
            continue;
          }

          if (!dryRun) {
            // Archive if configured
            if (retention.archive_before_delete) {
              const archivePath = this.archiveSession(session);
              if (archivePath) {
                results.archived++;
              }
            }

            // Delete session
            this.deleteSession(session);
            results.deleted++;
          }
        }
      } catch (err) {
        results.errors.push({
          session: session.sessionId,
          error: err.message
        });
      }
    }

    return results;
  }

  // Get retention status
  getStatus() {
    const retention = this.getRetentionConfig();
    const sessions = this.getSessions();

    const now = new Date();
    const stats = {
      total_sessions: sessions.length,
      total_size_bytes: 0,
      oldest_session: null,
      newest_session: null,
      expiring_soon: 0,
      expired: 0,
      with_security_events: 0
    };

    for (const session of sessions) {
      // Calculate size
      try {
        const files = fs.readdirSync(session.path);
        for (const file of files) {
          const filePath = path.join(session.path, file);
          const stat = fs.statSync(filePath);
          stats.total_size_bytes += stat.size;
        }
      } catch {}

      // Track oldest/newest
      if (session.createdAt) {
        if (!stats.oldest_session || session.createdAt < new Date(stats.oldest_session.createdAt)) {
          stats.oldest_session = {
            sessionId: session.sessionId,
            createdAt: session.createdAt.toISOString()
          };
        }
        if (!stats.newest_session || session.createdAt > new Date(stats.newest_session.createdAt)) {
          stats.newest_session = {
            sessionId: session.sessionId,
            createdAt: session.createdAt.toISOString()
          };
        }
      }

      // Check expiration
      const retentionDays = this.hasSecurityEvents(session)
        ? retention.security_events_days
        : retention.episodes_days;

      if (this.isExpired(session, retentionDays)) {
        stats.expired++;
      } else if (this.isExpired(session, retentionDays - 7)) {
        stats.expiring_soon++;
      }

      if (this.hasSecurityEvents(session)) {
        stats.with_security_events++;
      }
    }

    return {
      config: retention,
      stats
    };
  }

  // Restore from archive
  restoreArchive(archiveName) {
    const archivePath = path.join(this.archiveDir, archiveName);
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive not found: ${archiveName}`);
    }

    const compressed = fs.readFileSync(archivePath);
    const data = zlib.gunzipSync(compressed).toString('utf8');
    const archive = JSON.parse(data);

    // Extract session ID from archive name
    const sessionId = archiveName.replace('.tar.gz', '');
    const sessionDir = path.join(this.episodesDir, sessionId);

    this.ensureDir(sessionDir);

    for (const [file, content] of Object.entries(archive)) {
      fs.writeFileSync(path.join(sessionDir, file), content, 'utf8');
    }

    return sessionDir;
  }

  // List archives
  listArchives() {
    if (!fs.existsSync(this.archiveDir)) {
      return [];
    }

    return fs.readdirSync(this.archiveDir)
      .filter(f => f.endsWith('.tar.gz'))
      .map(f => {
        const archivePath = path.join(this.archiveDir, f);
        const stat = fs.statSync(archivePath);
        return {
          name: f,
          size: stat.size,
          created: stat.mtime
        };
      });
  }
}

// CLI interface
function main() {
  const [command, ...args] = process.argv.slice(2);
  const manager = new RetentionManager();

  switch (command) {
    case 'status': {
      const status = manager.getStatus();
      console.log(JSON.stringify(status, null, 2));
      break;
    }

    case 'cleanup': {
      const dryRun = args.includes('--dry-run');
      const results = manager.cleanup({ dryRun });

      if (dryRun) {
        console.log('Dry run - no changes made');
      }
      console.log(JSON.stringify(results, null, 2));
      break;
    }

    case 'archives': {
      const archives = manager.listArchives();
      console.log(JSON.stringify(archives, null, 2));
      break;
    }

    case 'restore': {
      if (!args[0]) {
        console.error('Usage: retention_manager.js restore <archive-name>');
        process.exit(1);
      }
      const restored = manager.restoreArchive(args[0]);
      console.log(`Restored to: ${restored}`);
      break;
    }

    default:
      console.log('Usage: retention_manager.js <status|cleanup|archives|restore> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  status              Show retention status');
      console.log('  cleanup [--dry-run] Run cleanup (use --dry-run for preview)');
      console.log('  archives            List archived sessions');
      console.log('  restore <name>      Restore from archive');
  }
}

module.exports = RetentionManager;

if (require.main === module) {
  main();
}
