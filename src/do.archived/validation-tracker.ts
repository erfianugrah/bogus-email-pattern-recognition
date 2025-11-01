/**
 * ValidationTracker Durable Object
 *
 * Persistent storage for cross-request pattern tracking and rate limiting.
 * Uses SQLite for efficient querying and indexing.
 *
 * Key Features:
 * - Pattern family reputation tracking
 * - Multi-dimensional rate limiting (fingerprint, pattern, provider+pattern)
 * - Temporal analysis (inter-arrival times)
 * - Email normalization cache
 */

import { DurableObject } from 'cloudflare:workers';

export interface PatternFamilyData {
	family: string;
	familyHash: string;
	patternType: string;
	email: string;
	fingerprintHash: string;
	timestamp: number;
	wasBlocked: boolean;
}

export interface PatternReputation {
	family: string;
	totalAttempts: number;
	blockedAttempts: number;
	reputationScore: number; // 0.0-1.0 (higher = more suspicious)
	firstSeen: number;
	lastSeen: number;
}

export interface RateLimitResult {
	allowed: boolean;
	attemptsInWindow: number;
	limit: number;
	windowStart: number;
	windowEnd: number;
	reason?: string;
}

export interface TemporalScore {
	regularity: number; // 0.0-1.0 (higher = more regular/suspicious)
	averageInterval: number; // milliseconds
	intervalStdDev: number;
	burstDetected: boolean;
}

export interface PatternStat {
	family: string;
	patternType: string;
	attempts: number;
	blocks: number;
	blockRate: number;
	lastSeen: number;
}

export class ValidationTracker extends DurableObject {
	private sql: SqlStorage;

	constructor(state: DurableObjectState, env: Env) {
		super(state, env);
		this.sql = this.ctx.storage.sql;
		this.initializeTables();
	}

	/**
	 * Initialize SQLite tables with proper indexes
	 */
	private initializeTables(): void {
		// Table 1: Email Pattern Families
		// Tracks pattern families and their reputation over time
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS email_pattern_families (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				family_hash TEXT NOT NULL,
				family TEXT NOT NULL,
				pattern_type TEXT NOT NULL,
				total_attempts INTEGER DEFAULT 0,
				blocked_attempts INTEGER DEFAULT 0,
				reputation_score REAL DEFAULT 0.0,
				first_seen INTEGER NOT NULL,
				last_seen INTEGER NOT NULL,
				UNIQUE(family_hash)
			)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_family_hash
			ON email_pattern_families(family_hash)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_reputation
			ON email_pattern_families(reputation_score DESC, last_seen DESC)
		`);

		// Table 2: Pattern Rate Limits
		// Time-windowed rate limiting per pattern family
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS pattern_rate_limits (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				family_hash TEXT NOT NULL,
				fingerprint_hash TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				was_blocked INTEGER NOT NULL
			)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_pattern_rate_timestamp
			ON pattern_rate_limits(family_hash, timestamp DESC)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_fingerprint_rate_timestamp
			ON pattern_rate_limits(fingerprint_hash, timestamp DESC)
		`);

