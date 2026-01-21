/**
 * mova-claude-plugin TypeScript Definitions
 */

export declare const PLUGIN_ROOT: string;

export declare class EpisodeWriter {
  constructor(options?: {
    episodesDir?: string;
    sessionId?: string;
    correlationId?: string;
  });

  writeEpisode(episode: Episode): Promise<void>;
  initSession(): Promise<string>;
  finalizeSession(): Promise<SessionSummary>;
}

export declare class PresetManager {
  constructor(options?: {
    presetsDir?: string;
    projectDir?: string;
  });

  list(): Preset[];
  get(name: string): Preset | null;
  apply(name: string): ApplyResult;
  init(presetName?: string): InitResult;
  lint(fix?: boolean): LintResult;
}

export declare class EnvResolver {
  constructor(config: ControlConfig);

  resolve(key: string): string | null;
  resolveAll(): Record<string, string>;
  validate(): ValidationResult;
}

export declare class OtelExporter {
  constructor(options?: {
    endpoint?: string;
    format?: 'otlp' | 'prometheus';
  });

  export(metrics: Metrics): Promise<void>;
  formatPrometheus(metrics: Metrics): string;
}

export declare const paths: {
  defaults: string;
  securityEvents: string;
  skillRules: string;
  controlTemplate: string;
};

// Types

export interface Episode {
  episode_id: string;
  episode_type: 'execution' | 'plan' | 'security_event' | 'other';
  mova_version: string;
  recorded_at: string;
  started_at?: string;
  finished_at?: string;
  executor: Executor;
  result_status: ResultStatus;
  result_summary: string;
  result_details?: ResultDetails;
  meta_episode?: MetaEpisode;
  security_event?: SecurityEvent;
  compliance?: Compliance;
}

export interface Executor {
  executor_id: string;
  role?: 'agent' | 'reviewer' | 'router' | 'user';
  executor_kind?: 'human' | 'AI model' | 'service' | 'tool' | 'hybrid';
}

export type ResultStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled'
  | 'skipped';

export interface ResultDetails {
  duration_ms?: number;
  tokens_used?: number;
  tool_name?: string;
  exit_code?: number;
  files_affected?: string[];
}

export interface MetaEpisode {
  correlation_id?: string;
  parent_episode_id?: string | null;
  trace_id?: string;
  session_id?: string;
}

export interface SecurityEvent {
  event_type: SecurityEventType;
  severity: Severity;
  actions_taken?: string[];
  detection_confidence?: number;
  rule_id?: string;
}

export type SecurityEventType =
  | 'instruction_profile_invalid'
  | 'prompt_injection_suspected'
  | 'forbidden_tool_requested'
  | 'rate_limit_exceeded'
  | 'sensitive_data_access_suspected'
  | 'guardrail_violation';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Compliance {
  data_classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  retention_days?: number;
  exportable?: boolean;
  redacted_fields?: string[];
}

export interface Preset {
  preset_id: string;
  $preset?: string;
  $inherit?: string;
  description?: string;
  policy?: Policy;
  guardrail_rules?: GuardrailRule[];
  human_in_the_loop?: HumanInTheLoop;
  observability?: Observability;
  monitoring?: Monitoring;
  retention?: Retention;
}

export interface Policy {
  permissions?: {
    allow?: string[];
    deny?: string[];
    on_conflict?: 'deny_wins' | 'allow_wins';
    on_unknown?: 'allow' | 'deny' | 'report_only';
  };
}

export interface GuardrailRule {
  rule_id: string;
  description?: string;
  effect: 'deny' | 'warn' | 'audit';
  target: {
    tool?: string;
    pattern?: string;
    path_glob?: string;
  };
  severity: Severity;
  on_violation?: string[];
  enabled?: boolean;
}

export interface HumanInTheLoop {
  escalation_threshold?: Severity;
  auto_approve?: string[];
  always_confirm?: AlwaysConfirmEntry[];
  confirmation_timeout_ms?: number;
}

export interface AlwaysConfirmEntry {
  tool: string;
  pattern?: string;
  path_glob?: string;
  description?: string;
}

export interface Observability {
  enabled?: boolean;
  log_level?: 'debug' | 'info' | 'warn' | 'error';
  otel_enabled?: boolean;
  otel_endpoint?: string;
  otel_format?: 'otlp' | 'prometheus';
}

export interface Monitoring {
  enabled?: boolean;
  port?: number;
}

export interface Retention {
  episodes_days?: number;
  security_events_days?: number;
  metrics_days?: number;
  auto_cleanup?: boolean;
  archive_before_delete?: boolean;
  archive_format?: 'gzip' | 'zip' | 'none';
}

export interface ControlConfig {
  profile_id: string;
  version: string;
  environment?: string;
  $preset?: string;
  policy?: Policy;
  guardrail_rules?: GuardrailRule[];
  human_in_the_loop?: HumanInTheLoop;
  observability?: Observability;
  monitoring?: Monitoring;
  retention?: Retention;
  environs?: Record<string, string | boolean | number>;
}

export interface SessionSummary {
  session_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total_episodes: number;
  episodes_by_status: Record<ResultStatus, number>;
  tools_used: Record<string, number>;
  security_events: {
    total: number;
    by_severity: Record<Severity, number>;
    by_type: Record<SecurityEventType, number>;
  };
}

export interface Metrics {
  episodes: {
    total: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
  };
  performance: {
    avg_duration_ms: number;
    p95_duration_ms: number;
    max_duration_ms: number;
  };
  security: {
    total: number;
    by_severity: Record<Severity, number>;
  };
  tools: Record<string, number>;
}

export interface ApplyResult {
  success: boolean;
  preset: string;
  changes: string[];
  backup?: string;
}

export interface InitResult {
  success: boolean;
  preset: string;
  directories: string[];
  configPath: string;
}

export interface LintResult {
  valid: boolean;
  errors: LintError[];
  warnings: LintWarning[];
  fixed?: string[];
}

export interface LintError {
  path: string;
  message: string;
  rule?: string;
}

export interface LintWarning {
  path: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  resolved: Record<string, string>;
}
