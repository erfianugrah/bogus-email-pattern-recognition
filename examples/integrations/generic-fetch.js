/**
 * Generic Fetch API Integration Example
 *
 * This example shows how to integrate the fraud detection worker
 * using the standard Fetch API. Works in any JavaScript environment:
 * - Node.js (18+)
 * - Deno
 * - Bun
 * - Browser
 * - Cloudflare Workers
 * - Vercel Edge Functions
 * - AWS Lambda@Edge
 */

// Configuration
const FRAUD_DETECTION_URL = 'https://your-worker.workers.dev/validate';
const TIMEOUT_MS = 2000; // 2 seconds

/**
 * Validate email with fraud detection (fail-open)
 *
 * @param {string} email - Email address to validate
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<{allow: boolean, decision: string, riskScore: number}>}
 */
async function validateEmail(email, signal = null) {
	try {
		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

		// Combine timeout signal with optional external signal
		const combinedSignal = signal
			? combineAbortSignals(controller.signal, signal)
			: controller.signal;

		const response = await fetch(FRAUD_DETECTION_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email }),
			signal: combinedSignal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			console.warn(`Fraud detection returned ${response.status}, allowing email`);
			return { allow: true, decision: 'allow', riskScore: 0 };
		}

		const result = await response.json();

		return {
			allow: result.decision !== 'block',
			decision: result.decision,
			riskScore: result.riskScore,
			signals: result.signals,
		};
	} catch (error) {
		// Fail open: Allow if service is unavailable
		if (error.name === 'AbortError') {
			console.warn('Fraud detection timeout, allowing email');
		} else {
			console.error('Fraud detection failed:', error.message);
		}
		console.info('Failing open: allowing signup to proceed');
		return { allow: true, decision: 'allow', riskScore: 0 };
	}
}

/**
 * Combine multiple abort signals (polyfill for older environments)
 */
function combineAbortSignals(...signals) {
	const controller = new AbortController();

	for (const signal of signals) {
		if (signal.aborted) {
			controller.abort();
			return controller.signal;
		}

		signal.addEventListener('abort', () => controller.abort(), { once: true });
	}

	return controller.signal;
}

/**
 * Example 1: Simple validation
 */
async function example1_simple() {
	const email = 'test123@example.com';

	const validation = await validateEmail(email);

	if (validation.allow) {
		console.log('✅ Email allowed');
		console.log(`   Decision: ${validation.decision}`);
		console.log(`   Risk Score: ${validation.riskScore}`);
		// Continue with signup...
	} else {
		console.log('❌ Email blocked');
		console.log(`   Risk Score: ${validation.riskScore}`);
		// Reject signup
	}
}

/**
 * Example 2: Batch validation
 */
async function example2_batch() {
	const emails = [
		'user1@example.com',
		'test123@fake.com',
		'john.doe@gmail.com',
		'qwerty123@disposable.com',
	];

	const results = await Promise.all(emails.map((email) => validateEmail(email)));

	results.forEach((result, i) => {
		console.log(`${emails[i]}: ${result.decision} (${result.riskScore.toFixed(2)})`);
	});

	// Filter out blocked emails
	const allowedEmails = emails.filter((_, i) => results[i].allow);
	console.log(`\nAllowed: ${allowedEmails.length}/${emails.length}`);
}

/**
 * Example 3: Validation with retry
 */
async function validateEmailWithRetry(email, maxRetries = 2) {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const result = await validateEmail(email);

			// If we got a result (even if it's fail-open), return it
			return result;
		} catch (error) {
			if (attempt === maxRetries) {
				// Final retry failed, fail open
				console.warn(`All retries exhausted for ${email}, failing open`);
				return { allow: true, decision: 'allow', riskScore: 0 };
			}

			// Wait before retry (exponential backoff)
			const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
			console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

/**
 * Example 4: Validation with caching
 */
const validationCache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function validateEmailCached(email) {
	// Check cache first
	const cached = validationCache.get(email);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		console.log(`Cache hit for ${email}`);
		return cached.result;
	}

	// Validate
	const result = await validateEmail(email);

	// Cache result
	validationCache.set(email, {
		result,
		timestamp: Date.now(),
	});

	return result;
}

/**
 * Example 5: Progressive enforcement
 *
 * Start by logging only, then warn, then block over time.
 */
class ProgressiveEnforcement {
	constructor() {
		this.mode = 'log'; // 'log' | 'warn' | 'block'
	}

	async validate(email) {
		const result = await validateEmail(email);

		switch (this.mode) {
			case 'log':
				// Log only, never block
				if (result.decision === 'block') {
					console.log(`[LOG MODE] Would have blocked: ${email}`);
				}
				return { ...result, allow: true };

			case 'warn':
				// Block high-risk only
				if (result.decision === 'block' && result.riskScore > 0.8) {
					return result; // Actually block
				}
				if (result.decision === 'block') {
					console.warn(`[WARN MODE] Would have blocked: ${email}`);
					return { ...result, allow: true }; // Allow but log
				}
				return result;

			case 'block':
				// Full enforcement
				return result;

			default:
				return result;
		}
	}

