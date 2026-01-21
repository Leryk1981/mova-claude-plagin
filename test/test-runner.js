#!/usr/bin/env node
/**
 * MOVA Plugin Test Runner
 * Validates plugin structure and basic functionality
 */

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test: Plugin manifest exists and is valid
test('plugin.json exists and is valid', () => {
  const manifestPath = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
  assert(fs.existsSync(manifestPath), 'plugin.json not found');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name === 'mova', 'plugin name should be "mova"');
  assert(manifest.version, 'version is required');
  assert(manifest.engines['claude-code'], 'claude-code engine requirement missing');
});

// Test: package.json exists and is valid
test('package.json exists and is valid', () => {
  const pkgPath = path.join(PLUGIN_ROOT, 'package.json');
  assert(fs.existsSync(pkgPath), 'package.json not found');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert(pkg.name, 'name is required');
  assert(pkg.version, 'version is required');
  assert(pkg.main === 'index.js', 'main should be index.js');
});

// Test: hooks.json exists and is valid
test('hooks.json exists and has required hooks', () => {
  const hooksPath = path.join(PLUGIN_ROOT, 'hooks', 'hooks.json');
  assert(fs.existsSync(hooksPath), 'hooks.json not found');

  const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));
  assert(hooks.hooks && typeof hooks.hooks === 'object', 'hooks should be an object');

  const events = Object.keys(hooks.hooks);
  assert(events.includes('SessionStart'), 'SessionStart hook missing');
  assert(events.includes('PreToolUse'), 'PreToolUse hook missing');
  assert(events.includes('PostToolUse'), 'PostToolUse hook missing');
});

// Test: All commands exist
test('all command files exist', () => {
  const commands = [
    'init.md', 'status.md', 'context.md', 'lint.md',
    'metrics.md', 'dashboard.md', 'debug.md',
    'start.md', 'finish.md', 'export.md', 'retention.md',
    'preset/list.md', 'preset/apply.md', 'preset/info.md'
  ];

  for (const cmd of commands) {
    const cmdPath = path.join(PLUGIN_ROOT, 'commands', cmd);
    assert(fs.existsSync(cmdPath), `command ${cmd} not found`);
  }
});

// Test: All scripts exist and are executable
test('all scripts exist', () => {
  const scripts = [
    'mova-guard.js', 'mova-observe.js', 'mova-security.js', 'skill-eval.js'
  ];

  for (const script of scripts) {
    const scriptPath = path.join(PLUGIN_ROOT, 'scripts', script);
    assert(fs.existsSync(scriptPath), `script ${script} not found`);
  }
});

// Test: All services exist
test('all services exist', () => {
  const services = [
    'preset_manager.js', 'env_resolver.js', 'episode_writer.js',
    'otel_exporter.js', 'episode_metrics_collector.js',
    'hitl_manager.js', 'retention_manager.js', 'export_manager.js'
  ];

  for (const service of services) {
    const servicePath = path.join(PLUGIN_ROOT, 'services', service);
    assert(fs.existsSync(servicePath), `service ${service} not found`);
  }
});

// Test: All presets exist and are valid
test('all presets exist and are valid', () => {
  const presets = ['base.preset.json', 'development.preset.json', 'production.preset.json'];

  for (const preset of presets) {
    const presetPath = path.join(PLUGIN_ROOT, 'presets', preset);
    assert(fs.existsSync(presetPath), `preset ${preset} not found`);

    const data = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
    assert(data.preset_id, `preset ${preset} missing preset_id`);
  }
});

// Test: All schemas exist and are valid JSON Schema
test('all schemas exist and are valid', () => {
  const schemas = [
    'episode_v1.schema.json', 'security_event.schema.json',
    'guardrail_rule.schema.json', 'control_v1.schema.json'
  ];

  for (const schema of schemas) {
    const schemaPath = path.join(PLUGIN_ROOT, 'schemas', schema);
    assert(fs.existsSync(schemaPath), `schema ${schema} not found`);

    const data = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert(data.$schema, `schema ${schema} missing $schema`);
  }
});

// Test: index.js exports correctly
test('index.js exports correctly', () => {
  const indexPath = path.join(PLUGIN_ROOT, 'index.js');
  assert(fs.existsSync(indexPath), 'index.js not found');

  const exports = require(indexPath);
  assert(exports.PLUGIN_ROOT, 'PLUGIN_ROOT export missing');
  assert(exports.PresetManager, 'PresetManager export missing');
  assert(exports.EnvResolver, 'EnvResolver export missing');
});

// Run tests
console.log('MOVA Plugin Test Runner');
console.log('=======================\n');

for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${err.message}`);
    failed++;
  }
}

console.log('\n-----------------------');
console.log(`Results: ${passed} passed, ${failed} failed`);

process.exit(failed > 0 ? 1 : 0);