		// Table 3: Provider + Pattern Statistics
		// Tracks combinations like "gmail.com + dated pattern"
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS provider_pattern_stats (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				provider TEXT NOT NULL,
				pattern_type TEXT NOT NULL,
				attempts INTEGER DEFAULT 0,
				blocks INTEGER DEFAULT 0,
				last_seen INTEGER NOT NULL,
				UNIQUE(provider, pattern_type)
			)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_provider_pattern
			ON provider_pattern_stats(provider, pattern_type)
		`);

		// Table 4: Temporal Patterns
		// Tracks timing between attempts for pattern families
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS temporal_patterns (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				family_hash TEXT NOT NULL,
				timestamp INTEGER NOT NULL,
				interval_ms INTEGER
			)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_temporal_family_time
			ON temporal_patterns(family_hash, timestamp DESC)
		`);

		// Table 5: Email Normalizations Cache
		// Cache normalized emails for faster lookups
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS email_normalizations (
				original TEXT PRIMARY KEY,
				normalized TEXT NOT NULL,
				provider_normalized TEXT NOT NULL,
				has_plus INTEGER NOT NULL,
				plus_tag TEXT,
				created_at INTEGER NOT NULL
			)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_normalized
			ON email_normalizations(normalized)
		`);

		this.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_provider_normalized
			ON email_normalizations(provider_normalized)
		`);
	}

	/**
	 * Track a pattern family attempt
	 */
	async trackPatternFamily(data: PatternFamilyData): Promise<PatternReputation> {
		const now = Date.now();

		// Upsert pattern family record
		const existing = this.sql
			.exec(`SELECT * FROM email_pattern_families WHERE family_hash = ?`, data.familyHash)
			.toArray();

		if (existing.length === 0) {
			// New pattern family
			this.sql.exec(
				`INSERT INTO email_pattern_families
				(family_hash, family, pattern_type, total_attempts, blocked_attempts, first_seen, last_seen)
				VALUES (?, ?, ?, 1, ?, ?, ?)`,
				data.familyHash,
				data.family,
				data.patternType,
				data.wasBlocked ? 1 : 0,
				now,
				now
			);
		} else {
			// Update existing
			this.sql.exec(
				`UPDATE email_pattern_families
				SET total_attempts = total_attempts + 1,
				    blocked_attempts = blocked_attempts + ?,
				    last_seen = ?
				WHERE family_hash = ?`,
				data.wasBlocked ? 1 : 0,
				now,
				data.familyHash
			);
		}

		// Calculate reputation score
		const updated = this.sql
			.exec(`SELECT * FROM email_pattern_families WHERE family_hash = ?`, data.familyHash)
			.toArray()[0] as any;

		const blockRate = updated.total_attempts > 0
			? updated.blocked_attempts / updated.total_attempts
			: 0;

		// Reputation factors:
		// - High block rate increases reputation score
		// - Recent activity increases reputation score
		// - Volume increases reputation score
		const ageInDays = (now - updated.first_seen) / (1000 * 60 * 60 * 24);
		const recencyFactor = ageInDays < 1 ? 0.2 : ageInDays < 7 ? 0.1 : 0;
		const volumeFactor = Math.min(updated.total_attempts / 100, 0.3);

		const reputationScore = Math.min(blockRate * 0.6 + recencyFactor + volumeFactor, 1.0);

		// Update reputation score
		this.sql.exec(
			`UPDATE email_pattern_families SET reputation_score = ? WHERE family_hash = ?`,
			reputationScore,
			data.familyHash
		);

		// Record in rate limits table
		this.sql.exec(
			`INSERT INTO pattern_rate_limits
			(family_hash, fingerprint_hash, timestamp, was_blocked)
			VALUES (?, ?, ?, ?)`,
			data.familyHash,
			data.fingerprintHash,
			now,
			data.wasBlocked ? 1 : 0
		);

		// Update provider + pattern stats
		const [, domain] = data.email.split('@');
		this.updateProviderPatternStats(domain, data.patternType, data.wasBlocked);

		return {
			family: data.family,
			totalAttempts: updated.total_attempts + 1,
			blockedAttempts: updated.blocked_attempts + (data.wasBlocked ? 1 : 0),
			reputationScore,
			firstSeen: updated.first_seen,
			lastSeen: now
		};
	}

	/**
	 * Get reputation score for a pattern family
	 */
	getPatternReputation(familyHash: string): number {
		const result = this.sql
			.exec(`SELECT reputation_score FROM email_pattern_families WHERE family_hash = ?`, familyHash)
			.toArray();

		return result.length > 0 ? (result[0] as any).reputation_score : 0.0;
	}

	/**
	 * Check rate limit for a fingerprint
	 */
	checkFingerprintLimit(fingerprintHash: string, windowMs: number = 3600000, limit: number = 5): RateLimitResult {
		const now = Date.now();
		const windowStart = now - windowMs;

		const attempts = this.sql
			.exec(
				`SELECT COUNT(*) as count FROM pattern_rate_limits
				WHERE fingerprint_hash = ? AND timestamp >= ?`,
				fingerprintHash,
				windowStart
			)
			.toArray()[0] as any;

		const allowed = attempts.count < limit;

		return {
			allowed,
			attemptsInWindow: attempts.count,
			limit,
			windowStart,
			windowEnd: now,
			reason: allowed ? undefined : 'fingerprint_rate_limit_exceeded'
		};
	}

	/**
	 * Check rate limit for a pattern family
	 */
	checkPatternFamilyLimit(familyHash: string, windowMs: number = 3600000, limit: number = 10): RateLimitResult {
		const now = Date.now();
		const windowStart = now - windowMs;

		const attempts = this.sql
			.exec(
				`SELECT COUNT(*) as count FROM pattern_rate_limits
				WHERE family_hash = ? AND timestamp >= ?`,
				familyHash,
				windowStart
			)
			.toArray()[0] as any;

		const allowed = attempts.count < limit;

		return {
			allowed,
			attemptsInWindow: attempts.count,
			limit,
			windowStart,
			windowEnd: now,
			reason: allowed ? undefined : 'pattern_family_rate_limit_exceeded'
		};
	}

	/**
	 * Check rate limit for provider + pattern combination
	 */
	checkProviderPatternLimit(provider: string, patternType: string, windowMs: number = 3600000, limit: number = 20): RateLimitResult {
		const now = Date.now();
		const windowStart = now - windowMs;

		// This is a simpler check - just look at provider_pattern_stats
		const stats = this.sql
			.exec(
				`SELECT attempts FROM provider_pattern_stats
				WHERE provider = ? AND pattern_type = ? AND last_seen >= ?`,
				provider,
				patternType,
				windowStart
			)
			.toArray();

		const attempts = stats.length > 0 ? (stats[0] as any).attempts : 0;
		const allowed = attempts < limit;

		return {
			allowed,
			attemptsInWindow: attempts,
			limit,
			windowStart,
			windowEnd: now,
			reason: allowed ? undefined : 'provider_pattern_rate_limit_exceeded'
		};
	}

	/**
	 * Record timestamp for temporal analysis
	 */
	recordTimestamp(familyHash: string, timestamp: number): void {
		// Get previous timestamp
		const previous = this.sql
			.exec(
				`SELECT timestamp FROM temporal_patterns
				WHERE family_hash = ?
				ORDER BY timestamp DESC LIMIT 1`,
				familyHash
			)
			.toArray();

		const interval = previous.length > 0 ? timestamp - (previous[0] as any).timestamp : null;

		this.sql.exec(
			`INSERT INTO temporal_patterns (family_hash, timestamp, interval_ms)
			VALUES (?, ?, ?)`,
			familyHash,
			timestamp,
			interval
		);

		// Clean up old records (keep last 100 per family)
		this.sql.exec(
			`DELETE FROM temporal_patterns
			WHERE family_hash = ? AND id NOT IN (
				SELECT id FROM temporal_patterns
				WHERE family_hash = ?
				ORDER BY timestamp DESC LIMIT 100
			)`,
			familyHash,
			familyHash
		);
	}

	/**
	 * Analyze temporal patterns for regularity
	 */
	analyzeTemporalPattern(familyHash: string): TemporalScore {
		const intervals = this.sql
			.exec(
				`SELECT interval_ms FROM temporal_patterns
				WHERE family_hash = ? AND interval_ms IS NOT NULL
				ORDER BY timestamp DESC LIMIT 50`,
				familyHash
			)
			.toArray()
			.map((row: any) => row.interval_ms);

		if (intervals.length < 3) {
			return {
				regularity: 0,
				averageInterval: 0,
				intervalStdDev: 0,
				burstDetected: false
			};
		}

		// Calculate average and standard deviation
		const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
		const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
		const stdDev = Math.sqrt(variance);

		// Regularity: low standard deviation = high regularity
		// Coefficient of variation (CV) = stdDev / avg
		const cv = avg > 0 ? stdDev / avg : 1;
		const regularity = Math.max(0, Math.min(1, 1 - cv));

		// Burst detection: many attempts in short time
		const recent = intervals.slice(0, 10);
		const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
		const burstDetected = recentAvg < 60000 && recent.length >= 5; // 5+ attempts in < 1 min avg

		return {
			regularity,
			averageInterval: avg,
			intervalStdDev: stdDev,
			burstDetected
		};
	}

	/**
	 * Get top risky pattern families
	 */
	getTopRiskyPatterns(limit: number = 20): PatternStat[] {
		const results = this.sql
			.exec(
				`SELECT family, pattern_type, total_attempts, blocked_attempts,
				        reputation_score, last_seen
				FROM email_pattern_families
				WHERE total_attempts >= 3
				ORDER BY reputation_score DESC, last_seen DESC
				LIMIT ?`,
				limit
			)
			.toArray();

		return results.map((row: any) => ({
			family: row.family,
			patternType: row.pattern_type,
			attempts: row.total_attempts,
			blocks: row.blocked_attempts,
			blockRate: row.total_attempts > 0 ? row.blocked_attempts / row.total_attempts : 0,
			lastSeen: row.last_seen
		}));
	}

	/**
	 * Get statistics for a specific pattern family
	 */
	getPatternFamilyStats(familyHash: string): any {
		const family = this.sql
			.exec(`SELECT * FROM email_pattern_families WHERE family_hash = ?`, familyHash)
			.toArray()[0];

		if (!family) {
			return null;
		}

		const temporal = this.analyzeTemporalPattern(familyHash);

		return {
			...(family as any),
			temporal
		};
	}

	/**
	 * Cache normalized email
	 */
	cacheNormalizedEmail(original: string, normalized: string, providerNormalized: string, hasPlus: boolean, plusTag: string | null): void {
		const now = Date.now();

		this.sql.exec(
			`INSERT OR REPLACE INTO email_normalizations
			(original, normalized, provider_normalized, has_plus, plus_tag, created_at)
			VALUES (?, ?, ?, ?, ?, ?)`,
			original,
			normalized,
			providerNormalized,
			hasPlus ? 1 : 0,
			plusTag,
			now
		);
	}

	/**
	 * Get cached normalized email
	 */
	getCachedNormalization(original: string): any {
		const result = this.sql
			.exec(`SELECT * FROM email_normalizations WHERE original = ?`, original)
			.toArray();

		return result.length > 0 ? result[0] : null;
	}

	/**
	 * Update provider + pattern statistics (internal)
	 */
	private updateProviderPatternStats(provider: string, patternType: string, wasBlocked: boolean): void {
		const now = Date.now();

		const existing = this.sql
			.exec(`SELECT * FROM provider_pattern_stats WHERE provider = ? AND pattern_type = ?`, provider, patternType)
			.toArray();

		if (existing.length === 0) {
			this.sql.exec(
				`INSERT INTO provider_pattern_stats (provider, pattern_type, attempts, blocks, last_seen)
				VALUES (?, ?, 1, ?, ?)`,
				provider,
				patternType,
				wasBlocked ? 1 : 0,
				now
			);
		} else {
			this.sql.exec(
				`UPDATE provider_pattern_stats
				SET attempts = attempts + 1,
				    blocks = blocks + ?,
				    last_seen = ?
				WHERE provider = ? AND pattern_type = ?`,
				wasBlocked ? 1 : 0,
				now,
				provider,
				patternType
			);
		}
	}

	/**
	 * Cleanup old data (run periodically)
	 */
	async cleanup(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<{ deleted: number }> {
		const cutoff = Date.now() - olderThanMs;

		// Clean pattern_rate_limits
		const result1 = this.sql.exec(
			`DELETE FROM pattern_rate_limits WHERE timestamp < ?`,
			cutoff
		);

		// Clean temporal_patterns
		const result2 = this.sql.exec(
			`DELETE FROM temporal_patterns WHERE timestamp < ?`,
			cutoff
		);

		// Clean email_normalizations
		const result3 = this.sql.exec(
			`DELETE FROM email_normalizations WHERE created_at < ?`,
			cutoff
		);

		return {
			deleted: (result1.meta.changes || 0) + (result2.meta.changes || 0) + (result3.meta.changes || 0)
		};
	}

	/**
	 * HTTP handler for admin endpoints
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// GET /stats - Get top risky patterns
		if (url.pathname === '/stats' && request.method === 'GET') {
			const limit = parseInt(url.searchParams.get('limit') || '20');
			const stats = this.getTopRiskyPatterns(limit);
			return Response.json({ stats });
		}

		// GET /pattern/:hash - Get specific pattern stats
		if (url.pathname.startsWith('/pattern/') && request.method === 'GET') {
			const hash = url.pathname.split('/')[2];
			const stats = this.getPatternFamilyStats(hash);
			return Response.json(stats || { error: 'Pattern not found' }, { status: stats ? 200 : 404 });
		}

		// POST /cleanup - Run cleanup
		if (url.pathname === '/cleanup' && request.method === 'POST') {
			const result = await this.cleanup();
			return Response.json(result);
		}

		return new Response('Not Found', { status: 404 });
	}
}
