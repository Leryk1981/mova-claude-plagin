const { sha256Hex } = require('./sha256');

const SENSITIVE_KEY_RE = /(token|secret|password|key|bearer|authorization)/i;

function recordRedaction(report, field, redactionType, value) {
  const length = value.length;
  const hash = sha256Hex(value);
  report.redacted_fields.add(field);
  report.counts[field] = (report.counts[field] || 0) + 1;
  report.examples.push({ field, redaction_type: redactionType, length, hash });
}

function redactSensitiveValue(value, report, field, redactionType) {
  recordRedaction(report, field, redactionType, value);
  return `[REDACTED_LEN:${value.length}]`;
}

function redactUrlUserInfo(text, report, field) {
  return text.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^\/@\s:]+):([^@\s/]+)@/g, (match, scheme, user, pass) => {
    recordRedaction(report, field, 'url_userinfo', `${user}:${pass}`);
    return `${scheme}[REDACTED]@`;
  });
}

function redactKeyValuePairs(text, report, field) {
  const keyValueRe = new RegExp(`(${SENSITIVE_KEY_RE.source})\\s*[:=]\\s*(?!\\[REDACTED_LEN:)([^\\s"'\\]]+)`, 'gi');
  return text.replace(keyValueRe, (match, key, value) => {
    const redacted = redactSensitiveValue(value, report, field, 'key_value');
    return `${key}=${redacted}`;
  });
}

function redactJsonPairs(text, report, field) {
  const jsonRe = new RegExp(`("?${SENSITIVE_KEY_RE.source}"?\\s*:\\s*)"([^"]*)"`, 'gi');
  return text.replace(jsonRe, (match, prefix, value) => {
    const redacted = redactSensitiveValue(value, report, field, 'json_value');
    return `${prefix}"${redacted}"`;
  });
}

function redactBearerTokens(text, report, field) {
  return text.replace(/\bbearer\s+([A-Za-z0-9._-]+)/gi, (match, token) => {
    if (token.startsWith('[REDACTED_LEN:')) {
      return match;
    }
    const redacted = redactSensitiveValue(token, report, field, 'bearer');
    return `bearer ${redacted}`;
  });
}

function redactHeaderLikeLines(text, report, field) {
  return text.replace(/^([^:\n]+):\s*(.+)$/gim, (match, key, value) => {
    if (!SENSITIVE_KEY_RE.test(key)) {
      return match;
    }
    const redacted = redactSensitiveValue(value, report, field, 'header');
    return `${key}: ${redacted}`;
  });
}

function createRedactionReport() {
  return {
    redacted_fields: new Set(),
    counts: {},
    examples: []
  };
}

function finalizeRedactionReport(report) {
  return {
    redacted_fields: Array.from(report.redacted_fields).sort(),
    counts: report.counts,
    examples: report.examples
  };
}

function redactText(text, field, report) {
  let output = text;
  output = redactUrlUserInfo(output, report, field);
  output = redactBearerTokens(output, report, field);
  output = redactJsonPairs(output, report, field);
  output = redactHeaderLikeLines(output, report, field);
  output = redactKeyValuePairs(output, report, field);
  return output;
}

module.exports = {
  createRedactionReport,
  finalizeRedactionReport,
  redactText,
  SENSITIVE_KEY_RE
};
