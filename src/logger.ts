import pino from 'pino';

/**
 * Configure Pino logger for Cloudflare Workers
 * Following best practices: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
 */
export const createLogger = (level: string = 'info') => {
  return pino({
    level,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Disable pretty printing in production for performance
    browser: {
      asObject: true,
    },
  });
};

// Create default logger instance
export const logger = createLogger();

/**
 * Hash an email for logging (privacy-preserving)
 */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Log validation event
 */
export async function logValidation(data: {
  email: string;
  fingerprint: string;
  riskScore: number;
  decision: string;
  signals: any;
  latency?: number;
}) {
  const emailHash = await hashEmail(data.email);

  logger.info({
    event: 'email_validation',
    email_hash: emailHash,
    fingerprint: data.fingerprint,
    risk_score: data.riskScore,
    decision: data.decision,
    signals: data.signals,
    latency_ms: data.latency,
    timestamp: Date.now(),
  });
}

/**
 * Log block event (high-risk emails)
 */
export async function logBlock(data: {
  email: string;
  fingerprint: string;
  riskScore: number;
  reason: string;
  signals: any;
}) {
  const emailHash = await hashEmail(data.email);

  logger.warn({
    event: 'email_blocked',
    email_hash: emailHash,
    fingerprint: data.fingerprint,
    risk_score: data.riskScore,
    reason: data.reason,
    signals: data.signals,
    timestamp: Date.now(),
  });
}

/**
 * Log rate limit event
 */
export function logRateLimit(data: {
  fingerprint: string;
  attempts: number;
  timeWindow: string;
}) {
  logger.warn({
    event: 'rate_limit_triggered',
    fingerprint: data.fingerprint,
    attempts: data.attempts,
    time_window: data.timeWindow,
    timestamp: Date.now(),
  });
}

/**
 * Log error
 */
export function logError(error: Error, context?: any) {
  logger.error({
    event: 'error',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    context,
    timestamp: Date.now(),
  });
}

/**
 * Log metrics (aggregate statistics)
 */
export function logMetrics(data: {
  validations: number;
  blocks: number;
  warnings: number;
  allows: number;
  avgRiskScore: number;
  timeWindow: string;
}) {
  logger.info({
    event: 'metrics',
    validations: data.validations,
    blocks: data.blocks,
    warnings: data.warnings,
    allows: data.allows,
    avg_risk_score: data.avgRiskScore,
    time_window: data.timeWindow,
    timestamp: Date.now(),
  });
}
