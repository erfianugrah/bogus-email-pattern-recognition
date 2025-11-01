# 📜 Scripts Directory

**Manual testing and utility scripts**

---

## Overview

This directory contains standalone scripts for manual testing and validation. These scripts complement the automated test suite and are useful for:
- Manual API testing during development
- Ad-hoc validation scenarios
- Integration testing with external systems
- Performance testing

**Note**: The main test suite is in `/tests` directory and should be used for automated testing (`npm test`).

---

## Available Scripts

### 1. **test-api.js** - Manual API Testing

**Purpose**: Quick manual testing of the validation API with predefined scenarios

**Usage**:
```bash
# Start dev server first
npm run dev

# In another terminal
node scripts/test-api.js
```

**Features**:
- 31 pre-configured test cases
- Real-time decision display
- Signal detection feedback
- Visual output with emojis

**When to use**:
- Quick smoke testing
- Debugging specific scenarios
- Manual validation before deployment

---

### 2. **test-fraudulent-emails.js** - Comprehensive Fraud Testing

**Purpose**: Test all generated fraudulent emails and provide detailed statistics

**Usage**:
```bash
# Generate test data first
node generate-fraudulent-emails.js 200

# Start dev server
npm run dev

# Run comprehensive test
node scripts/test-fraudulent-emails.js
```

**Features**:
- Tests all generated fraudulent emails
- Pattern-specific detection rates
- Signal analysis
- Missed detection reports
- Tuning recommendations

**Output**:
```
📊 OVERALL RESULTS
  ✅ Allow: 28 (14.0%)
  ⚠️  Warn:  89 (44.5%)
  ❌ Block: 83 (41.5%)

🎯 Detection Rate: 86.0% (Warn + Block)

📋 DETECTION BY PATTERN
  gibberish           100.0% ✅
  keyboard_walk        94.7% ✅
  sequential           88.9% ✅
```

**When to use**:
- Evaluating detection performance
- Threshold tuning
- Pre-deployment validation
- Performance benchmarking

---

### 3. **test-detectors.js** - Pattern Detector Testing

**Purpose**: Test individual pattern detectors in isolation

**Usage**:
```bash
node scripts/test-detectors.js
```

**Features**:
- Tests sequential pattern detection
- Tests dated pattern detection
- Tests plus-addressing normalization
- Tests keyboard walk detection
- Direct module testing (no API calls)

**Output**:
```
🧪 Testing Pattern Detectors

📊 Sequential Pattern Detection:
  user123@gmail.com
    Sequential: true, Confidence: 0.80
    Base: user, Sequence: 123
```

**When to use**:
- Debugging specific detectors
- Unit-level validation
- Algorithm development
- Performance profiling

---

## Automated Tests (Preferred)

**For regular testing, use the automated test suite**:

```bash
# Run all tests (recommended)
npm test

# Run specific test suite
npm test -- fraudulent-emails
npm test -- comprehensive-validation
npm test -- pattern-detectors
```

**Automated test suites**:
- `tests/unit/` - Unit tests for individual components
- `tests/integration/` - Integration tests for API endpoints
- `tests/integration/fraudulent-emails.test.ts` - Fraud detection tests

**Advantages of automated tests**:
- ✅ Runs in CI/CD
- ✅ Fast execution (parallel)
- ✅ Consistent results
- ✅ Part of development workflow
- ✅ Reports in standard format

---

## When to Use Scripts vs Automated Tests

### Use Scripts When:
- 🔧 Debugging specific issues
- 👀 Visual inspection needed
- 🎛️ Testing threshold changes manually
- 📊 Generating detailed reports
- 🔍 Exploring edge cases

### Use Automated Tests When:
- ✅ Running CI/CD pipelines
- ✅ Pre-commit validation
- ✅ Regular development workflow
- ✅ Regression testing
- ✅ Code coverage analysis

---

## Migrating Scripts to Tests

If you want to convert a script to an automated test:

1. **Create test file** in `tests/integration/`
2. **Import vitest**: `import { describe, it, expect } from 'vitest'`
3. **Use worker.fetch()** instead of HTTP fetch
4. **Add assertions** with expect()
5. **Run with**: `npm test`

**Example**:
```typescript
// tests/integration/my-new-test.test.ts
import { describe, it, expect } from 'vitest';
import worker from '../../src/index';

describe('My Test Suite', () => {
  it('should validate email', async () => {
    const request = new Request('http://localhost:8787/validate', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' })
    });

    const response = await worker.fetch(request, env, ctx);
    const result = await response.json();

    expect(result.decision).toBe('allow');
  });
});
```

---

## Script Dependencies

All scripts require:
- **Node.js** v18+
- **Dev server running** (for API tests)
- **Dependencies installed**: `npm install`

Some scripts require:
- **Generated data**: `../data/fraudulent-emails.json` (for fraud testing)

---

## Performance Considerations

### API Test Scripts
- **Latency**: Includes network overhead (fetch)
- **Speed**: Slower than automated tests
- **Parallelization**: Sequential execution

### Automated Tests
- **Latency**: Direct function calls (no network)
- **Speed**: Much faster
- **Parallelization**: Runs in parallel

**Benchmark**:
```
Script (test-fraudulent-emails.js):  ~20 seconds for 200 emails
Automated test:                      ~2 seconds for 200 emails
```

---

## Script Maintenance

### Keeping Scripts Updated

When making changes to the API:
1. ✅ Update automated tests first
2. ✅ Run `npm test` to verify
3. ✅ Update scripts if needed
4. ✅ Test scripts manually

### Deprecating Scripts

If a script is no longer needed:
1. Move to `scripts/archive/`
2. Update this README
3. Remove from documentation

---

## Common Issues

### "Connection Refused"
**Problem**: Dev server not running
**Solution**:
```bash
npm run dev
```

### "File not found: fraudulent-emails.json"
**Problem**: Test data not generated
**Solution**:
```bash
node generate-fraudulent-emails.js 200
```

### "Module not found"
**Problem**: Dependencies not installed
**Solution**:
```bash
npm install
```

---

## Summary

**Scripts are useful for**:
- Manual testing
- Detailed reporting
- Visual inspection
- Debugging

**Automated tests are better for**:
- Regular development
- CI/CD integration
- Fast feedback
- Consistent results

**Use both together** for comprehensive testing! ✅

---

## Quick Reference

```bash
# Automated tests (preferred)
npm test                              # All tests
npm test -- fraudulent-emails         # Fraud detection
npm test -- comprehensive-validation  # Comprehensive

# Manual scripts
node scripts/test-api.js             # Quick API test
node scripts/test-fraudulent-emails.js  # Detailed fraud test
node scripts/test-detectors.js       # Pattern detectors

# Generate test data
node generate-fraudulent-emails.js 200  # 200 fraud emails
```

---

**Last Updated**: 2025-01-15
**Total Scripts**: 3
**Automated Tests**: 8 suites, 300+ tests
