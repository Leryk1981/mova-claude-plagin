#!/usr/bin/env node
/**
 * MOVA OpenTelemetry Exporter
 * Exports episodes and metrics to OpenTelemetry-compatible backends
 */

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// OTEL configuration from environment
const OTEL_CONFIG = {
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  serviceName: process.env.OTEL_SERVICE_NAME || 'mova-plugin',
  metricsExporter: process.env.OTEL_METRICS_EXPORTER || 'console', // otlp, prometheus, console
  logsExporter: process.env.OTEL_LOGS_EXPORTER || 'console', // otlp, console
  headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS || '')
};

function parseHeaders(headerString) {
  if (!headerString) return {};
  const headers = {};
  for (const pair of headerString.split(',')) {
    const [key, value] = pair.split('=');
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  }
  return headers;
}

class OtelExporter {
  constructor(options = {}) {
    this.endpoint = options.endpoint || OTEL_CONFIG.endpoint;
    this.serviceName = options.serviceName || OTEL_CONFIG.serviceName;
    this.metricsExporter = options.metricsExporter || OTEL_CONFIG.metricsExporter;
    this.logsExporter = options.logsExporter || OTEL_CONFIG.logsExporter;
    this.headers = options.headers || OTEL_CONFIG.headers;

    // Metrics buffer
    this.metricsBuffer = [];
    this.logsBuffer = [];
  }

  // Convert episode to OTEL span format
  episodeToSpan(episode) {
    const startTimeNanos = episode.started_at
      ? BigInt(new Date(episode.started_at).getTime()) * BigInt(1000000)
      : BigInt(new Date(episode.recorded_at).getTime()) * BigInt(1000000);

    const endTimeNanos = episode.finished_at
      ? BigInt(new Date(episode.finished_at).getTime()) * BigInt(1000000)
      : BigInt(new Date(episode.recorded_at).getTime()) * BigInt(1000000);

    const span = {
      traceId: this.hexToBytes(episode.meta_episode?.trace_id || this.generateTraceId()),
      spanId: this.hexToBytes(episode.episode_id.slice(-16).padStart(16, '0')),
      name: `mova.${episode.episode_type}`,
      kind: 1, // SPAN_KIND_INTERNAL
      startTimeUnixNano: startTimeNanos.toString(),
      endTimeUnixNano: endTimeNanos.toString(),
      attributes: this.buildAttributes(episode),
      status: {
        code: episode.result_status === 'failed' ? 2 : 1 // ERROR : OK
      }
    };

    if (episode.meta_episode?.parent_episode_id) {
      span.parentSpanId = this.hexToBytes(
        episode.meta_episode.parent_episode_id.slice(-16).padStart(16, '0')
      );
    }

    return span;
  }

  buildAttributes(episode) {
    const attrs = [
      { key: 'mova.episode_id', value: { stringValue: episode.episode_id } },
      { key: 'mova.episode_type', value: { stringValue: episode.episode_type } },
      { key: 'mova.result_status', value: { stringValue: episode.result_status } },
      { key: 'mova.version', value: { stringValue: episode.mova_version } },
      { key: 'service.name', value: { stringValue: this.serviceName } }
    ];

    if (episode.result_details?.tool_name) {
      attrs.push({ key: 'mova.tool', value: { stringValue: episode.result_details.tool_name } });
    }

    if (episode.result_details?.duration_ms) {
      attrs.push({ key: 'mova.duration_ms', value: { intValue: episode.result_details.duration_ms } });
    }

    if (episode.security_event) {
      attrs.push({ key: 'mova.security.event_type', value: { stringValue: episode.security_event.event_type } });
      attrs.push({ key: 'mova.security.severity', value: { stringValue: episode.security_event.severity } });
      attrs.push({ key: 'mova.security.confidence', value: { doubleValue: episode.security_event.detection_confidence } });
    }

    if (episode.executor) {
      attrs.push({ key: 'mova.executor.id', value: { stringValue: episode.executor.executor_id } });
      if (episode.executor.role) {
        attrs.push({ key: 'mova.executor.role', value: { stringValue: episode.executor.role } });
      }
    }

    return attrs;
  }

  hexToBytes(hex) {
    // Convert hex string to base64 for OTLP JSON format
    const cleanHex = hex.replace(/[^a-fA-F0-9]/g, '').padStart(32, '0').slice(-32);
    const bytes = Buffer.from(cleanHex, 'hex');
    return bytes.toString('base64');
  }

  generateTraceId() {
    const bytes = require('node:crypto').randomBytes(16);
    return bytes.toString('hex');
  }

  // Export episode as span
  exportEpisode(episode) {
    if (this.logsExporter === 'console') {
      console.log('[OTEL] Episode:', JSON.stringify({
        episode_id: episode.episode_id,
        type: episode.episode_type,
        status: episode.result_status
      }));
      return;
    }

    if (this.logsExporter === 'otlp') {
      const span = this.episodeToSpan(episode);
      this.sendSpan(span);
    }
  }

  // Record metric
  recordMetric(name, value, attributes = {}) {
    const metric = {
      name,
      value,
      attributes,
      timestamp: Date.now()
    };

    if (this.metricsExporter === 'console') {
      console.log('[OTEL] Metric:', JSON.stringify(metric));
      return;
    }

    this.metricsBuffer.push(metric);

    // Flush if buffer is large enough
    if (this.metricsBuffer.length >= 10) {
      this.flushMetrics();
    }
  }

