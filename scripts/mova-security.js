#!/usr/bin/env node
/**
 * MOVA Security Classifier
 * Classifies security events based on patterns and context
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SECURITY_EVENTS_PATH = path.join(PLUGIN_ROOT, 'config', 'security-events.json');
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');

// Parse arguments
const args = process.argv.slice(2);
const checkType = args.includes('--check') ? args[args.indexOf('--check') + 1] : 'prompt';

// Load security events catalog
function loadSecurityEvents() {
  try {
    return JSON.parse(fs.readFileSync(SECURITY_EVENTS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// Load control config for custom rules
function loadControlConfig() {
  try {
    if (fs.existsSync(CONTROL_FILE)) {
      return JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

// Check for prompt injection patterns
function checkPromptInjection(text, catalog) {
  const eventType = catalog.event_types.prompt_injection_suspected;
  const patterns = eventType.detection_patterns.map(p => new RegExp(p, 'i'));

  const matches = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matches.push(pattern.source);
    }
  }

  if (matches.length > 0) {
    const confidence = Math.min(0.5 + (matches.length * 0.15), 0.95);
    return {
      detected: true,
      event_type: 'prompt_injection_suspected',
      severity: eventType.default_severity,
      actions: eventType.default_actions,
      confidence,
      matched_patterns: matches.length,
      details: `Matched ${matches.length} suspicious pattern(s)`
    };
  }

  return { detected: false };
}

// Check for sensitive data access
function checkSensitiveAccess(text, catalog) {
  const eventType = catalog.event_types.sensitive_data_access_suspected;
  const patterns = eventType.detection_patterns.map(p => new RegExp(p, 'i'));

  const matches = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matches.push(pattern.source);
    }
  }

  if (matches.length > 0) {
    const confidence = Math.min(0.6 + (matches.length * 0.1), 0.95);
    return {
      detected: true,
      event_type: 'sensitive_data_access_suspected',
      severity: eventType.default_severity,
      actions: eventType.default_actions,
      confidence,
      matched_patterns: matches.length,
      details: `Detected access to sensitive resource`
    };
  }

  return { detected: false };
}

// Check for forbidden tool usage
function checkForbiddenTool(toolName, input, config) {
  if (!config?.policy?.permissions?.deny) return { detected: false };

  const denyList = config.policy.permissions.deny;

  for (const pattern of denyList) {
    const regex = new RegExp(pattern, 'i');
    const testString = `${toolName}:${input}`;

    if (regex.test(testString) || regex.test(toolName)) {
      return {
        detected: true,
        event_type: 'forbidden_tool_requested',
        severity: 'high',
        actions: ['block', 'log'],
        confidence: 1.0,
        details: `Tool ${toolName} matches deny pattern: ${pattern}`
      };
    }
  }

  return { detected: false };
}

// Check control profile validity
function checkProfileValidity(config, catalog) {
  if (!config) {
    return {
      detected: true,
      event_type: 'instruction_profile_invalid',
      severity: 'low',
      actions: ['warn', 'log'],
      confidence: 1.0,
      details: 'Control profile not found or invalid (run /mova:init)'
    };
  }

  const issues = [];

  if (!config.profile_id) issues.push('missing profile_id');
  if (!config.mova_version) issues.push('missing mova_version');
  if (!config.policy) issues.push('missing policy section');

  if (issues.length > 0) {
    return {
      detected: true,
      event_type: 'instruction_profile_invalid',
      severity: 'medium',
      actions: ['warn', 'log'],
      confidence: 0.8,
      details: `Profile issues: ${issues.join(', ')}`
    };
  }

  return { detected: false };
}

// Evaluate guardrail rules
function evaluateGuardrails(toolName, input, filePath, config) {
  if (!config?.guardrail_rules) return [];

  const violations = [];

  for (const rule of config.guardrail_rules) {
    if (rule.enabled === false) continue;

    let matches = false;

    // Check tool pattern
    if (rule.target?.tool) {
      const toolPattern = new RegExp(rule.target.tool, 'i');
      if (toolPattern.test(toolName)) {
        if (rule.target?.pattern) {
          const inputPattern = new RegExp(rule.target.pattern, 'i');
          matches = inputPattern.test(input);
        } else {
          matches = true;
        }
      }
    }

    // Check path glob
    if (rule.target?.path_glob && filePath) {
      const glob = rule.target.path_glob
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\./g, '\\.');
      const pathPattern = new RegExp(glob, 'i');
      matches = matches || pathPattern.test(filePath);
    }

    if (matches) {
      violations.push({
        detected: true,
        event_type: 'guardrail_violation',
        severity: rule.severity || 'medium',
        actions: rule.on_violation || ['log'],
        confidence: 1.0,
        rule_id: rule.rule_id,
        details: rule.description || `Rule ${rule.rule_id} violated`
      });
    }
  }

  return violations;
}

// Write security event episode
function writeSecurityEvent(event) {
  const episodesDir = path.join(PROJECT_DIR, '.mova', 'episodes');

  // Find current session
  const currentSessionPath = path.join(episodesDir, '.current_session_id');
  if (!fs.existsSync(currentSessionPath)) return;

  const sessionId = fs.readFileSync(currentSessionPath, 'utf8').trim();
  const sessionDir = path.join(episodesDir, sessionId);

  if (!fs.existsSync(sessionDir)) return;

  const episode = {
    episode_id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    episode_type: 'security_event',
    mova_version: '4.1.1',
    recorded_at: new Date().toISOString(),
    executor: {
      executor_id: 'mova-security',
      role: 'validator',
      executor_kind: 'service'
    },
    result_status: event.actions.includes('block') ? 'failed' : 'completed',
    result_summary: event.details,
    security_event: {
      event_type: event.event_type,
      severity: event.severity,
      actions_taken: event.actions,
      detection_confidence: event.confidence,
      rule_id: event.rule_id || null
    }
  };

  const line = JSON.stringify(episode);
  fs.appendFileSync(path.join(sessionDir, 'events.jsonl'), line + '\n', 'utf8');
}

// Output result
function output(result) {
  if (result.detected) {
    // Write security event
    writeSecurityEvent(result);

    // Check if should block
    if (result.actions.includes('block')) {
      process.stderr.write(JSON.stringify({
        block: true,
        message: `[MOVA Security] ${result.event_type}: ${result.details}`
      }));
      process.exit(2);
    }

    // Warning output
    if (result.actions.includes('warn')) {
      process.stdout.write(JSON.stringify({
        feedback: `[MOVA] ⚠ ${result.event_type} (${result.severity}): ${result.details}`,
        suppressOutput: false
      }));
    } else {
      process.stdout.write(JSON.stringify({
        feedback: `[MOVA] security: ${result.event_type}`,
        suppressOutput: true
      }));
    }
  } else {
    process.stdout.write(JSON.stringify({
      feedback: '[MOVA] security: ok',
      suppressOutput: true
    }));
  }
}

// Main
function main() {
  const catalog = loadSecurityEvents();
  const config = loadControlConfig();

  if (!catalog) {
    console.error('Failed to load security events catalog');
    process.exit(1);
  }

  // Check profile validity first
  const profileCheck = checkProfileValidity(config, catalog);
  if (profileCheck.detected && profileCheck.severity === 'high') {
    output(profileCheck);
    return;
  }

  if (checkType === 'prompt') {
    // Check user prompt
    const prompt = process.env.CLAUDE_USER_PROMPT || process.env.CLAUDE_PROMPT || '';

    const injectionCheck = checkPromptInjection(prompt, catalog);
    if (injectionCheck.detected) {
      output(injectionCheck);
      return;
    }

    const sensitiveCheck = checkSensitiveAccess(prompt, catalog);
    if (sensitiveCheck.detected) {
      output(sensitiveCheck);
      return;
    }
  }

  if (checkType === 'tool') {
    // Check tool usage
    const toolName = process.env.CLAUDE_TOOL_NAME || '';
    const input = process.env.CLAUDE_TOOL_INPUT || '';
    const filePath = process.env.CLAUDE_TOOL_INPUT_FILE_PATH || '';

    // Check forbidden tools
    const forbiddenCheck = checkForbiddenTool(toolName, input, config);
    if (forbiddenCheck.detected) {
      output(forbiddenCheck);
      return;
    }

    // Check sensitive access in tool input
    const sensitiveCheck = checkSensitiveAccess(input + ' ' + filePath, catalog);
    if (sensitiveCheck.detected) {
      output(sensitiveCheck);
      return;
    }

    // Evaluate guardrails
    const violations = evaluateGuardrails(toolName, input, filePath, config);
    if (violations.length > 0) {
      // Output most severe violation
      const sorted = violations.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      });
      output(sorted[0]);
      return;
    }
  }

  // All checks passed
  output({ detected: false });
}

main();
