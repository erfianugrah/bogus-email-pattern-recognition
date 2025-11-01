/**
 * Express.js Integration Example
 *
 * This example shows how to integrate the fraud detection worker
 * into an Express.js signup flow with fail-open behavior.
 *
 * Install: npm install express
 */

const express = require('express');
const app = express();

app.use(express.json());

// Configuration
const FRAUD_DETECTION_URL = 'https://your-worker.workers.dev/validate';
const TIMEOUT_MS = 2000; // 2 second timeout

/**
 * Validate email with fraud detection (fail-open)
 *
 * @param {string} email - Email address to validate
 * @returns {Promise<{allow: boolean, decision: string, riskScore: number}>}
 */
async function validateEmail(email) {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const response = await fetch(FRAUD_DETECTION_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ email }),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			console.warn(`Fraud detection returned ${response.status}, allowing email`);
			return { allow: true, decision: 'allow', riskScore: 0 };
		}

		const result = await response.json();

		// Return validation result
		return {
			allow: result.decision !== 'block',
			decision: result.decision,
			riskScore: result.riskScore,
			signals: result.signals,
		};
	} catch (error) {
		// Fail open: Allow signup if fraud detection is unavailable
		console.error('Fraud detection failed:', error.message);
		console.info('Failing open: allowing signup to proceed');
		return { allow: true, decision: 'allow', riskScore: 0 };
	}
}

/**
 * Signup endpoint with inline fraud detection
 */
app.post('/api/signup', async (req, res) => {
	const { email, password, name } = req.body;

	// Basic validation
	if (!email || !password || !name) {
		return res.status(400).json({
			error: 'Missing required fields',
		});
	}

	try {
		// Validate email with fraud detection (transparent, fail-open)
		const validation = await validateEmail(email);

		// Block if fraud detection says so
		if (!validation.allow) {
			console.warn(`Blocked signup: ${email} (risk: ${validation.riskScore})`);
			return res.status(400).json({
				error: 'Unable to process signup',
				message: 'This email address cannot be used for signup',
			});
		}

		// Log warning if flagged but not blocked
		if (validation.decision === 'warn') {
			console.warn(`Suspicious signup: ${email} (risk: ${validation.riskScore})`);
			// You could add extra verification steps here (e.g., email verification)
		}

		// Continue with normal signup flow
		// ... (create user, send verification email, etc.)

		res.json({
			success: true,
			message: 'Signup successful',
		});
	} catch (error) {
		console.error('Signup error:', error);
		res.status(500).json({
			error: 'Internal server error',
		});
	}
});

/**
 * Alternative: Middleware approach
 */
async function fraudDetectionMiddleware(req, res, next) {
	const { email } = req.body;

	if (!email) {
		return next(); // Skip if no email
	}

	try {
		const validation = await validateEmail(email);

		// Attach validation result to request
		req.fraudValidation = validation;

		// Block if necessary
		if (!validation.allow) {
			return res.status(400).json({
				error: 'Unable to process request',
				message: 'This email address cannot be used',
			});
		}

		next();
	} catch (error) {
		// Fail open: Continue with request
		console.error('Fraud detection middleware error:', error.message);
		req.fraudValidation = { allow: true, decision: 'allow', riskScore: 0 };
		next();
	}
}

// Use middleware for all signup-related endpoints
app.post('/api/signup-with-middleware', fraudDetectionMiddleware, async (req, res) => {
	const { email, password, name } = req.body;

	// Fraud validation already completed by middleware
	const validation = req.fraudValidation;

	if (validation.decision === 'warn') {
		console.warn(`Suspicious signup: ${email} (risk: ${validation.riskScore})`);
	}

	// Continue with signup...
	res.json({
		success: true,
		message: 'Signup successful',
		fraudCheck: {
			decision: validation.decision,
			riskScore: validation.riskScore,
		},
	});
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
	res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

/**
 * Key Features:
 *
 * 1. Fail-Open: If fraud detection fails, signup continues
 * 2. Timeout: 2 second timeout prevents blocking user flow
 * 3. Transparent: Fraud detection doesn't break normal flow
 * 4. Logging: Warnings and blocks are logged for analysis
 * 5. Middleware: Optional middleware approach for reusability
 *
 * Production Considerations:
 *
 * - Use environment variables for FRAUD_DETECTION_URL
 * - Add retry logic for transient failures
 * - Monitor fraud detection success rate
 * - Implement progressive enforcement (warn → block over time)
 * - Add metrics tracking (validation success/failure rates)
 */
