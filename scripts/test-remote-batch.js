#!/usr/bin/env node
/**
 * Test Remote Worker with Large Batch
 *
 * Generates fraudulent emails and tests them against the remote worker
 */

const REMOTE_URL = 'https://your-worker.workers.dev';
const BATCH_SIZE = 100; // Process in batches to avoid overwhelming the worker
const DELAY_MS = 100; // Delay between batches

// Email generation patterns
const patterns = {
	sequential: (i) => `user${i}@example.com`,
	sequential_padded: (i) => `test${String(i).padStart(3, '0')}@company.com`,
	dated: (i) => `john.doe.2025@example.com`,
	gibberish: (i) => randomString(12) + '@example.com',
	keyboard_walk: (i) => ['qwerty', 'asdfgh', '123456', 'zxcvbn', 'qazwsx'][i % 5] + i + '@test.com',
	plus_addressing: (i) => `user+${i}@gmail.com`,
	name_sequential: (i) => `john.smith${i}@business.com`,
};

const domains = [
	'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
	'example.com', 'test.com', 'company.com', 'business.com',
	'tech.com', 'services.com', 'consulting.com',
];

function randomString(length) {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateEmail(index, patternName) {
	const pattern = patterns[patternName];
	if (!pattern) return `user${index}@example.com`;

	const email = pattern(index);
	// Randomize domain for some patterns
	if (Math.random() < 0.3) {
		const [local] = email.split('@');
		const domain = domains[Math.floor(Math.random() * domains.length)];
		return `${local}@${domain}`;
	}
	return email;
}

function generateEmails(count) {
	const emails = [];
	const patternNames = Object.keys(patterns);

	for (let i = 0; i < count; i++) {
		const patternName = patternNames[i % patternNames.length];
		emails.push({
			email: generateEmail(i, patternName),
			pattern: patternName,
			index: i,
		});
	}

	return emails;
}

async function testEmail(email) {
	const response = await fetch(`${REMOTE_URL}/validate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ email }),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${await response.text()}`);
	}

	return response.json();
}

async function testBatch(emails, batchNum, totalBatches) {
	const results = [];

	for (let i = 0; i < emails.length; i++) {
		const { email, pattern, index } = emails[i];

		try {
			const result = await testEmail(email);
			results.push({
				email,
				pattern,
				index,
				riskScore: result.riskScore,
				decision: result.decision,
				patternDetected: result.signals?.patternType || 'none',
				success: true,
			});

			// Progress indicator
			if ((i + 1) % 10 === 0) {
				process.stdout.write(`\rBatch ${batchNum}/${totalBatches}: ${i + 1}/${emails.length} emails tested`);
			}
		} catch (error) {
			results.push({
				email,
				pattern,
				index,
				error: error.message,
				success: false,
			});
		}
	}

	process.stdout.write(`\rBatch ${batchNum}/${totalBatches}: ${emails.length}/${emails.length} emails tested ✓\n`);

	return results;
}

function analyzeResults(allResults) {
	const stats = {
		total: allResults.length,
		successful: 0,
		failed: 0,
		blocked: 0,
		warned: 0,
		allowed: 0,
		byPattern: {},
		byDecision: {},
		avgRiskScore: 0,
		riskScoreDistribution: {
			'0.0-0.2': 0,
			'0.2-0.4': 0,
			'0.4-0.6': 0,
			'0.6-0.8': 0,
			'0.8-1.0': 0,
		},
	};

	let totalRiskScore = 0;

	for (const result of allResults) {
		if (result.success) {
			stats.successful++;
			stats[result.decision]++;

			if (!stats.byPattern[result.pattern]) {
				stats.byPattern[result.pattern] = { total: 0, blocked: 0, warned: 0, allowed: 0 };
			}
			stats.byPattern[result.pattern].total++;
			stats.byPattern[result.pattern][result.decision]++;

			if (!stats.byDecision[result.decision]) {
				stats.byDecision[result.decision] = [];
			}
			stats.byDecision[result.decision].push(result);

			totalRiskScore += result.riskScore;

			// Risk score distribution
			const bucket = Math.floor(result.riskScore * 5) / 5;
			const bucketKey = `${bucket.toFixed(1)}-${(bucket + 0.2).toFixed(1)}`;
			if (stats.riskScoreDistribution[bucketKey] !== undefined) {
				stats.riskScoreDistribution[bucketKey]++;
			}
		} else {
			stats.failed++;
		}
	}

	stats.avgRiskScore = totalRiskScore / stats.successful;

	return stats;
}

