#!/usr/bin/env node
/**
 * MOVA Human-in-the-Loop Manager
 * Manages confirmation requests and escalation logic
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');

const SEVERITY_PRIORITY = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

class HitlManager {
  constructor(options = {}) {
    this.config = options.config || this.loadConfig();
    this.pendingConfirmations = new Map();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONTROL_FILE)) {
        return JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
      }
    } catch {}
    return null;
  }

  getHitlConfig() {
    return this.config?.human_in_the_loop || {
      escalation_threshold: 'high',
      auto_approve: [],
      always_confirm: [],
      confirmation_timeout_ms: 60000
    };
  }

  // Check if tool is auto-approved
  isAutoApproved(toolName) {
    const hitl = this.getHitlConfig();
    if (!hitl.auto_approve) return false;
    return hitl.auto_approve.includes(toolName);
  }

  // Check if operation requires confirmation
  requiresConfirmation(toolName, input, filePath) {
    const hitl = this.getHitlConfig();

    // Auto-approved tools don't need confirmation
    if (this.isAutoApproved(toolName)) {
      return { required: false, reason: 'auto_approved' };
    }

    // Check always_confirm rules
    if (hitl.always_confirm && Array.isArray(hitl.always_confirm)) {
      for (const rule of hitl.always_confirm) {
        const match = this.matchesRule(rule, toolName, input, filePath);
        if (match.matches) {
          return {
            required: true,
            reason: 'always_confirm',
            description: match.description,
            rule
          };
        }
      }
    }

    return { required: false, reason: 'not_configured' };
  }

  // Match a tool/input against a confirmation rule
  matchesRule(rule, toolName, input, filePath) {
    if (typeof rule === 'string') {
      return {
        matches: toolName === rule,
        description: `${toolName} operation`
      };
    }

    if (typeof rule === 'object' && rule.tool) {
      const toolPattern = new RegExp(rule.tool, 'i');
      if (!toolPattern.test(toolName)) {
        return { matches: false };
      }

      // Check pattern if specified
      if (rule.pattern) {
        const inputPattern = new RegExp(rule.pattern, 'i');
        if (!inputPattern.test(input)) {
          return { matches: false };
        }
      }

      // Check path_glob if specified
      if (rule.path_glob && filePath) {
        const glob = rule.path_glob
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\./g, '\\.');
        const pathPattern = new RegExp(glob, 'i');
        if (!pathPattern.test(filePath)) {
          return { matches: false };
        }
      }

      return {
        matches: true,
        description: rule.description || `${toolName} operation`
      };
    }

    return { matches: false };
  }

  // Check if severity meets escalation threshold
  meetsEscalationThreshold(severity) {
    const hitl = this.getHitlConfig();
    const threshold = hitl.escalation_threshold || 'high';
    return SEVERITY_PRIORITY[severity] >= SEVERITY_PRIORITY[threshold];
  }

  // Get escalation level for a given context
  getEscalationLevel(context) {
    const { toolName, input, filePath, severity } = context;

    // Check confirmation requirement
    const confirmCheck = this.requiresConfirmation(toolName, input, filePath);
    if (confirmCheck.required) {
      return {
        level: 'confirmation_required',
        description: confirmCheck.description,
        timeout: this.getHitlConfig().confirmation_timeout_ms || 60000
      };
    }

    // Check severity escalation
    if (severity && this.meetsEscalationThreshold(severity)) {
      return {
        level: 'severity_escalation',
        description: `Severity ${severity} meets escalation threshold`,
        severity
      };
    }

    return { level: 'none' };
  }

  // Format confirmation message
  formatConfirmationMessage(context) {
    const { toolName, description, severity } = context;

    const severityIcons = {
      info: 'ℹ️',
      low: '📝',
      medium: '⚠️',
      high: '⛔',
      critical: '🚨'
    };

    const icon = severityIcons[severity] || '❓';
    const desc = description || `${toolName} operation`;

    return `${icon} [MOVA] Confirmation required: ${desc}`;
  }

  // Get summary of HITL configuration
  getSummary() {
    const hitl = this.getHitlConfig();
    return {
      escalation_threshold: hitl.escalation_threshold,
      auto_approve_count: (hitl.auto_approve || []).length,
      always_confirm_count: (hitl.always_confirm || []).length,
      confirmation_timeout_ms: hitl.confirmation_timeout_ms,
      auto_approved_tools: hitl.auto_approve || [],
      confirmation_rules: (hitl.always_confirm || []).map(rule => {
        if (typeof rule === 'string') return { tool: rule };
        return {
          tool: rule.tool,
          pattern: rule.pattern,
          path_glob: rule.path_glob,
          description: rule.description
        };
      })
    };
  }
}

// CLI interface
function main() {
  const [command, ...args] = process.argv.slice(2);
  const manager = new HitlManager();

  switch (command) {
    case 'check': {
      const toolName = args[0] || process.env.CLAUDE_TOOL_NAME;
      const input = args[1] || process.env.CLAUDE_TOOL_INPUT || '';
      const filePath = args[2] || process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';

      const result = manager.requiresConfirmation(toolName, input, filePath);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'escalation': {
      const context = {
        toolName: args[0] || 'unknown',
        input: args[1] || '',
        filePath: args[2] || '',
        severity: args[3] || 'medium'
      };

      const result = manager.getEscalationLevel(context);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'summary': {
      const summary = manager.getSummary();
      console.log(JSON.stringify(summary, null, 2));
      break;
    }

    default:
      console.log('Usage: hitl_manager.js <check|escalation|summary> [args]');
      console.log('');
      console.log('Commands:');
      console.log('  check <tool> [input] [path]    Check if confirmation required');
      console.log('  escalation <tool> [input] [path] [severity]  Get escalation level');
      console.log('  summary                        Show HITL configuration summary');
  }
}

module.exports = HitlManager;

if (require.main === module) {
  main();
}
