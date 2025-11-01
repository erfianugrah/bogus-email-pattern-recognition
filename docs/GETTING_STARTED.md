# Getting Started Guide

**Bogus Email Pattern Recognition** - Complete setup and implementation guide

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running Locally](#running-locally)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Usage Examples](#usage-examples)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

Get the system running in under 5 minutes:

```bash
# 1. Clone and install
git clone https://github.com/your-org/bogus-email-pattern-recognition.git
cd bogus-email-pattern-recognition
npm install

# 2. Run tests
npm test

# 3. Start development server
npm run dev

# 4. Test the API
curl -X POST http://localhost:8787/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## Prerequisites

### Required

- **Node.js** v18+ (v20+ recommended)
- **npm** v9+ (comes with Node.js)
- **Cloudflare Account** (free tier works)

### Optional

- **wrangler CLI** (for deployment)
- **Git** (for version control)

### System Requirements

- **OS**: Linux, macOS, or Windows (with WSL2)
- **RAM**: 2GB minimum
- **Disk**: 500MB available space

---

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/bogus-email-pattern-recognition.git
cd bogus-email-pattern-recognition
```

### Step 2: Install Dependencies

```bash
npm install
```

**Expected output:**
```
added 142 packages, and audited 143 packages in 12s
```

**Key dependencies installed:**
- `hono` - Web framework
- `@cloudflare/workers-types` - TypeScript definitions
- `pino` - Structured logging
- `vitest` - Testing framework

### Step 3: Verify Installation

```bash
# Check Node version
node --version  # Should show v18+ or v20+

# Check npm version
npm --version   # Should show v9+

# Verify TypeScript compilation
npx tsc --noEmit
```

---

## Configuration

### Environment Variables

Configuration is in `wrangler.jsonc`:

```jsonc
{
  "name": "bogus-email-pattern-recognition",
  "main": "src/index.ts",
  "compatibility_date": "2025-10-11",

  "vars": {
    // Risk thresholds
    "RISK_THRESHOLD_BLOCK": "0.6",    // Block if risk > 0.6
    "RISK_THRESHOLD_WARN": "0.3",     // Warn if risk > 0.3

    // Feature flags
    "ENABLE_DISPOSABLE_CHECK": "true",  // Check disposable domains
    "ENABLE_PATTERN_CHECK": "true",     // Run pattern detection
    "ENABLE_MX_CHECK": "false",         // MX validation (not implemented)

    // Logging
    "LOG_ALL_VALIDATIONS": "true",      // Log every validation
    "LOG_LEVEL": "info"                 // debug|info|warn|error
  },

  "analytics_engine_datasets": [
    {
      "binding": "ANALYTICS",
      "dataset": "email_validations"
    }
  ]
}
```

### Configuration Options Explained

#### Risk Thresholds

- **RISK_THRESHOLD_BLOCK** (default: 0.6)
  - Emails with risk > 0.6 are blocked
  - Recommended: 0.5-0.7 range
  - Lower = more strict, Higher = more lenient

- **RISK_THRESHOLD_WARN** (default: 0.3)
  - Emails with risk 0.3-0.6 get warning
  - Recommended: 0.2-0.4 range
  - Creates middle ground for review

#### Feature Flags

- **ENABLE_DISPOSABLE_CHECK** (default: true)
  - Checks against 170+ disposable domains
  - Highly recommended to keep enabled
  - Catches throwaway email services

- **ENABLE_PATTERN_CHECK** (default: true)
  - Enables all pattern detection:
    - Sequential patterns (user1, user2, ...)
    - Dated patterns (john.2024, user_2025)
    - Plus-addressing (user+1@gmail.com)
    - Keyboard walks (qwerty, asdfgh)
    - N-Gram gibberish detection (Phase 6A)
  - Must be enabled for Phase 6A features

- **LOG_ALL_VALIDATIONS** (default: true)
  - Logs every validation request
  - Useful for debugging and analytics
  - Disable in high-traffic production for performance

#### Logging Levels

- **debug**: Verbose output, all details
- **info**: Standard operational messages
- **warn**: Warnings and potential issues
- **error**: Only errors and critical issues

---

## Running Locally

### Development Server

Start the development server with hot reload:

```bash
npm run dev
```

**Output:**
```
⛅️ wrangler 3.x.x
------------------
Your worker has 1 route:
  - http://localhost:8787

[wrangler:inf] Ready on http://localhost:8787
```

The server runs on `http://localhost:8787` by default.

### Available Endpoints

#### 1. Root Endpoint (GET /)

**Test:**
```bash
curl http://localhost:8787/
```

**Response:**
```
Bogus Email Pattern Recognition API

Endpoints:
- POST /validate { "email": "test@example.com" }
- GET /debug (shows all request signals)

Example:
curl -X POST https://your-worker.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

#### 2. Validation Endpoint (POST /validate)

**Test:**
```bash
curl -X POST http://localhost:8787/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"person1.person2@example.com"}'
```

**Response:**
```json
{
  "valid": true,
  "riskScore": 0.36,
  "decision": "warn",
  "message": "Email validation completed",
  "signals": {
    "formatValid": true,
    "entropyScore": 0.42,
    "localPartLength": 8,
    "isDisposableDomain": false,
    "isFreeProvider": false,
    "domainReputationScore": 0,
    "patternFamily": "RANDOM@example.com",
    "patternType": "random",
    "patternConfidence": 0.6,
    "patternRiskScore": 0.5,
    "normalizedEmail": "person1.person2@example.com",
    "hasPlusAddressing": false,
    "hasKeyboardWalk": false,
    "keyboardWalkType": "none",
    "isGibberish": true,
    "gibberishConfidence": 1,
    "tldRiskScore": 0.29
  },
  "fingerprint": {
    "hash": "3d1852...",
    "country": "US",
    "asn": 13335,
    "botScore": 0
  },
  "latency_ms": 1
}
```

#### 3. Debug Endpoint (GET /debug)

Shows all available fingerprinting signals:

```bash
curl http://localhost:8787/debug
```

**Response:**
```json
{
  "fingerprint": {
    "hash": "...",
    "ip": "127.0.0.1",
    "userAgent": "curl/7.x",
    "country": "XX",
    "asn": 0,
    "botScore": 0
  },
  "allSignals": {
    "cf-connecting-ip": "127.0.0.1",
    "user-agent": "curl/7.x",
    "cf-ipcountry": "XX",
    "cf-bot-score": "0"
  }
}
```

---

## Testing

### Run All Tests

```bash
npm test
```

**Expected output:**
```
Test Files  6 passed (6)
Tests  169 passed (169)
Duration  2.00s
```

### Test Breakdown

**169 total tests across 6 files:**

1. **Email Validator Tests** (`email.test.ts`) - 20 tests
   - Format validation (RFC 5322)
   - Entropy calculation
   - Edge cases

2. **Pattern Detector Tests** (`pattern-detectors.test.ts`) - 37 tests
   - Sequential patterns
   - Dated patterns
   - Plus-addressing
   - Keyboard walks

3. **N-Gram Analysis Tests** (`ngram-analysis.test.ts`) - 29 tests
   - Natural name detection
   - Gibberish identification
   - Name patterns
   - Edge cases

4. **TLD Risk Tests** (`tld-risk.test.ts`) - 37 tests
   - TLD categorization
   - Risk scoring
   - Domain validation
   - Real-world scenarios

5. **Benford's Law Tests** (`benfords-law.test.ts`) - 34 tests
   - Statistical analysis
   - Batch detection
   - Distribution comparison
   - Attack wave simulation

6. **Integration Tests** (`validate-endpoint.test.ts`) - 12 tests
   - API endpoint behavior
   - End-to-end validation
   - CORS handling
   - Error cases

### Run Specific Test Suite

```bash
# Run only N-Gram tests
npm test -- ngram-analysis

# Run only integration tests
npm test -- validate-endpoint

# Run with verbose output
npm test -- --reporter=verbose
```

### Test in Watch Mode

```bash
npm run test:watch
```

Auto-reruns tests when files change.

---

## Deployment

### Prerequisites for Deployment

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com/
2. **wrangler CLI**: Install if not already done:
   ```bash
   npm install -g wrangler
   ```
3. **Authentication**: Login to Cloudflare:
   ```bash
   wrangler login
   ```

### Step 1: Configure Worker Name

Edit `wrangler.jsonc`:

```jsonc
{
  "name": "your-worker-name",  // Change this
  // ... rest of config
}
```

### Step 2: Deploy to Cloudflare

```bash
npm run deploy
```

**Output:**
```
Total Upload: 45.23 KiB / gzip: 12.34 KiB
Uploaded your-worker-name (2.3 sec)
Published your-worker-name (0.5 sec)
  https://your-worker-name.workers.dev
Current Deployment ID: abc123...
```

### Step 3: Test Deployed Worker

```bash
curl -X POST https://your-worker-name.workers.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Step 4: Monitor Analytics

Visit Cloudflare Dashboard:
1. Go to **Workers & Pages**
2. Select your worker
3. Click **Analytics** tab
4. Query Analytics Engine:

```sql
SELECT
  blob1 as decision,
  COUNT(*) as count
FROM email_validations
WHERE timestamp >= NOW() - INTERVAL '1' HOUR
GROUP BY decision
```

---

## Usage Examples

### Example 1: Validate Single Email

```javascript
const response = await fetch('https://your-worker.workers.dev/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

const result = await response.json();

if (result.decision === 'block') {
  console.log('Email blocked:', result.signals);
} else if (result.decision === 'warn') {
  console.log('Email flagged for review');
} else {
  console.log('Email looks good');
}
```

### Example 2: Batch Validation

```javascript
const emails = [
  'user1@example.com',
  'user2@example.com',
  'spam@throwaway.email'
];

const results = await Promise.all(
  emails.map(email =>
    fetch('https://your-worker.workers.dev/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    }).then(r => r.json())
  )
);

console.log('Blocked:', results.filter(r => r.decision === 'block').length);
console.log('Warned:', results.filter(r => r.decision === 'warn').length);
console.log('Allowed:', results.filter(r => r.decision === 'allow').length);
```

### Example 3: Integration with Signup Form

```javascript
async function validateEmailOnSignup(email) {
  try {
    const response = await fetch('https://your-worker.workers.dev/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();

    switch (result.decision) {
      case 'block':
        return {
          valid: false,
          message: 'This email address cannot be used. Please use a different email.'
        };

      case 'warn':
        return {
          valid: true,
          warning: 'This email will be reviewed by our team.',
          riskScore: result.riskScore
        };

      case 'allow':
        return {
          valid: true,
          message: 'Email validated successfully'
        };
    }
  } catch (error) {
    // Fail open - don't block signups if service is down
    console.error('Validation service error:', error);
    return { valid: true, warning: 'Email validation unavailable' };
  }
}
```

### Example 4: Custom Threshold

If you want different thresholds for specific use cases:

```javascript
async function validateWithCustomThreshold(email, blockThreshold = 0.7) {
  const response = await fetch('https://your-worker.workers.dev/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const result = await response.json();

  // Apply custom threshold
  const customDecision = result.riskScore > blockThreshold ? 'block' :
                         result.riskScore > 0.3 ? 'warn' : 'allow';

  return {
    ...result,
    customDecision,
    originalDecision: result.decision
  };
}
```

---

## Troubleshooting

### Issue 1: Tests Failing

**Symptom**: `npm test` shows failures

**Solutions**:

1. **Check Node version**:
   ```bash
   node --version  # Should be v18+
   ```

2. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Run specific failing test**:
   ```bash
   npm test -- <test-file-name>
   ```

### Issue 2: Dev Server Won't Start

**Symptom**: `npm run dev` fails

**Solutions**:

1. **Port already in use**:
   ```bash
   # Kill process on port 8787
   lsof -ti:8787 | xargs kill -9

   # Or use different port
   wrangler dev --port 8788
   ```

2. **Wrangler version**:
   ```bash
   npx wrangler --version  # Should be 3.x+
   npm install -D wrangler@latest
   ```

### Issue 3: Deployment Fails

**Symptom**: `npm run deploy` errors

**Solutions**:

1. **Not logged in**:
   ```bash
   wrangler login
   ```

2. **Worker name conflict**:
   - Change name in `wrangler.jsonc`
   - Must be globally unique

3. **Binding issues**:
   - Verify Analytics Engine dataset exists
   - Check Cloudflare dashboard for bindings

### Issue 4: High Latency

**Symptom**: Validation takes > 100ms

**Solutions**:

1. **Disable excessive logging**:
   ```jsonc
   "LOG_ALL_VALIDATIONS": "false"
   ```

2. **Check pattern detection**:
   ```jsonc
   "ENABLE_PATTERN_CHECK": "true"  // This is fast, keep enabled
   ```

3. **Monitor Analytics**:
   - Check p95 latency in dashboard
   - Most requests should be < 5ms

### Issue 5: False Positives

**Symptom**: Legitimate emails blocked

**Solutions**:

1. **Adjust thresholds**:
   ```jsonc
   "RISK_THRESHOLD_BLOCK": "0.7"  // Increase from 0.6
   ```

2. **Check signals**:
   - Look at `result.signals` to see why flagged
   - Common causes:
     - High entropy (random-looking names)
     - Suspicious TLD (.xyz, .top, etc.)
     - Pattern detection (sequential numbers)

3. **Review logs**:
   ```bash
   wrangler tail
   ```

### Issue 6: TypeScript Errors

**Symptom**: IDE shows TypeScript errors

**Solutions**:

1. **Regenerate types**:
   ```bash
   npm run cf-typegen
   ```

2. **Check TypeScript version**:
   ```bash
   npx tsc --version  # Should be 5.x+
   ```

3. **Restart TypeScript server**:
   - VS Code: Cmd+Shift+P → "Restart TS Server"

---

## Next Steps

After setup, explore these resources:

1. **[Architecture Guide](./ARCHITECTURE.md)** - System design deep dive
2. **[API Documentation](./API.md)** - Complete API reference
3. **[Phase 6A Summary](./PHASE_6A_SUMMARY.md)** - New detection algorithms
4. **[Implementation Plan](../IMPLEMENTATION_PLAN.md)** - Roadmap and phases

### Quick Wins

1. **Test with real data**:
   - Use actual signup emails from your system
   - Analyze risk scores and decisions
   - Tune thresholds based on results

2. **Monitor Analytics**:
   - Set up daily queries for blocked/warned emails
   - Track false positive/negative rates
   - Identify patterns in attacks

3. **Integrate with your app**:
   - Add validation to signup flow
   - Implement custom thresholds per use case
   - Set up alerts for high-risk activity

### Advanced Topics

- **Phase 6B**: Markov Chain & Edit Distance (planned)
- **Phase 6C**: Temporal analysis with Durable Objects (planned)
- **Rate Limiting**: Multi-dimensional limits (planned)
- **Admin API**: Whitelist/blacklist management (planned)

---

## Support

**Issues**: https://github.com/your-org/bogus-email-pattern-recognition/issues
**Documentation**: Full docs in `/docs` directory
**Tests**: 169 tests covering all functionality

**Quick Reference**:
- Test: `npm test`
- Dev: `npm run dev`
- Deploy: `npm run deploy`
- Types: `npm run cf-typegen`