function printResults(stats) {
	console.log('\n' + '='.repeat(80));
	console.log('📊 TEST RESULTS SUMMARY');
	console.log('='.repeat(80));

	console.log('\n📈 Overall Statistics:');
	console.log(`  Total Emails:     ${stats.total}`);
	console.log(`  Successful Tests: ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(1)}%)`);
	console.log(`  Failed Tests:     ${stats.failed}`);
	console.log(`  Avg Risk Score:   ${stats.avgRiskScore.toFixed(3)}`);

	console.log('\n🎯 Decision Breakdown:');
	console.log(`  ❌ Blocked:  ${stats.blocked} (${((stats.blocked / stats.successful) * 100).toFixed(1)}%)`);
	console.log(`  ⚠️  Warned:   ${stats.warned} (${((stats.warned / stats.successful) * 100).toFixed(1)}%)`);
	console.log(`  ✅ Allowed:  ${stats.allowed} (${((stats.allowed / stats.successful) * 100).toFixed(1)}%)`);

	console.log('\n📊 Risk Score Distribution:');
	for (const [bucket, count] of Object.entries(stats.riskScoreDistribution)) {
		const percentage = ((count / stats.successful) * 100).toFixed(1);
		const bar = '█'.repeat(Math.floor(percentage / 2));
		console.log(`  ${bucket}: ${count.toString().padStart(4)} (${percentage}%) ${bar}`);
	}

	console.log('\n🔍 Detection by Pattern:');
	const sortedPatterns = Object.entries(stats.byPattern)
		.sort((a, b) => b[1].total - a[1].total);

	for (const [pattern, data] of sortedPatterns) {
		const detectionRate = ((data.blocked + data.warned) / data.total) * 100;
		console.log(`  ${pattern.padEnd(20)} ${data.total.toString().padStart(4)} emails | Detection: ${detectionRate.toFixed(1)}% | Block: ${data.blocked} | Warn: ${data.warned} | Allow: ${data.allowed}`);
	}

	console.log('\n' + '='.repeat(80));
}

async function main() {
	const count = parseInt(process.argv[2]) || 5000;

	console.log(`🚀 Testing Remote Worker: ${REMOTE_URL}`);
	console.log(`📧 Generating ${count} fraudulent emails...\n`);

	const emails = generateEmails(count);
	console.log(`✓ Generated ${emails.length} emails\n`);

	const batches = [];
	for (let i = 0; i < emails.length; i += BATCH_SIZE) {
		batches.push(emails.slice(i, i + BATCH_SIZE));
	}

	console.log(`📦 Processing ${batches.length} batches (${BATCH_SIZE} emails per batch)\n`);

	const startTime = Date.now();
	const allResults = [];

	for (let i = 0; i < batches.length; i++) {
		const batchResults = await testBatch(batches[i], i + 1, batches.length);
		allResults.push(...batchResults);

		// Delay between batches to avoid rate limiting
		if (i < batches.length - 1) {
			await new Promise(resolve => setTimeout(resolve, DELAY_MS));
		}
	}

	const endTime = Date.now();
	const duration = (endTime - startTime) / 1000;

	console.log(`\n✓ Testing completed in ${duration.toFixed(2)} seconds`);
	console.log(`  Average: ${(duration / allResults.length * 1000).toFixed(1)}ms per email`);
	console.log(`  Throughput: ${(allResults.length / duration).toFixed(1)} emails/second`);

	const stats = analyzeResults(allResults);
	printResults(stats);

	// Save results
	const fs = require('fs');
	const outputFile = 'data/remote-test-results.json';
	fs.mkdirSync('data', { recursive: true });
	fs.writeFileSync(outputFile, JSON.stringify({
		metadata: {
			url: REMOTE_URL,
			timestamp: new Date().toISOString(),
			count: allResults.length,
			duration: duration,
		},
		stats,
		results: allResults,
	}, null, 2));

	console.log(`\n💾 Results saved to: ${outputFile}`);
}

main().catch(console.error);
