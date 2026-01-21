#!/usr/bin/env node
/**
 * MOVA Preset Manager - Configuration preset management
 * Adapted for plugin architecture
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const PRESET_DIR = path.join(PLUGIN_ROOT, 'presets');
const CONTROL_FILE = path.join(PROJECT_DIR, 'mova', 'control_v0.json');
const TEMPLATE_FILE = path.join(PLUGIN_ROOT, 'config', 'control-template.json');
const BACKUP_DIR = path.join(PROJECT_DIR, '.mova', 'backups');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeArrays(base, incoming) {
  if (!isObject(incoming) || !incoming.$mode) return incoming;
  const items = Array.isArray(incoming.items) ? incoming.items : [];
  if (incoming.$mode === 'append') return [...(base ?? []), ...items];
  if (incoming.$mode === 'union') {
    const seen = new Set((base ?? []).map(item => JSON.stringify(item)));
    const merged = [...(base ?? [])];
    for (const item of items) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    }
    return merged;
  }
  if (incoming.$mode === 'replace') return items;
  return items;
}

function mergeValues(base, incoming) {
  if (Array.isArray(base) || Array.isArray(incoming)) {
    return mergeArrays(base, incoming);
  }
  if (isObject(base) && isObject(incoming)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      out[key] = mergeValues(out[key], value);
    }
    return out;
  }
  return incoming;
}

function loadPreset(name) {
  const filePath = path.join(PRESET_DIR, `${name}.preset.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function resolvePreset(name, stack = []) {
  if (stack.includes(name)) {
    throw new Error(`Preset inheritance cycle: ${[...stack, name].join(' -> ')}`);
  }
  const preset = loadPreset(name);
  let resolved = preset;
  if (preset.$inherit) {
    const base = resolvePreset(preset.$inherit, [...stack, name]);
    const { $inherit, ...rest } = preset;
    resolved = mergeValues(base, rest);
  }
  return resolved;
}

function listPresets() {
  const entries = fs.readdirSync(PRESET_DIR);
  return entries
    .filter(name => name.endsWith('.preset.json'))
    .map(name => name.replace('.preset.json', ''));
}

function validatePreset(preset) {
  if (!isObject(preset)) throw new Error('Preset must be an object');
  if (preset.$inherit && typeof preset.$inherit !== 'string') {
    throw new Error('$inherit must be a string');
  }
  return true;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createBackup(controlPath) {
  if (!fs.existsSync(controlPath)) return null;

  ensureDir(BACKUP_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `control_v0_${timestamp}.json`);
  fs.copyFileSync(controlPath, backupPath);
  return backupPath;
}

function applyPreset(name, options = {}) {
  const controlPath = options.controlPath ?? CONTROL_FILE;

  // Create backup before modifying
  const backupPath = createBackup(controlPath);

  // Load current control or template
  let control = {};
  if (fs.existsSync(controlPath)) {
    control = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
  } else if (fs.existsSync(TEMPLATE_FILE)) {
    control = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));
  }

  // Resolve and merge preset
  const preset = resolvePreset(name);
  validatePreset(preset);
  const merged = mergeValues(control, preset);

  // Write merged config
  ensureDir(path.dirname(controlPath));
  fs.writeFileSync(controlPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  return { controlPath, backupPath };
}

function initProject(presetName = 'base') {
  const movaDir = path.join(PROJECT_DIR, 'mova');
  const episodesDir = path.join(PROJECT_DIR, '.mova', 'episodes');

  ensureDir(movaDir);
  ensureDir(episodesDir);

  // Apply preset (creates control_v0.json)
  const result = applyPreset(presetName);

  // Update CLAUDE.md if exists
  const claudeMdPath = path.join(PROJECT_DIR, 'CLAUDE.md');
  const marker = '<!-- MOVA_CONTROL_ENTRY_V0 -->';

  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    if (!content.includes(marker)) {
      const addition = `\n${marker}\n## MOVA Control Entry (v0)\n\nThis is the canonical control entry marker for Claude Code.\n`;
      fs.appendFileSync(claudeMdPath, addition, 'utf8');
    }
  }

  return result;
}

function cmdList() {
  const presets = listPresets();
  console.log('Available presets:');
  for (const name of presets) {
    try {
      const preset = loadPreset(name);
      const desc = preset.description || 'No description';
      console.log(`  ${name.padEnd(15)} - ${desc}`);
    } catch {
      console.log(`  ${name.padEnd(15)} - (error loading)`);
    }
  }
}

function cmdInfo(name) {
  const preset = resolvePreset(name);
  console.log(JSON.stringify(preset, null, 2));
}

function cmdApply(name) {
  const result = applyPreset(name);
  console.log(`Applied preset: ${name}`);
  if (result.backupPath) {
    console.log(`Backup: ${result.backupPath}`);
  }
}

function cmdInit(args) {
  const presetArg = args.find(a => a.startsWith('--preset='));
  const presetName = presetArg ? presetArg.split('=')[1] : 'base';

  const result = initProject(presetName);
  console.log('MOVA initialized');
  console.log(`Config: ${result.controlPath}`);
  console.log(`Preset: ${presetName}`);
}

function cmdLint(args) {
  const fix = args.includes('--fix');
  const issues = [];

  // Check control file exists
  if (!fs.existsSync(CONTROL_FILE)) {
    issues.push({ severity: 'error', message: 'mova/control_v0.json not found' });
    if (fix) {
      initProject('base');
      console.log('Fixed: Created control_v0.json with base preset');
    }
  } else {
    // Validate JSON
    try {
      const control = JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8'));

      // Check required fields
      if (!control.profile_id) {
        issues.push({ severity: 'warning', message: 'Missing profile_id' });
      }
      if (!control.mova_version) {
        issues.push({ severity: 'warning', message: 'Missing mova_version' });
      }
      if (!control.observability) {
        issues.push({ severity: 'warning', message: 'Missing observability config' });
      }
    } catch (e) {
      issues.push({ severity: 'error', message: `Invalid JSON: ${e.message}` });
    }
  }

  // Check episodes directory
  const episodesDir = path.join(PROJECT_DIR, '.mova', 'episodes');
  if (!fs.existsSync(episodesDir)) {
    issues.push({ severity: 'warning', message: '.mova/episodes directory not found' });
    if (fix) {
      ensureDir(episodesDir);
      console.log('Fixed: Created .mova/episodes directory');
    }
  }

  // Output results
  if (issues.length === 0) {
    console.log('Validation: PASS');
  } else {
    for (const issue of issues) {
      console.log(`[${issue.severity.toUpperCase()}] ${issue.message}`);
    }
    const hasErrors = issues.some(i => i.severity === 'error');
    console.log(`Validation: ${hasErrors ? 'FAIL' : 'WARN'}`);
    if (hasErrors && !fix) {
      process.exit(1);
    }
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'list':
      cmdList();
      break;
    case 'info':
      if (args[0]) cmdInfo(args[0]);
      else console.error('Usage: preset_manager.js info <name>');
      break;
    case 'apply':
      if (args[0]) cmdApply(args[0]);
      else console.error('Usage: preset_manager.js apply <name>');
      break;
    case 'init':
      cmdInit(args);
      break;
    case 'lint':
      cmdLint(args);
      break;
    default:
      console.log('Usage: preset_manager.js <list|info|apply|init|lint> [options]');
      console.log('Commands:');
      console.log('  list              List available presets');
      console.log('  info <name>       Show preset details');
      console.log('  apply <name>      Apply preset to control_v0.json');
      console.log('  init [--preset=]  Initialize MOVA in project');
      console.log('  lint [--fix]      Validate MOVA configuration');
  }
}

main();
