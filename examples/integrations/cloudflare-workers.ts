/**
 * Cloudflare Workers Integration Example (RPC)
 *
 * This example shows how to integrate the fraud detection worker
 * into another Cloudflare Worker using RPC (Worker-to-Worker communication).
 *
 * RPC is 5-10x faster than HTTP and provides type safety.
 */

/**
 * Step 1: Configure Service Binding in wrangler.jsonc
 *
 * Add this to your consuming worker's wrangler.jsonc:
 *
 * {
 *   "services": [{
 *     "binding": "FRAUD_DETECTOR",
 *     "service": "bogus-email-pattern-recognition",
 *     "entrypoint": "FraudDetectionService"
 *   }]
 * }
 */

/**
 * Step 2: Define the RPC interface (optional, for type safety)
 */

interface FraudValidationResult {
	valid: boolean;
	riskScore: number;
	decision: 'allow' | 'warn' | 'block';
	message: string;
	signals: any;
	fingerprint: any;
	latency_ms: number;
}

interface FraudDetectionService {
	validate(params: {
		email: string;
		consumer?: string;
		flow?: string;
		headers?: Record<string, string | null>;
	}): Promise<FraudValidationResult>;
}

/**
 * Step 3: Use RPC in your Worker
 */

interface Env {
	FRAUD_DETECTOR: Service<FraudDetectionService>;
	// ... other bindings
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Signup endpoint
		if (url.pathname === '/api/signup' && request.method === 'POST') {
			return handleSignup(request, env, ctx);
		}

		return new Response('Not Found', { status: 404 });
	},
};

/**
 * Handle signup with inline fraud detection (RPC)
 */
async function handleSignup(
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	try {
		const body = await request.json<{
			email: string;
			password: string;
			name: string;
		}>();

		const { email, password, name } = body;

		// Basic validation
		if (!email || !password || !name) {
			return Response.json(
				{ error: 'Missing required fields' },
				{ status: 400 }
			);
		}

		// Validate email with fraud detection via RPC (fail-open)
		const validation = await validateEmailRPC(email, request, env);

		// Block if fraud detection says so
		if (!validation.allow) {
			console.warn(`Blocked signup: ${email} (risk: ${validation.riskScore})`);
			return Response.json(
				{
					error: 'Unable to process signup',
					message: 'This email address cannot be used for signup',
				},
				{ status: 400 }
			);
		}

		// Log warning if flagged
		if (validation.decision === 'warn') {
			console.warn(`Suspicious signup: ${email} (risk: ${validation.riskScore})`);
		}

		// Continue with signup...
		// ... (database operations, etc.)

		return Response.json({
			success: true,
			message: 'Signup successful',
		});
	} catch (error) {
		console.error('Signup error:', error);
		return Response.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

/**
 * Validate email via RPC with fail-open behavior
 */
async function validateEmailRPC(
	email: string,
	request: Request,
	env: Env
): Promise<{
	allow: boolean;
	decision: 'allow' | 'warn' | 'block';
	riskScore: number;
}> {
	try {
		// Call fraud detection service via RPC
		// Pass through fingerprinting headers
		const result = await env.FRAUD_DETECTOR.validate({
			email,
			consumer: 'MY_APP',
			flow: 'SIGNUP_EMAIL_VERIFY',
			headers: {
				'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
				'user-agent': request.headers.get('user-agent'),
				'cf-ipcountry': request.headers.get('cf-ipcountry'),
				'cf-ray': request.headers.get('cf-ray'),
			},
		});

		return {
			allow: result.decision !== 'block',
			decision: result.decision,
			riskScore: result.riskScore,
		};
	} catch (error) {
		// Fail open: Allow signup if RPC call fails
		console.error('Fraud detection RPC failed:', error);
		console.info('Failing open: allowing signup to proceed');
		return { allow: true, decision: 'allow', riskScore: 0 };
	}
}

/**
 * Alternative: Middleware pattern with RPC
 */

class MyWorker extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/signup' && request.method === 'POST') {
			// Validate email first (middleware-style)
			const body = await request.json<any>();
			const { email } = body;

			if (email) {
				const validation = await validateEmailRPC(email, request, this.env);

				// Block if necessary
				if (!validation.allow) {
					return Response.json(
						{ error: 'This email address cannot be used' },
						{ status: 400 }
					);
				}
			}

			// Continue with signup...
			return Response.json({ success: true });
		}

		return new Response('Not Found', { status: 404 });
	}
}

