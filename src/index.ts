import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateEmail } from './validators/email';
import { validateDomain, getDomainReputationScore } from './validators/domain';
import { generateFingerprint, extractAllSignals } from './fingerprint';
import { logValidation, logBlock, logError } from './logger';
import { writeValidationMetric } from './utils/metrics';
import type { ValidationResult } from './types';
import {
	extractPatternFamily,
	getPatternRiskScore,
	normalizeEmail,
	detectKeyboardWalk,
	getKeyboardWalkRiskScore,
	getPlusAddressingRiskScore,
	getNGramRiskScore,
	detectGibberish,
	analyzeTLDRisk,
	isHighRiskTLD
} from './detectors/index';

/**
 * Bogus Email Pattern Recognition Worker
 *
 * Validates email addresses to prevent fake signups using:
 * - Format validation (RFC 5322)
 * - Entropy analysis (random string detection)
 * - Disposable domain detection (170+ known services)
 * - Advanced fingerprinting (IP + JA4 + Bot Score)
 * - Pattern detection (sequential, dated, plus-addressing, keyboard walks)
 * - Domain reputation scoring
 * - N-Gram analysis (gibberish detection) - Phase 6A
 * - TLD risk profiling (40+ TLD categories) - Phase 6A
 * - Structured logging with Pino
 * - Metrics collection with Analytics Engine
 */

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('/*', cors());

// Root endpoint - Welcome message
app.get('/', (c) => {
	return c.text(`Bogus Email Pattern Recognition API

Endpoints:
- POST /validate { "email": "test@example.com" }
- GET /debug (shows all request signals)

Example:
curl -X POST https://your-worker.dev/validate \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test@example.com"}'
`);
});

// Debug endpoint - Show all available fingerprinting signals
app.get('/debug', async (c) => {
	const signals = extractAllSignals(c.req.raw);
	const fingerprint = await generateFingerprint(c.req.raw);

	return c.json({
		fingerprint,
		allSignals: signals,
	});
});

