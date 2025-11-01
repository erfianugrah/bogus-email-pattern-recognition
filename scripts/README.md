# 📜 Scripts Directory

**Utility scripts for testing and development**

---

## 📌 Overview

This directory contains standalone utility scripts that complement the automated test suite. These scripts are useful for data generation and quick manual testing.

**Note**: Test scripts have been migrated to vitest. See [../docs/history/TEST_MIGRATION_SUMMARY.md](../docs/history/TEST_MIGRATION_SUMMARY.md) for details.

---

## Available Scripts

### 1. **generate-fraudulent-emails.js**

**Purpose**: Generate test data files for fraud detection validation

**Usage**:
```bash
node scripts/generate-fraudulent-emails.js [count]
```

**Example**:
```bash
# Generate 100 fraudulent emails
node scripts/generate-fraudulent-emails.js 100

# Output: data/fraudulent-emails.json
```

**Patterns Generated**:
- Sequential (user1, user2, test001)
- Dated (john.2024, user_2025)
- Keyboard walks (qwerty, asdfgh)
- Gibberish (random strings)
- Plus-addressing (user+1, user+2)
- And more (11 patterns total)

**Why Keep This?**
- Creates persistent JSON files for external analysis
- Useful for dataset creation and manual testing
- Different from `EmailGenerator` class (which generates in-memory)

---

### 2. **test-detectors.js**

**Purpose**: Quick manual testing of pattern detectors

**Usage**:
```bash
node scripts/test-detectors.js
```

**Features**:
- Tests individual pattern detectors in isolation
- No API calls (direct module testing)
- Fast feedback for algorithm development

**Why Keep This?**
- Quick debugging during development
- No need to run full test suite
- Useful for experimenting with detector logic

---

## ✅ Automated Testing

For regular testing, use the automated vitest test suite:

```bash
# Run all tests (342 tests)
npm test

# Run unit tests only (fast - 4s)
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance

# Test against production
WORKER_URL=https://your-worker.workers.dev npm run test:e2e
```

---

## Test Coverage

### Unit Tests (287 tests, ~4s)
- Email validators (20 tests)
- Pattern detectors (37 tests)
- N-Gram analysis (29 tests)
- TLD risk profiling (37 tests)
- Benford's Law (34 tests)
- Integration tests (130 tests)

### E2E Tests (51 tests, ~25s)
- Fraud detection across 11 pattern types
- API endpoint validation
- Disposable domain detection
- Free provider flagging
- Response structure verification

### Performance Tests (15 tests, ~40s)
- Sequential/parallel processing
- Latency metrics (P50/P95/P99)
- Throughput benchmarking
- Stress testing (up to 1000 emails)

---

## Shared Test Utilities

Reusable utilities for all tests:

### `src/test-utils/api-client.ts`
```typescript
const client = new FraudAPIClient({ baseUrl: 'http://localhost:8787' });

// Single validation
const result = await client.validate('test@example.com');

// Batch validation
const results = await client.batchValidate(emails, { delayMs: 10 });

// Parallel validation (load testing)
const results = await client.parallelValidate(emails);
```

### `src/test-utils/email-generator.ts`
```typescript
const generator = new EmailGenerator();

// Generate 100 fraudulent emails across all patterns
const emails = generator.generate({ count: 100 });

// Generate specific pattern
const emails = generator.generate({
  count: 20,
  patterns: ['sequential']
});
```

---

## Quick Reference

### Scripts
```bash
# Generate test data
node scripts/generate-fraudulent-emails.js 100

# Test pattern detectors
node scripts/test-detectors.js
```

### Automated Tests
```bash
# All tests
npm test

# By category
npm run test:unit          # Unit tests (4s)
npm run test:e2e           # E2E tests (25s)
npm run test:performance   # Performance (40s)

# Watch mode
npm run test:watch

# Specific patterns
npm run test:e2e -- --grep "sequential"
```

---

## When to Use What?

### Use Scripts When:
- 🔧 Need persistent JSON files
- 👀 Quick manual testing
- 🧪 Algorithm experimentation
- 📊 Dataset creation

### Use Automated Tests When:
- ✅ Running CI/CD pipelines
- ✅ Pre-commit validation
- ✅ Regular development workflow
- ✅ Regression testing
- ✅ Performance benchmarking

---

## Documentation

- **[TEST_MIGRATION_SUMMARY.md](../docs/history/TEST_MIGRATION_SUMMARY.md)** - Test migration details
- **[REFACTORING_PLAN.md](../docs/history/REFACTORING_PLAN.md)** - Refactoring analysis
- **[docs/TESTING.md](../docs/TESTING.md)** - Testing guide
- **[README.md](../README.md)** - Main documentation

---

## Migration History

**Date**: 2025-11-01

Previous test scripts were migrated to proper vitest tests:
- `test-api.js` → `tests/e2e/api-endpoints.test.ts`
- `test-fraudulent-emails.js` → `tests/e2e/fraud-detection.test.ts`
- `test-remote-batch.js` → `tests/performance/load-test.test.ts`

**Benefits**:
- ✅ TypeScript (full type safety)
- ✅ Shared utilities (DRY)
- ✅ CI/CD ready
- ✅ 5x faster execution
- ✅ Proper assertions

---

**Last Updated**: 2025-11-01
**Active Scripts**: 2
**Automated Tests**: 342 tests (287 unit + 51 E2E + 15 performance)