	// Transition between modes
	setMode(mode) {
		console.log(`Switching enforcement mode to: ${mode}`);
		this.mode = mode;
	}
}

/**
 * Example 6: Circuit breaker pattern
 *
 * Stop calling fraud detection if it's consistently failing.
 */
class CircuitBreaker {
	constructor(threshold = 5, timeout = 60000) {
		this.failures = 0;
		this.threshold = threshold;
		this.timeout = timeout;
		this.state = 'closed'; // 'closed' | 'open' | 'half-open'
		this.nextAttempt = 0;
	}

	async execute(fn) {
		// If circuit is open, fail fast
		if (this.state === 'open') {
			if (Date.now() < this.nextAttempt) {
				console.warn('Circuit breaker OPEN, failing open immediately');
				return { allow: true, decision: 'allow', riskScore: 0 };
			}
			// Try to close circuit
			this.state = 'half-open';
			console.log('Circuit breaker HALF-OPEN, attempting request');
		}

		try {
			const result = await fn();

			// Success - reset failures
			if (this.state === 'half-open') {
				console.log('Circuit breaker CLOSED');
				this.state = 'closed';
			}
			this.failures = 0;

			return result;
		} catch (error) {
			this.failures++;

			if (this.failures >= this.threshold) {
				this.state = 'open';
				this.nextAttempt = Date.now() + this.timeout;
				console.error(
					`Circuit breaker OPEN after ${this.failures} failures. Next attempt: ${new Date(this.nextAttempt).toISOString()}`
				);
			}

			// Fail open
			return { allow: true, decision: 'allow', riskScore: 0 };
		}
	}
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function validateWithCircuitBreaker(email) {
	return breaker.execute(() => validateEmail(email));
}

/**
 * Example 7: Integration with form submission
 */
async function handleFormSubmit(event) {
	event.preventDefault();

	const formData = new FormData(event.target);
	const email = formData.get('email');
	const password = formData.get('password');
	const name = formData.get('name');

	// Show loading state
	const submitButton = event.target.querySelector('button[type="submit"]');
	submitButton.disabled = true;
	submitButton.textContent = 'Checking email...';

	try {
		// Validate email
		const validation = await validateEmail(email);

		if (!validation.allow) {
			// Show error
			alert('This email address cannot be used for signup');
			return;
		}

		if (validation.decision === 'warn') {
			console.warn(`Suspicious signup: ${email}`);
			// Could show warning message or require additional verification
		}

		// Continue with signup
		await submitSignup(email, password, name);

		// Show success
		alert('Signup successful!');
	} catch (error) {
		console.error('Signup error:', error);
		alert('An error occurred. Please try again.');
	} finally {
		// Reset button
		submitButton.disabled = false;
		submitButton.textContent = 'Sign Up';
	}
}

async function submitSignup(email, password, name) {
	// ... actual signup logic
}

/**
 * Run examples
 */
if (typeof module !== 'undefined' && require.main === module) {
	(async () => {
		console.log('=== Example 1: Simple Validation ===');
		await example1_simple();

		console.log('\n=== Example 2: Batch Validation ===');
		await example2_batch();

		console.log('\n=== Example 3: Validation with Retry ===');
		const result = await validateEmailWithRetry('test@example.com');
		console.log('Result:', result);

		console.log('\n=== Example 4: Cached Validation ===');
		await validateEmailCached('cached@example.com');
		await validateEmailCached('cached@example.com'); // Cache hit

		console.log('\n=== Example 5: Progressive Enforcement ===');
		const enforcer = new ProgressiveEnforcement();
		await enforcer.validate('suspicious@example.com');
		enforcer.setMode('block');
		await enforcer.validate('suspicious@example.com');

		console.log('\n=== Example 6: Circuit Breaker ===');
		await validateWithCircuitBreaker('test@example.com');
	})();
}

/**
 * Export for use in other modules
 */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		validateEmail,
		validateEmailWithRetry,
		validateEmailCached,
		ProgressiveEnforcement,
		CircuitBreaker,
	};
}

/**
 * Key Features:
 *
 * 1. Fail-Open: Always allows on error
 * 2. Timeout: 2 second timeout
 * 3. Retry logic: Exponential backoff
 * 4. Caching: Avoid duplicate validations
 * 5. Progressive enforcement: Gradual rollout
 * 6. Circuit breaker: Stop cascading failures
 * 7. Works everywhere: Node.js, Deno, Bun, Browser
 *
 * Production Considerations:
 *
 * - Use environment variables for FRAUD_DETECTION_URL
 * - Monitor validation success rate
 * - Implement circuit breaker for production
 * - Use caching for repeat validations
 * - Start with log-only mode, then warn, then block
 * - Add metrics/monitoring
 * - Consider progressive enhancement
 */
