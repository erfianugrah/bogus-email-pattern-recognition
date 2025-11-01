/**
 * Test Fraudulent Emails Against API
 *
 * Loads fraudulent emails from JSON file and tests them against the validation API
 * Provides detailed statistics on detection rates
 *
 * Usage:
 *   1. Generate emails: node generate-fraudulent-emails.js [count]
 *   2. Start dev server: npm run dev
 *   3. Run this script: node test-fraudulent-emails.js
 */

const fs = require('fs');

const BASE_URL = 'http://localhost:8787';
const INPUT_FILE = '../data/fraudulent-emails.json';

async function validateEmail(payload) {
	try {
		const response = await fetch(`${BASE_URL}/validate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const result = await response.json();
		return { success: true, result };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

async function testFraudulentEmails() {
	// Load emails
	if (!fs.existsSync(INPUT_FILE)) {
		console.error(`❌ Error: ${INPUT_FILE} not found`);
		console.log(`💡 Generate emails first: node generate-fraudulent-emails.js`);
		process.exit(1);
	}

	const emails = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

	console.log('🧪 Testing Fraudulent Email Detection');
	console.log('='.repeat(80));
	console.log(`📧 Total emails: ${emails.length}`);
	console.log(`🌐 Endpoint: ${BASE_URL}/validate`);
	console.log('='.repeat(80));
	console.log();

	const results = {
		total: emails.length,
		tested: 0,
		allow: 0,
		warn: 0,
		block: 0,
		errors: 0,
		byPattern: {},
		detectionsBySignal: {
			sequential: 0,
			dated: 0,
			plusAddressing: 0,
			keyboardWalk: 0,
			gibberish: 0,
			highEntropy: 0,
		},
	};

	const failedDetections = [];
	const successfulDetections = [];

	// Test each email
	for (let i = 0; i < emails.length; i++) {
		const emailData = emails[i];
		const payload = {
			email: emailData.email,
			consumer: 'OWF',
			flow: 'SIGNUP_EMAIL_VERIFY',
		};

		// Show progress every 10%
		if ((i + 1) % Math.ceil(emails.length / 10) === 0) {
			console.log(`⏳ Progress: ${i + 1}/${emails.length} (${(((i + 1) / emails.length) * 100).toFixed(0)}%)`);
		}

		const result = await validateEmail(payload);

		results.tested++;

		if (!result.success) {
			results.errors++;
			console.log(`❌ Error testing ${emailData.email}: ${result.error}`);
			continue;
		}

		const decision = result.result.decision;
		const signals = result.result.signals;

		results[decision]++;

		// Track by pattern
		if (!results.byPattern[emailData.pattern]) {
			results.byPattern[emailData.pattern] = {
				total: 0,
				allow: 0,
				warn: 0,
				block: 0,
			};
		}
		results.byPattern[emailData.pattern].total++;
		results.byPattern[emailData.pattern][decision]++;

		// Track detection signals
		if (signals.patternType === 'sequential') results.detectionsBySignal.sequential++;
		if (signals.patternType === 'dated') results.detectionsBySignal.dated++;
		if (signals.hasPlusAddressing) results.detectionsBySignal.plusAddressing++;
		if (signals.hasKeyboardWalk) results.detectionsBySignal.keyboardWalk++;
		if (signals.isGibberish) results.detectionsBySignal.gibberish++;
		if (signals.entropyScore > 0.5) results.detectionsBySignal.highEntropy++;

		// Track success/failure
		if (decision === 'block' || decision === 'warn') {
			successfulDetections.push({
				email: emailData.email,
				pattern: emailData.pattern,
				decision,
				riskScore: result.result.riskScore,
				signals,
			});
		} else {
			failedDetections.push({
				email: emailData.email,
				pattern: emailData.pattern,
				decision,
				riskScore: result.result.riskScore,
				signals,
			});
		}

		// Small delay to avoid overwhelming the server
		await new Promise(resolve => setTimeout(resolve, 10));
	}

	console.log();
	console.log('='.repeat(80));
	console.log('📊 OVERALL RESULTS');
	console.log('='.repeat(80));
	console.log();

	console.log('Decision Distribution:');
	console.log(`  ✅ Allow: ${results.allow} (${((results.allow / results.tested) * 100).toFixed(1)}%)`);
	console.log(`  ⚠️  Warn:  ${results.warn} (${((results.warn / results.tested) * 100).toFixed(1)}%)`);
	console.log(`  ❌ Block: ${results.block} (${((results.block / results.tested) * 100).toFixed(1)}%)`);

	if (results.errors > 0) {
		console.log(`  ⚠️  Errors: ${results.errors}`);
	}

	const detectionRate = ((results.warn + results.block) / results.tested) * 100;
	console.log();
	console.log(`🎯 Detection Rate: ${detectionRate.toFixed(1)}% (Warn + Block)`);
	console.log(`🎯 Block Rate: ${((results.block / results.tested) * 100).toFixed(1)}%`);

	console.log();
	console.log('='.repeat(80));
	console.log('📋 DETECTION BY PATTERN');
	console.log('='.repeat(80));
	console.log();

	// Sort patterns by detection rate
	const patternStats = Object.entries(results.byPattern)
		.map(([pattern, stats]) => ({
			pattern,
			...stats,
			detectionRate: ((stats.warn + stats.block) / stats.total) * 100,
		}))
		.sort((a, b) => b.detectionRate - a.detectionRate);

	console.log('Pattern                    Total   Allow   Warn   Block   Detection');
	console.log('-'.repeat(80));

	patternStats.forEach(stat => {
		const detected = stat.detectionRate >= 70 ? '✅' : stat.detectionRate >= 40 ? '⚠️' : '❌';
		console.log(
			`${stat.pattern.padEnd(25)} ${stat.total.toString().padStart(5)}  ` +
			`${stat.allow.toString().padStart(5)}  ${stat.warn.toString().padStart(5)}  ` +
			`${stat.block.toString().padStart(5)}   ${stat.detectionRate.toFixed(1).padStart(5)}% ${detected}`
		);
	});

	console.log();
	console.log('='.repeat(80));
	console.log('🔍 DETECTION SIGNALS TRIGGERED');
	console.log('='.repeat(80));
	console.log();

	console.log('Signal                     Count       Rate');
	console.log('-'.repeat(80));

	Object.entries(results.detectionsBySignal).forEach(([signal, count]) => {
		const rate = (count / results.tested) * 100;
		console.log(
			`${signal.padEnd(25)} ${count.toString().padStart(5)}     ${rate.toFixed(1)}%`
		);
	});

	// Show failed detections (false negatives)
	if (failedDetections.length > 0) {
		console.log();
		console.log('='.repeat(80));
		console.log(`⚠️  MISSED DETECTIONS (${failedDetections.length})`);
		console.log('='.repeat(80));
		console.log();

		const sampleSize = Math.min(failedDetections.length, 20);
		console.log(`Showing ${sampleSize} of ${failedDetections.length} missed detections:`);
		console.log();

		failedDetections.slice(0, sampleSize).forEach((item, i) => {
			console.log(`${(i + 1).toString().padStart(2)}. ${item.email.padEnd(40)} [${item.pattern}]`);
			console.log(`    Risk: ${item.riskScore.toFixed(2)}, Entropy: ${item.signals.entropyScore.toFixed(2)}`);
		});
	}

	// Show successful detections (sample)
	if (successfulDetections.length > 0) {
		console.log();
		console.log('='.repeat(80));
		console.log(`✅ SUCCESSFUL DETECTIONS (${successfulDetections.length})`);
		console.log('='.repeat(80));
		console.log();

		const sampleSize = Math.min(successfulDetections.length, 10);
		console.log(`Showing ${sampleSize} of ${successfulDetections.length} successful detections:`);
		console.log();

		successfulDetections.slice(0, sampleSize).forEach((item, i) => {
			console.log(`${(i + 1).toString().padStart(2)}. ${item.email.padEnd(40)} [${item.pattern}]`);
			console.log(`    ${item.decision.toUpperCase()}: Risk ${item.riskScore.toFixed(2)}`);

			const detectedSignals = [];
			if (item.signals.isGibberish) detectedSignals.push('gibberish');
			if (item.signals.hasKeyboardWalk) detectedSignals.push('keyboard_walk');
			if (item.signals.hasPlusAddressing) detectedSignals.push('plus_addressing');
			if (item.signals.patternType !== 'simple') detectedSignals.push(item.signals.patternType);

			if (detectedSignals.length > 0) {
				console.log(`    Detected: ${detectedSignals.join(', ')}`);
			}
		});
	}

	console.log();
	console.log('='.repeat(80));
	console.log('💡 RECOMMENDATIONS');
	console.log('='.repeat(80));
	console.log();

	if (detectionRate < 70) {
		console.log('⚠️  Detection rate is below 70%. Consider:');
		console.log('   - Lowering RISK_THRESHOLD_WARN to catch more patterns');
		console.log('   - Reviewing failed detections for pattern improvements');
	} else if (detectionRate >= 85) {
		console.log('✅ Excellent detection rate! System is working well.');
	} else {
		console.log('✅ Good detection rate. System is performing acceptably.');
	}

	// Pattern-specific recommendations
	patternStats.forEach(stat => {
		if (stat.detectionRate < 50) {
			console.log(`⚠️  ${stat.pattern} detection is low (${stat.detectionRate.toFixed(1)}%) - needs improvement`);
		}
	});

	console.log();
	console.log('✨ Testing complete!');
	console.log();
}

// Run tests
testFraudulentEmails().catch(error => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