// Main validation endpoint
app.post('/validate', async (c) => {
	const startTime = Date.now();
	const env = c.env;

	try {
		const body = await c.req.json<{ email?: string }>();

		if (!body.email) {
			return c.json({ error: 'Email is required' }, 400);
		}

		// Generate fingerprint
		const fingerprint = await generateFingerprint(c.req.raw);

		// Validate email format
		const emailValidation = validateEmail(body.email);

		// Validate domain (if format is valid)
		let domainValidation;
		let domainReputationScore = 0;
		let tldRiskScore = 0;

		if (emailValidation.valid) {
			const [, domain] = body.email.split('@');
			if (domain && env.ENABLE_DISPOSABLE_CHECK === 'true') {
				domainValidation = validateDomain(domain);
				domainReputationScore = getDomainReputationScore(domain);

				// TLD risk profiling (Phase 6A)
				const tldAnalysis = analyzeTLDRisk(domain);
				tldRiskScore = tldAnalysis.riskScore;
			}
		}

		// Pattern analysis (if enabled and format is valid)
		let patternFamilyResult;
		let normalizedEmailResult;
		let keyboardWalkResult;
		let gibberishResult;
		let patternRiskScore = 0;

		if (emailValidation.valid && env.ENABLE_PATTERN_CHECK === 'true') {
			// Extract pattern family (sequential, dated, etc.)
			patternFamilyResult = await extractPatternFamily(body.email);
			patternRiskScore = getPatternRiskScore(patternFamilyResult);

			// Normalize email (plus-addressing detection)
			normalizedEmailResult = normalizeEmail(body.email);
			const plusAddressingRisk = getPlusAddressingRiskScore(body.email);

			// Keyboard walk detection
			keyboardWalkResult = detectKeyboardWalk(body.email);
			const keyboardWalkRisk = getKeyboardWalkRiskScore(keyboardWalkResult);

			// N-Gram gibberish detection (Phase 6A)
			const [localPart] = body.email.split('@');
			const ngramRisk = getNGramRiskScore(localPart);
			gibberishResult = detectGibberish(body.email);

			// Combine pattern risks
			patternRiskScore = Math.max(
				patternRiskScore,
				plusAddressingRisk,
				keyboardWalkRisk,
				ngramRisk
			);
		}

		// Calculate risk score with domain and pattern signals
		let riskScore = 0;
		let blockReason = '';

		if (!emailValidation.valid) {
			riskScore = 0.8;
			blockReason = emailValidation.reason || 'invalid_format';
		} else if (domainValidation && domainValidation.isDisposable) {
			// Disposable domains are high risk
			riskScore = 0.95;
			blockReason = 'disposable_domain';
		} else if (emailValidation.signals.entropyScore > 0.7) {
			riskScore = emailValidation.signals.entropyScore;
			blockReason = 'high_entropy';
		} else {
			// Enhanced risk scoring with pattern analysis (Phase 6A updated)
			// Weight distribution:
			// - Entropy: 20%
			// - Domain reputation: 10%
			// - TLD risk: 10%
			// - Pattern detection: 50% (sequential, dated, plus-addressing, keyboard walks, n-gram)
			// - Remaining: 10% buffer

			const entropyRisk = emailValidation.signals.entropyScore * 0.20;
			const domainRisk = domainReputationScore * 0.10;
			const tldRisk = tldRiskScore * 0.10;
			const combinedPatternRisk = patternRiskScore * 0.50;

			riskScore = Math.min(entropyRisk + domainRisk + tldRisk + combinedPatternRisk, 1.0);

			// Set block reason based on highest risk factor
			if (patternRiskScore > 0.6) {
				if (gibberishResult?.isGibberish) {
					blockReason = 'gibberish_detected';
				} else if (patternFamilyResult?.patternType === 'sequential') {
					blockReason = 'sequential_pattern';
				} else if (patternFamilyResult?.patternType === 'dated') {
					blockReason = 'dated_pattern';
				} else if (normalizedEmailResult?.hasPlus) {
					blockReason = 'plus_addressing_abuse';
				} else if (keyboardWalkResult?.hasKeyboardWalk) {
					blockReason = 'keyboard_walk';
				} else {
					blockReason = 'suspicious_pattern';
				}
			} else if (tldRisk > Math.max(domainRisk, entropyRisk)) {
				blockReason = 'high_risk_tld';
			} else if (domainRisk > entropyRisk) {
				blockReason = 'domain_reputation';
			} else {
				blockReason = 'entropy_threshold';
			}
		}

		// Get thresholds from environment (with defaults)
		const blockThreshold = parseFloat(env.RISK_THRESHOLD_BLOCK || '0.6');
		const warnThreshold = parseFloat(env.RISK_THRESHOLD_WARN || '0.3');

		// Determine decision
		let decision: 'allow' | 'warn' | 'block' = 'allow';
		if (riskScore > blockThreshold) {
			decision = 'block';
		} else if (riskScore > warnThreshold) {
			decision = 'warn';
		}

		const result: ValidationResult = {
			valid: emailValidation.valid && (!domainValidation || !domainValidation.isDisposable),
			riskScore: Math.round(riskScore * 100) / 100,
			signals: {
				formatValid: emailValidation.signals.formatValid,
				entropyScore: Math.round(emailValidation.signals.entropyScore * 100) / 100,
				localPartLength: emailValidation.signals.localPartLength,
				isDisposableDomain: domainValidation?.isDisposable || false,
				isFreeProvider: domainValidation?.isFreeProvider || false,
				domainReputationScore: Math.round(domainReputationScore * 100) / 100,
				// Pattern detection signals
				...(env.ENABLE_PATTERN_CHECK === 'true' && patternFamilyResult && {
					patternFamily: patternFamilyResult.family,
					patternType: patternFamilyResult.patternType,
					patternConfidence: Math.round(patternFamilyResult.confidence * 100) / 100,
					patternRiskScore: Math.round(patternRiskScore * 100) / 100,
					normalizedEmail: normalizedEmailResult?.normalized,
					hasPlusAddressing: normalizedEmailResult?.hasPlus || false,
					hasKeyboardWalk: keyboardWalkResult?.hasKeyboardWalk || false,
					keyboardWalkType: keyboardWalkResult?.walkType,
					// Phase 6A signals
					isGibberish: gibberishResult?.isGibberish || false,
					gibberishConfidence: gibberishResult ? Math.round(gibberishResult.confidence * 100) / 100 : undefined,
					tldRiskScore: Math.round(tldRiskScore * 100) / 100,
				})
			},
			decision,
			message: domainValidation?.reason || emailValidation.reason || 'Email validation completed',
		};

		// Calculate latency
		const latency = Date.now() - startTime;

		// Log validation event (if enabled)
		if (env.LOG_ALL_VALIDATIONS === 'true') {
			await logValidation({
				email: body.email,
				fingerprint: fingerprint.hash,
				riskScore: result.riskScore,
				decision: result.decision,
				signals: result.signals,
				latency,
			});
		}

		// Log blocks separately for alerting
		if (decision === 'block') {
			await logBlock({
				email: body.email,
				fingerprint: fingerprint.hash,
				riskScore: result.riskScore,
				reason: blockReason,
				signals: result.signals,
			});
		}

		// Write metrics to Analytics Engine
		writeValidationMetric(env.ANALYTICS, {
			decision: result.decision,
			riskScore: result.riskScore,
			entropyScore: result.signals.entropyScore,
			botScore: fingerprint.botScore,
			country: fingerprint.country,
			asn: fingerprint.asn,
			blockReason: decision === 'block' ? blockReason : undefined,
			fingerprintHash: fingerprint.hash,
			latency,
		});

		// Build response
		const response = c.json(
			{
				...result,
				fingerprint: {
					hash: fingerprint.hash,
					country: fingerprint.country,
					asn: fingerprint.asn,
					botScore: fingerprint.botScore,
				},
				latency_ms: latency,
			},
			result.valid ? 200 : 400
		);

		// Add custom response headers if enabled
		if (env.ENABLE_RESPONSE_HEADERS === 'true') {
			response.headers.set('X-Risk-Score', result.riskScore.toString());
			response.headers.set('X-Fraud-Decision', result.decision);
			response.headers.set('X-Fraud-Reason', blockReason || 'none');
			response.headers.set('X-Fingerprint-Hash', fingerprint.hash);
			response.headers.set('X-Bot-Score', (fingerprint.botScore ?? 0).toString());
			response.headers.set('X-Country', fingerprint.country || 'unknown');
			response.headers.set('X-Detection-Latency-Ms', latency.toString());

			// Pattern detection headers (if available)
			if (patternFamilyResult) {
				response.headers.set('X-Pattern-Type', patternFamilyResult.patternType || 'none');
				response.headers.set('X-Pattern-Confidence', patternFamilyResult.confidence.toFixed(2));
			}
			if (gibberishResult?.isGibberish) {
				response.headers.set('X-Has-Gibberish', 'true');
			}
		}

		// Forward request to origin if configured
		if (env.ENABLE_ORIGIN_HEADERS === 'true' && env.ORIGIN_URL && env.ORIGIN_URL !== '') {
			try {
				const originHeaders = new Headers(c.req.raw.headers);

				// Add fraud detection headers to origin request
				originHeaders.set('X-Fraud-Risk-Score', result.riskScore.toString());
				originHeaders.set('X-Fraud-Decision', result.decision);
				originHeaders.set('X-Fraud-Reason', blockReason || 'none');
				originHeaders.set('X-Fraud-Fingerprint', fingerprint.hash);
				originHeaders.set('X-Fraud-Bot-Score', (fingerprint.botScore ?? 0).toString());
				originHeaders.set('X-Fraud-Country', fingerprint.country || 'unknown');
				originHeaders.set('X-Fraud-ASN', (fingerprint.asn ?? 0).toString());

				if (patternFamilyResult) {
					originHeaders.set('X-Fraud-Pattern-Type', patternFamilyResult.patternType || 'none');
					originHeaders.set('X-Fraud-Pattern-Confidence', patternFamilyResult.confidence.toFixed(2));
				}
				if (gibberishResult?.isGibberish) {
					originHeaders.set('X-Fraud-Has-Gibberish', 'true');
				}

				// Forward to origin (fire and forget - don't wait for response)
				c.executionCtx.waitUntil(
					fetch(env.ORIGIN_URL, {
						method: c.req.method,
						headers: originHeaders,
						body: c.req.raw.body,
					})
				);
			} catch (error) {
				// Log error but don't fail the request
				console.error('Failed to forward to origin:', error);
			}
		}

		return response;
	} catch (error) {
		logError(error as Error, { endpoint: '/validate' });
		return c.json({ error: 'Invalid request body' }, 400);
	}
});

export default app;