/**
 * Alternative: Background validation (non-blocking)
 *
 * Use this when you want to log fraud attempts but never block signups.
 */

async function handleSignupWithBackgroundValidation(
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	try {
		const body = await request.json<{
			email: string;
			password: string;
			name: string;
		}>();

		const { email, password, name } = body;

		// Validate in background (don't await)
		ctx.waitUntil(
			(async () => {
				try {
					const result = await env.FRAUD_DETECTOR.validate({
						email,
						consumer: 'MY_APP',
						flow: 'SIGNUP_EMAIL_VERIFY',
						headers: {
							'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
							'user-agent': request.headers.get('user-agent'),
							'cf-ipcountry': request.headers.get('cf-ipcountry'),
						},
					});

					// Log for analytics only
					if (result.decision === 'block') {
						console.warn(`Would have blocked: ${email} (risk: ${result.riskScore})`);
					}
				} catch (error) {
					console.error('Background fraud validation failed:', error);
				}
			})()
		);

		// Immediately continue with signup (no blocking)
		// ... (database operations, etc.)

		return Response.json({
			success: true,
			message: 'Signup successful',
		});
	} catch (error) {
		console.error('Signup error:', error);
		return Response.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

/**
 * Alternative: HTTP fallback (when RPC is not available)
 */

async function validateEmailHTTP(email: string): Promise<{
	allow: boolean;
	decision: 'allow' | 'warn' | 'block';
	riskScore: number;
}> {
	try {
		const response = await fetch('https://your-worker.workers.dev/validate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email }),
		});

		if (!response.ok) {
			console.warn(`Fraud detection returned ${response.status}, allowing email`);
			return { allow: true, decision: 'allow', riskScore: 0 };
		}

		const result = await response.json<FraudValidationResult>();

		return {
			allow: result.decision !== 'block',
			decision: result.decision,
			riskScore: result.riskScore,
		};
	} catch (error) {
		console.error('Fraud detection HTTP failed:', error);
		return { allow: true, decision: 'allow', riskScore: 0 };
	}
}

/**
 * Key Features:
 *
 * 1. RPC Communication: 5-10x faster than HTTP
 * 2. Type Safety: Full TypeScript support with interfaces
 * 3. Fail-Open: If RPC fails, signup continues
 * 4. Fingerprinting: Pass through Cloudflare request headers
 * 5. Multiple patterns: Inline, middleware, background, HTTP fallback
 *
 * Performance Benefits:
 *
 * - RPC latency: ~0.1-0.5ms (same region)
 * - HTTP latency: ~5-20ms (round-trip)
 * - RPC eliminates serialization overhead
 * - RPC uses direct Worker-to-Worker communication
 *
 * Production Considerations:
 *
 * - Use RPC for low-latency validation
 * - Use background validation for analytics-only mode
 * - Monitor RPC success rate
 * - Add circuit breaker for repeated failures
 * - Use HTTP as fallback when RPC is unavailable
 *
 * Configuration:
 *
 * In your consuming worker's wrangler.jsonc:
 * {
 *   "name": "my-app",
 *   "main": "./src/index.ts",
 *   "services": [{
 *     "binding": "FRAUD_DETECTOR",
 *     "service": "bogus-email-pattern-recognition",
 *     "entrypoint": "FraudDetectionService"
 *   }]
 * }
 */