  // Export metrics from summary
  exportSummary(summary) {
    // Episode count by type
    for (const [type, count] of Object.entries(summary.episodes_by_type)) {
      this.recordMetric('mova.episode.count', count, { episode_type: type });
    }

    // Episode count by status
    for (const [status, count] of Object.entries(summary.episodes_by_status)) {
      this.recordMetric('mova.episode.count', count, { result_status: status });
    }

    // Tool usage
    for (const [tool, count] of Object.entries(summary.tools_used)) {
      this.recordMetric('mova.tool.usage', count, { tool_name: tool });
    }

    // Security events
    for (const [severity, count] of Object.entries(summary.security_events.by_severity)) {
      this.recordMetric('mova.security.events', count, { severity });
    }

    // Duration
    if (summary.duration_ms) {
      this.recordMetric('mova.session.duration_ms', summary.duration_ms, {
        session_id: summary.session_id
      });
    }

    // Error rate
    if (summary.total_episodes > 0) {
      const errorRate = summary.errors / summary.total_episodes;
      this.recordMetric('mova.error.rate', errorRate, {
        session_id: summary.session_id
      });
    }

    this.flushMetrics();
  }

  // Send span to OTLP endpoint
  async sendSpan(span) {
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } }
          ]
        },
        scopeSpans: [{
          scope: { name: 'mova-plugin', version: '0.2.0' },
          spans: [span]
        }]
      }]
    };

    await this.sendOtlp('/v1/traces', payload);
  }

  // Flush metrics buffer
  async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;
    if (this.metricsExporter !== 'otlp') {
      this.metricsBuffer = [];
      return;
    }

    const dataPoints = this.metricsBuffer.map(m => ({
      asInt: typeof m.value === 'number' && Number.isInteger(m.value) ? m.value : undefined,
      asDouble: typeof m.value === 'number' && !Number.isInteger(m.value) ? m.value : undefined,
      timeUnixNano: (BigInt(m.timestamp) * BigInt(1000000)).toString(),
      attributes: Object.entries(m.attributes).map(([k, v]) => ({
        key: k,
        value: { stringValue: String(v) }
      }))
    }));

    const payload = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.serviceName } }
          ]
        },
        scopeMetrics: [{
          scope: { name: 'mova-plugin', version: '0.2.0' },
          metrics: [{
            name: 'mova.metrics',
            sum: {
              dataPoints,
              aggregationTemporality: 2, // CUMULATIVE
              isMonotonic: true
            }
          }]
        }]
      }]
    };

    await this.sendOtlp('/v1/metrics', payload);
    this.metricsBuffer = [];
  }

  // Send to OTLP endpoint
  async sendOtlp(path, payload) {
    const url = new URL(path, this.endpoint);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...this.headers
      }
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`OTLP request failed: ${res.statusCode} ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Generate Prometheus format metrics
  toPrometheus(summary) {
    const lines = [];
    const timestamp = Date.now();

    // Episode counts
    lines.push('# HELP mova_episode_total Total number of episodes');
    lines.push('# TYPE mova_episode_total counter');
    for (const [type, count] of Object.entries(summary.episodes_by_type)) {
      lines.push(`mova_episode_total{episode_type="${type}"} ${count} ${timestamp}`);
    }

    // Security events
    lines.push('# HELP mova_security_events_total Total security events');
    lines.push('# TYPE mova_security_events_total counter');
    for (const [severity, count] of Object.entries(summary.security_events.by_severity)) {
      lines.push(`mova_security_events_total{severity="${severity}"} ${count} ${timestamp}`);
    }

    // Tool usage
    lines.push('# HELP mova_tool_usage_total Tool usage count');
    lines.push('# TYPE mova_tool_usage_total counter');
    for (const [tool, count] of Object.entries(summary.tools_used)) {
      lines.push(`mova_tool_usage_total{tool="${tool}"} ${count} ${timestamp}`);
    }

    // Duration
    lines.push('# HELP mova_session_duration_seconds Session duration');
    lines.push('# TYPE mova_session_duration_seconds gauge');
    lines.push(`mova_session_duration_seconds ${(summary.duration_ms || 0) / 1000} ${timestamp}`);

    // Error rate
    lines.push('# HELP mova_error_rate Error rate');
    lines.push('# TYPE mova_error_rate gauge');
    const errorRate = summary.total_episodes > 0 ? summary.errors / summary.total_episodes : 0;
    lines.push(`mova_error_rate ${errorRate} ${timestamp}`);

    return lines.join('\n');
  }
}

// CLI interface
function main() {
  const [command, ...args] = process.argv.slice(2);
  const exporter = new OtelExporter();

  switch (command) {
    case 'export-summary': {
      const summaryPath = args[0] || path.join(PROJECT_DIR, '.mova', 'episodes', 'summary.json');
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        exporter.exportSummary(summary);
        console.log('Summary exported');
      } else {
        console.error('Summary file not found');
      }
      break;
    }

    case 'prometheus': {
      const summaryPath = args[0] || path.join(PROJECT_DIR, '.mova', 'episodes', 'summary.json');
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        console.log(exporter.toPrometheus(summary));
      } else {
        console.error('Summary file not found');
      }
      break;
    }

    case 'test': {
      exporter.recordMetric('mova.test', 1, { test: 'true' });
      console.log('Test metric recorded');
      break;
    }

    default:
      console.log('Usage: otel_exporter.js <export-summary|prometheus|test> [args]');
      console.log('');
      console.log('Environment variables:');
      console.log('  OTEL_EXPORTER_OTLP_ENDPOINT  - OTLP endpoint (default: http://localhost:4318)');
      console.log('  OTEL_SERVICE_NAME            - Service name (default: mova-plugin)');
      console.log('  OTEL_METRICS_EXPORTER        - Exporter type: otlp, prometheus, console');
      console.log('  OTEL_LOGS_EXPORTER           - Exporter type: otlp, console');
  }
}

module.exports = OtelExporter;

if (require.main === module) {
  main();
}
