/**
 * Analytics API Routes
 *
 * Endpoints for querying Analytics Engine data for the dashboard
 */

import { Hono } from 'hono';
import { requireApiKey } from '../middleware/auth';
import { logger } from '../logger';

const analytics = new Hono<{ Bindings: Env }>();

// Apply API key authentication to all analytics routes
analytics.use('/*', requireApiKey);

/**
 * POST /api/analytics/query
 * Execute a SQL query against Analytics Engine
 * Body: { sql: string }
 */
analytics.post('/query', async (c) => {
	try {
		const body = await c.req.json<{ sql: string }>();

		if (!body.sql) {
			return c.json({ error: 'SQL query is required' }, 400);
		}

		// Basic SQL injection protection - only allow SELECT queries
		const trimmedSQL = body.sql.trim().toUpperCase();
		if (!trimmedSQL.startsWith('SELECT')) {
			return c.json({ error: 'Only SELECT queries are allowed' }, 400);
		}

		// Query Analytics Engine
		const result = await c.env.ANALYTICS.fetch(
			`https://dummy.host/sql?${new URLSearchParams({ query: body.sql })}`
		);

		if (!result.ok) {
			logger.error({
				event: 'analytics_query_failed',
				status: result.status,
				statusText: result.statusText,
			}, 'Analytics query failed');

			return c.json(
				{
					error: 'Analytics query failed',
					status: result.status,
				},
				result.status
			);
		}

		const data = await result.json();

		return c.json({
			success: true,
			data,
		});
	} catch (error) {
		logger.error({
			event: 'analytics_query_error',
			error: error instanceof Error ? {
				message: error.message,
				stack: error.stack,
			} : String(error),
		}, 'Analytics query error');

		return c.json(
			{
				error: 'Failed to execute query',
				message: error instanceof Error ? error.message : 'Unknown error',
			},
			500
		);
	}
});

export default analytics;
