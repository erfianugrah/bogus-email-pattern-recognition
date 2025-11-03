/**
 * Disposable Domain Updater Service
 *
 * Fetches disposable email domains from external sources and stores in KV.
 * Runs on a cron schedule (every 6 hours) to keep the list up-to-date.
 *
 * Sources:
 * - https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt
 * - Additional curated sources can be added
 */

import { logger } from '../logger';

export interface DisposableDomainUpdateResult {
	success: boolean;
	domainsCount: number;
	source: string;
	timestamp: string;
	error?: string;
}

/**
 * Fetch disposable domains from GitHub repository
 */
async function fetchFromGitHub(): Promise<string[]> {
	const url = 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt';

	const response = await fetch(url, {
		headers: {
			'User-Agent': 'Bogus-Email-Pattern-Recognition/1.0'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch from GitHub: ${response.status} ${response.statusText}`);
	}

	const text = await response.text();
	const domains = text
		.split('\n')
		.map(line => line.trim().toLowerCase())
		.filter(line => line && !line.startsWith('#')); // Remove empty lines and comments

	return domains;
}

/**
 * Fetch disposable domains from multiple sources
 */
async function fetchDisposableDomains(): Promise<string[]> {
	const sources = [
		{ name: 'GitHub', fetcher: fetchFromGitHub }
		// Add more sources here
	];

	const allDomains = new Set<string>();

	for (const source of sources) {
		try {
			logger.info({
				event: 'fetching_disposable_domains',
				source: source.name
			}, `Fetching disposable domains from ${source.name}`);

			const domains = await source.fetcher();

			domains.forEach(domain => allDomains.add(domain));

			logger.info({
				event: 'fetched_disposable_domains',
				source: source.name,
				count: domains.length
			}, `Fetched ${domains.length} domains from ${source.name}`);
		} catch (error) {
			logger.error({
				event: 'fetch_failed',
				source: source.name,
				error: error instanceof Error ? {
					message: error.message,
					stack: error.stack
				} : String(error)
			}, `Failed to fetch from ${source.name}`);
		}
	}

	return Array.from(allDomains).sort();
}

/**
 * Update disposable domains in KV storage
 */
export async function updateDisposableDomains(
	kv: KVNamespace
): Promise<DisposableDomainUpdateResult> {
	const startTime = Date.now();

	try {
		logger.info({
			event: 'update_started',
			trigger: 'scheduled'
		}, 'Starting disposable domain list update');

		// Fetch latest domains
		const domains = await fetchDisposableDomains();

		if (domains.length === 0) {
			throw new Error('No domains fetched from any source');
		}

		// Prepare metadata
		const metadata = {
			count: domains.length,
			lastUpdated: new Date().toISOString(),
			version: '1.0.0',
			sources: ['disposable-email-domains@github']
		};

		// Store in KV with metadata attached to the key itself
		// Using a single JSON value for now, but could be optimized with chunking for very large lists
		await kv.put('domains', JSON.stringify(domains), {
			metadata: metadata
		});

		const duration = Date.now() - startTime;

		logger.info({
			event: 'update_completed',
			domains_count: domains.length,
			duration_ms: duration,
			last_updated: metadata.lastUpdated
		}, `Successfully updated ${domains.length} disposable domains`);

		return {
			success: true,
			domainsCount: domains.length,
			source: 'combined',
			timestamp: metadata.lastUpdated
		};
	} catch (error) {
		const duration = Date.now() - startTime;

		logger.error({
			event: 'update_failed',
			duration_ms: duration,
			error: error instanceof Error ? {
				message: error.message,
				stack: error.stack
			} : String(error)
		}, 'Failed to update disposable domains');

		return {
			success: false,
			domainsCount: 0,
			source: 'combined',
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : String(error)
		};
	}
}

/**
 * Get disposable domain list metadata
 */
export async function getDisposableDomainMetadata(
	kv: KVNamespace
): Promise<{
	count: number;
	lastUpdated: string;
	version: string;
	sources: string[];
} | null> {
	try {
		// Get metadata from the domains key itself
		const result = await kv.getWithMetadata('domains');
		return result.metadata as any;
	} catch (error) {
		logger.error({
			event: 'metadata_fetch_failed',
			error: error instanceof Error ? error.message : String(error)
		}, 'Failed to fetch disposable domain metadata');
		return null;
	}
}

/**
 * Load disposable domains from KV (with caching)
 */
let cachedDomains: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

export async function loadDisposableDomains(
	kv: KVNamespace
): Promise<Set<string>> {
	// Return cached domains if still valid
	const now = Date.now();
	if (cachedDomains && (now - cacheTimestamp) < CACHE_TTL) {
		return cachedDomains;
	}

	try {
		const domainsJson = await kv.get('domains', 'json');

		if (domainsJson && Array.isArray(domainsJson)) {
			cachedDomains = new Set(domainsJson);
			cacheTimestamp = now;

			logger.info({
				event: 'domains_loaded_from_kv',
				count: cachedDomains.size,
				cached: true
			}, `Loaded ${cachedDomains.size} disposable domains from KV`);

			return cachedDomains;
		}

		logger.warn({
			event: 'domains_not_found_in_kv'
		}, 'No disposable domains found in KV, using fallback');

		// Fallback to empty set (caller should use hardcoded fallback)
		return new Set<string>();
	} catch (error) {
		logger.error({
			event: 'domains_load_failed',
			error: error instanceof Error ? error.message : String(error)
		}, 'Failed to load disposable domains from KV');

		// Return cached domains if available, even if expired
		if (cachedDomains) {
			logger.warn({
				event: 'using_expired_cache',
				count: cachedDomains.size
			}, 'Using expired cache due to KV load failure');
			return cachedDomains;
		}

		return new Set<string>();
	}
}

/**
 * Clear the domain cache (useful for testing or forcing reload)
 */
export function clearDomainCache(): void {
	cachedDomains = null;
	cacheTimestamp = 0;
}
