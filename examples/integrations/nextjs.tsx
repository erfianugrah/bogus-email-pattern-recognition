/**
 * Next.js Integration Example (TypeScript)
 *
 * This example shows how to integrate the fraud detection worker
 * into a Next.js App Router signup flow with fail-open behavior.
 *
 * File: app/api/signup/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';

// Configuration
const FRAUD_DETECTION_URL =
	process.env.FRAUD_DETECTION_URL || 'https://your-worker.workers.dev/validate';
const TIMEOUT_MS = 2000;

interface FraudValidationResult {
	allow: boolean;
	decision: 'allow' | 'warn' | 'block';
	riskScore: number;
	signals?: any;
}

/**
 * Validate email with fraud detection (fail-open)
 */
async function validateEmail(email: string): Promise<FraudValidationResult> {
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

		return {
			allow: result.decision !== 'block',
			decision: result.decision,
			riskScore: result.riskScore,
			signals: result.signals,
		};
	} catch (error) {
		// Fail open: Allow signup if fraud detection is unavailable
		console.error('Fraud detection failed:', error);
		console.info('Failing open: allowing signup to proceed');
		return { allow: true, decision: 'allow', riskScore: 0 };
	}
}

/**
 * POST /api/signup
 * Signup API route with inline fraud detection
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { email, password, name } = body;

		// Basic validation
		if (!email || !password || !name) {
			return NextResponse.json(
				{ error: 'Missing required fields' },
				{ status: 400 }
			);
		}

		// Validate email with fraud detection (transparent, fail-open)
		const validation = await validateEmail(email);

		// Block if fraud detection says so
		if (!validation.allow) {
			console.warn(`Blocked signup: ${email} (risk: ${validation.riskScore})`);
			return NextResponse.json(
				{
					error: 'Unable to process signup',
					message: 'This email address cannot be used for signup',
				},
				{ status: 400 }
			);
		}

		// Log warning if flagged but not blocked
		if (validation.decision === 'warn') {
			console.warn(`Suspicious signup: ${email} (risk: ${validation.riskScore})`);
			// You could add extra verification steps here
		}

		// Continue with normal signup flow
		// ... (create user in database, send verification email, etc.)

		return NextResponse.json({
			success: true,
			message: 'Signup successful',
		});
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

/**
 * Alternative: Server Action approach (Next.js 13+)
 *
 * File: app/actions/signup.ts
 */

'use server';

interface SignupData {
	email: string;
	password: string;
	name: string;
}

interface SignupResult {
	success: boolean;
	error?: string;
	message?: string;
}

export async function signupAction(data: SignupData): Promise<SignupResult> {
	try {
		const { email, password, name } = data;

		// Validate email with fraud detection
		const validation = await validateEmail(email);

		// Block if necessary
		if (!validation.allow) {
			console.warn(`Blocked signup: ${email} (risk: ${validation.riskScore})`);
			return {
				success: false,
				error: 'This email address cannot be used for signup',
			};
		}

		// Log warning if flagged
		if (validation.decision === 'warn') {
			console.warn(`Suspicious signup: ${email} (risk: ${validation.riskScore})`);
		}

		// Continue with signup...
		// ... (database operations, send email, etc.)

		return {
			success: true,
			message: 'Signup successful',
		};
	} catch (error) {
		console.error('Signup error:', error);
		return {
			success: false,
			error: 'An unexpected error occurred',
		};
	}
}

/**
 * Client Component using Server Action
 *
 * File: app/signup/page.tsx
 */

'use client';

import { useState } from 'react';
// import { signupAction } from '@/app/actions/signup';

export default function SignupPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError('');

		try {
			// Call server action
			// const result = await signupAction({ email, password, name });

			// Or call API route
			const response = await fetch('/api/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password, name }),
			});

			const result = await response.json();

			if (result.success) {
				setSuccess(true);
			} else {
				setError(result.error || 'Signup failed');
			}
		} catch (err) {
			setError('An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	}

	if (success) {
		return (
			<div className="success-message">
				<h2>Signup successful!</h2>
				<p>Check your email to verify your account.</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit}>
			<h1>Sign Up</h1>

			{error && <div className="error">{error}</div>}

			<input
				type="text"
				placeholder="Name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				required
			/>

			<input
				type="email"
				placeholder="Email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			/>

			<input
				type="password"
				placeholder="Password"
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				required
			/>

			<button type="submit" disabled={loading}>
				{loading ? 'Signing up...' : 'Sign Up'}
			</button>
		</form>
	);
}

/**
 * Alternative: Middleware approach (Edge Runtime)
 *
 * File: middleware.ts
 *
 * This approach validates emails at the edge before reaching your API.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
	// Only apply to signup endpoint
	if (!request.url.includes('/api/signup')) {
		return NextResponse.next();
	}

	try {
		const body = await request.json();
		const { email } = body;

		if (email) {
			const validation = await validateEmail(email);

			// Block if necessary
			if (!validation.allow) {
				return NextResponse.json(
					{ error: 'This email address cannot be used' },
					{ status: 400 }
				);
			}

			// Add validation result to request headers for downstream use
			const response = NextResponse.next();
			response.headers.set('x-fraud-decision', validation.decision);
			response.headers.set('x-fraud-risk-score', String(validation.riskScore));
			return response;
		}
	} catch (error) {
		console.error('Middleware error:', error);
		// Fail open: continue with request
	}

	return NextResponse.next();
}

export const config = {
	matcher: '/api/signup',
};

/**
 * Key Features:
 *
 * 1. Fail-Open: If fraud detection fails, signup continues
 * 2. Timeout: 2 second timeout prevents blocking user flow
 * 3. Multiple approaches: API route, Server Action, Middleware
 * 4. Type-safe: Full TypeScript support
 * 5. Edge-ready: Works on Cloudflare Pages/Vercel Edge
 *
 * Environment Variables (.env.local):
 *
 * FRAUD_DETECTION_URL=https://your-worker.workers.dev/validate
 *
 * Production Considerations:
 *
 * - Use environment variables for configuration
 * - Add retry logic for transient failures
 * - Monitor fraud detection success rate
 * - Implement progressive enforcement
 * - Add client-side validation for better UX
 * - Use React Hook Form for form management
 * - Add rate limiting at the edge
 */
