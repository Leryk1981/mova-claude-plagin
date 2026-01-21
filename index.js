/**
 * mova-claude-plugin
 * MOVA - Monitoring, Observing, Validating Agent layer for Claude Code
 */

const path = require('path');

const PLUGIN_ROOT = __dirname;

module.exports = {
  PLUGIN_ROOT,

  // Service exports for programmatic use
  get EpisodeWriter() {
    return require('./services/episode_writer');
  },

  get PresetManager() {
    return require('./services/preset_manager');
  },

  get EnvResolver() {
    return require('./services/env_resolver');
  },

  get OtelExporter() {
    return require('./services/otel_exporter');
  },

  // Config paths
  paths: {
    defaults: path.join(PLUGIN_ROOT, 'config/defaults.json'),
    securityEvents: path.join(PLUGIN_ROOT, 'config/security-events.json'),
    skillRules: path.join(PLUGIN_ROOT, 'config/skill-rules.json'),
    controlTemplate: path.join(PLUGIN_ROOT, 'config/control-template.json')
  }
};
