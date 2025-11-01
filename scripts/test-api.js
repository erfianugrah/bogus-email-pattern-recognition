/**
 * API Test Script for Email Validation
 *
 * Tests the /validate endpoint with various email scenarios
 * using the standard payload format: { email, consumer, flow }
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Run this script: node test-api.js
 */

const BASE_URL = 'http://localhost:8787';

const testCases = [
	// User's specific test cases
	{
		email: 'user@service.com',
		consumer: 'OWF',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},
	{
		email: 'user@service.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},

	// Legitimate emails - should ALLOW
	{
		email: 'person1.person2@company.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'personI.personJ@enterprise.org',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},
	{
		email: 'personG.personH@business.net',
		consumer: 'API',
		flow: 'PASSWORD_RESET',
	},

	// Free email providers - should WARN
	{
		email: 'user123@gmail.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'testuser@yahoo.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Disposable domains - should BLOCK
	{
		email: 'temp123@throwaway.email',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'fake@tempmail.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},
	{
		email: 'test@guerrillamail.com',
		consumer: 'API',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},

	// Sequential patterns - should WARN/BLOCK
	{
		email: 'user1@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'user2@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'test001@company.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Dated patterns - should WARN/BLOCK
	{
		email: 'person1.person2@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'user_2025@company.com',
		consumer: 'PORTAL',
		flow: 'PASSWORD_RESET',
	},

	// Plus-addressing - should be detected
	{
		email: 'user+1@gmail.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'test+tag@yahoo.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Keyboard walks - should WARN/BLOCK
	{
		email: 'qwerty@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'asdfgh@test.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},
	{
		email: '123456@example.com',
		consumer: 'API',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},

	// Gibberish - should BLOCK
	{
		email: 'xk9m2qw7r4p3@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'zxkj3mq9wr@test.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// High-risk TLDs
	{
		email: 'user@example.tk',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'test@service.ml',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Trusted TLDs - should ALLOW
	{
		email: 'professor@university.edu',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'admin@government.gov',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Invalid formats - should BLOCK
	{
		email: 'notanemail',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: '@nodomain.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},

	// Short emails - should BLOCK
	{
		email: 'a@example.com',
		consumer: 'OWF',
		flow: 'SIGNUP_EMAIL_VERIFY',
	},
	{
		email: 'ab@test.com',
		consumer: 'PORTAL',
		flow: 'PWDLESS_LOGIN_EMAIL',
	},
];

async function testValidation(payload) {
	try {
		const response = await fetch(`${BASE_URL}/validate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		const result = await response.json();

		return {
			success: true,
			payload,
			result,
		};
	} catch (error) {
		return {
			success: false,
			payload,
			error: error.message,
		};
	}
}

async function runTests() {
	console.log('🚀 Starting Email Validation Tests');
	console.log('='.repeat(80));
	console.log();

	const results = {
		total: testCases.length,
		allow: 0,
		warn: 0,
		block: 0,
		errors: 0,
	};

	for (let i = 0; i < testCases.length; i++) {
		const testCase = testCases[i];
		console.log(`Test ${i + 1}/${testCases.length}:`);
		console.log(`  Email:    ${testCase.email}`);
		console.log(`  Consumer: ${testCase.consumer}`);
		console.log(`  Flow:     ${testCase.flow}`);

		const result = await testValidation(testCase);

		if (result.success) {
			const decision = result.result.decision;
			const riskScore = result.result.riskScore;

			results[decision]++;

			const decisionSymbol =
				decision === 'allow' ? '✅' : decision === 'warn' ? '⚠️' : '❌';

			console.log(
				`  ${decisionSymbol} Decision: ${decision.toUpperCase()} (Risk: ${riskScore.toFixed(2)})`
			);

			// Show key signals
			const signals = result.result.signals;
			if (signals.isDisposableDomain) {
				console.log(`  🔍 Disposable domain detected`);
			}
			if (signals.isFreeProvider) {
				console.log(`  🔍 Free email provider`);
			}
			if (signals.hasPlusAddressing) {
				console.log(`  🔍 Plus-addressing detected`);
			}
			if (signals.hasKeyboardWalk) {
				console.log(
					`  🔍 Keyboard walk detected (${signals.keyboardWalkType})`
				);
			}
			if (signals.isGibberish) {
				console.log(`  🔍 Gibberish detected`);
			}
			if (signals.patternType && signals.patternType !== 'simple') {
				console.log(`  🔍 Pattern: ${signals.patternType}`);
			}
		} else {
			results.errors++;
			console.log(`  ❌ ERROR: ${result.error}`);
		}

		console.log();
	}

	console.log('='.repeat(80));
	console.log('📊 Summary:');
	console.log(`  Total:  ${results.total}`);
	console.log(
		`  ✅ Allow: ${results.allow} (${((results.allow / results.total) * 100).toFixed(1)}%)`
	);
	console.log(
		`  ⚠️  Warn:  ${results.warn} (${((results.warn / results.total) * 100).toFixed(1)}%)`
	);
	console.log(
		`  ❌ Block: ${results.block} (${((results.block / results.total) * 100).toFixed(1)}%)`
	);
	if (results.errors > 0) {
		console.log(`  ⚠️  Errors: ${results.errors}`);
	}
	console.log('='.repeat(80));
}

// Run tests
console.log();
console.log('📧 Bogus Email Pattern Recognition - API Test Script');
console.log('Testing endpoint:', BASE_URL);
console.log();
console.log('💡 Make sure the dev server is running: npm run dev');
console.log();

runTests().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
