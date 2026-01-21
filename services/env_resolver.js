#!/usr/bin/env node
/**
 * MOVA Environment Resolver - Environment variable resolution
 * Adapted for plugin architecture
 */

const fs = require('node:fs');

const SENSITIVE_PATTERNS = [/password/i, /secret/i, /key/i, /token/i, /auth/i];

function maskSensitiveValue(value, varName) {
  if (!SENSITIVE_PATTERNS.some(pattern => pattern.test(varName))) return value;
  const str = String(value ?? '');
  if (str.length <= 4) return '*'.repeat(str.length);
  return `${str.slice(0, 2)}${'*'.repeat(Math.max(0, str.length - 4))}${str.slice(-2)}`;
}

function parseEnvSyntax(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/^\$\{([A-Za-z0-9_]+)(?::(.+))?\}$/);
  if (!match) return null;
  const [, varName, defaultRaw] = match;
  return { varName, defaultRaw };
}

function inferType(defaultRaw) {
  if (defaultRaw === undefined) return 'string';
  if (/^(true|false)$/i.test(defaultRaw)) return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(defaultRaw)) return 'number';
  if (/^\s*[\[{]/.test(defaultRaw)) return 'json';
  return 'string';
}

function validateAndConvert(value, type) {
  if (value === undefined) return value;
  const str = String(value);
  switch (type) {
    case 'boolean':
      if (/^(true|1)$/i.test(str)) return true;
      if (/^(false|0)$/i.test(str)) return false;
      throw new Error(`Invalid boolean value: ${str}`);
    case 'number':
      const num = Number(str);
      if (!Number.isFinite(num)) throw new Error(`Invalid number value: ${str}`);
      return num;
    case 'json':
      try {
        return JSON.parse(str);
      } catch {
        throw new Error(`Invalid JSON value: ${str}`);
      }
    default:
      return str;
  }
}

function resolveString(str, options) {
  const parsed = parseEnvSyntax(str);
  if (!parsed) return str;
  const { varName, defaultRaw } = parsed;
  const envValue = options.env?.[varName] ?? process.env[varName];
  const type = inferType(defaultRaw);
  const source = envValue !== undefined ? envValue : defaultRaw;
  if (options.validateTypes) {
    return validateAndConvert(source, type);
  }
  return source ?? '';
}

function resolveEmbedded(str, options) {
  return str.replace(/\$\{([A-Za-z0-9_]+)(?::([^}]+))?\}/g, (match, varName, defaultRaw) => {
    const envValue = options.env?.[varName] ?? process.env[varName];
    if (envValue !== undefined) return envValue;
    return defaultRaw ?? match;
  });
}

function resolveEnvironmentConfig(config, options = {}) {
  if (Array.isArray(config)) {
    return config.map(value => resolveEnvironmentConfig(value, options));
  }
  if (config && typeof config === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(config)) {
      out[key] = resolveEnvironmentConfig(value, options);
    }
    return out;
  }
  if (typeof config === 'string') {
    if (parseEnvSyntax(config)) return resolveString(config, options);
    if (config.includes('${')) return resolveEmbedded(config, options);
  }
  return config;
}

function loadConfigWithEnv(filePath, options = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const resolved = resolveEnvironmentConfig(data, options);

  if (options.maskSensitive) {
    const masked = resolveEnvironmentConfig(data, {
      ...options,
      validateTypes: false,
      env: Object.fromEntries(
        Object.keys(process.env).map(key => [key, maskSensitiveValue(process.env[key], key)])
      )
    });
    return { resolved, masked };
  }
  return { resolved };
}

function cmdResolve(filePath) {
  const { resolved } = loadConfigWithEnv(filePath, { validateTypes: true });
  console.log(JSON.stringify(resolved, null, 2));
}

function cmdValidate(filePath) {
  loadConfigWithEnv(filePath, { validateTypes: true });
  console.log('ok');
}

function main() {
  const [command, filePath] = process.argv.slice(2);

  switch (command) {
    case 'resolve':
      if (filePath) cmdResolve(filePath);
      else console.error('Usage: env_resolver.js resolve <file.json>');
      break;
    case 'validate':
      if (filePath) cmdValidate(filePath);
      else console.error('Usage: env_resolver.js validate <file.json>');
      break;
    default:
      console.log('Usage: env_resolver.js <resolve|validate> <file.json>');
  }
}

// Export for programmatic use
module.exports = {
  maskSensitiveValue,
  parseEnvSyntax,
  validateAndConvert,
  resolveEnvironmentConfig,
  loadConfigWithEnv
};

if (require.main === module) {
  main();
}
