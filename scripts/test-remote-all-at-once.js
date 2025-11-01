/**
 * Test Remote Worker with ALL emails at once (no batching)
 * Generates 5000 fraudulent emails and sends them all in parallel
 */

const WORKER_URL = 'https://bogus-email-pattern-recognition.anugrah.workers.dev';

// Generate fraudulent email patterns
function generateFraudulentEmails(count) {
	const emails = [];
	const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];

	for (let i = 0; i < count; i++) {
		const type = i % 5;
		const domain = domains[i % domains.length];

		switch (type) {
			case 0: // Sequential
				emails.push(`user${i}@${domain}`);
				break;
			case 1: // Gibberish
				emails.push(`${randomString(10)}@${domain}`);
				break;
			case 2: // Keyboard walk
				emails.push(`qwerty${i}@${domain}`);
				break;
			case 3: // Plus addressing
				emails.push(`testuser+${i}@${domain}`);
				break;
			case 4: // Dated
				emails.push(`john.doe.${2025 + (i % 5)}@${domain}`);
				break;
		}
	}

	return emails;
}

function randomString(length) {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

async function validateEmail(email) {
	const response = await fetch(`${WORKER_URL}/validate`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email }),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${await response.text()}`);
	}

	return response.json();
}

async function main() {
	console.log('🚀 Testing Remote Worker (ALL AT ONCE):', WORKER_URL);
	console.log('📧 Generating 5000 fraudulent emails...\n');

	const emails = generateFraudulentEmails(5000);
	console.log('✓ Generated 5000 emails\n');

	console.log('🔥 Sending ALL 5000 requests in parallel...\n');

	const startTime = Date.now();

	// Send ALL requests at once
	const promises = emails.map((email, index) =>
		validateEmail(email)
			.then(result => {
				if ((index + 1) % 100 === 0) {
					process.stdout.write(`\r✓ Completed ${index + 1}/5000 requests...`);
				}
				return { success: true, result };
			})
			.catch(error => {
				return { success: false, error: error.message };
			})
	);

	const results = await Promise.all(promises);

	const endTime = Date.now();
	const totalTime = (endTime - startTime) / 1000;

	console.log('\n\n📊 Final Results:');
	console.log('═══════════════════════════════════════════════════════════\n');

	const successful = results.filter(r => r.success).length;
	const failed = results.filter(r => !r.success).length;

	console.log(`✓ Successful: ${successful}/${emails.length} (${((successful / emails.length) * 100).toFixed(1)}%)`);
	console.log(`✗ Failed: ${failed}/${emails.length} (${((failed / emails.length) * 100).toFixed(1)}%)`);
	console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}s`);
	console.log(`⚡ Throughput: ${(emails.length / totalTime).toFixed(1)} emails/sec`);
	console.log(`📈 Avg Latency: ${(totalTime * 1000 / emails.length).toFixed(1)}ms per email`);

	// Detection stats
	const successfulResults = results.filter(r => r.success).map(r => r.result);
	const decisions = {
		allow: successfulResults.filter(r => r.decision === 'allow').length,
		warn: successfulResults.filter(r => r.decision === 'warn').length,
		block: successfulResults.filter(r => r.decision === 'block').length,
	};

	console.log('\n📋 Decision Breakdown:');
	console.log(`   Allow: ${decisions.allow} (${((decisions.allow / successful) * 100).toFixed(1)}%)`);
	console.log(`   Warn:  ${decisions.warn} (${((decisions.warn / successful) * 100).toFixed(1)}%)`);
	console.log(`   Block: ${decisions.block} (${((decisions.block / successful) * 100).toFixed(1)}%)`);

	const detectionRate = ((decisions.warn + decisions.block) / successful) * 100;
	console.log(`\n🎯 Detection Rate: ${detectionRate.toFixed(1)}% (warn + block)`);

	console.log('\n✅ Test Complete!');
	console.log('📊 Check Analytics Dashboard: ' + WORKER_URL + '/analytics.html');
}

main().catch(console.error);
