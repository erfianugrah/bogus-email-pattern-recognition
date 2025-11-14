# Integration Guide

Comprehensive guide for integrating the fraud detection worker into your application.

## Table of Contents

- [Overview](#overview)
- [Integration Methods](#integration-methods)
- [Quick Start](#quick-start)
- [Fail-Open Pattern](#fail-open-pattern)
- [Decision Handling](#decision-handling)
- [Progressive Rollout](#progressive-rollout)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Production Checklist](#production-checklist)

---

## Overview

The fraud detection worker is designed to integrate **transparently** into your signup flow without breaking existing functionality. Key principles:

1. **Fail-Open**: Never block legitimate users due to service issues
2. **Fast**: Validates in 0-20ms (RPC) or 5-50ms (HTTP)
3. **Transparent**: Degrades gracefully without affecting user experience
4. **Observable**: Full analytics and logging

### When to Use

✅ **Good Use Cases:**
- User signup/registration
- Email change requests
- Bulk import validation
- Form submissions with email fields
- Newsletter signups

❌ **Not Recommended:**
- Login validation (use different signals)
- Password reset (separate flow)
- Internal admin operations
- Existing users (only for new signups)

---

## Integration Methods

### Method 1: HTTP API (Universal)

**Best for:** Any application, any language

**Pros:**
- Works everywhere
- Simple to implement
- Language-agnostic

**Cons:**
- Higher latency (5-50ms)
- Network overhead

**Example:**
```javascript
const response = await fetch('https://your-worker.dev/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});
const result = await response.json();
```

### Method 2: Worker-to-Worker RPC (Cloudflare Only)

**Best for:** Cloudflare Workers applications

**Pros:**
- Ultra-low latency (0.1-0.5ms)
- Type-safe
- No serialization overhead
- Automatic load balancing

**Cons:**
- Cloudflare Workers only
- Requires service binding configuration

**Example:**
```typescript
const result = await env.FRAUD_DETECTOR.validate({
  email: 'user@example.com',
  consumer: 'MY_APP',
  flow: 'SIGNUP_EMAIL_VERIFY',
  headers: { 'cf-connecting-ip': request.headers.get('cf-connecting-ip') }
});
```

### Comparison

| Feature | HTTP API | RPC |
|---------|----------|-----|
| **Latency** | 5-50ms | 0.1-0.5ms |
| **Availability** | Universal | Cloudflare Workers only |
| **Type Safety** | ❌ | ✅ |
| **Fingerprinting** | Limited | Full |
| **Complexity** | Low | Medium |

**Recommendation:** Use RPC for Cloudflare Workers, HTTP for everything else.

---

## Quick Start

### Step 1: Deploy the Fraud Detection Worker

```bash
# Clone the repository
git clone https://github.com/your-org/markov-mail.git
cd markov-mail

# Install dependencies
npm install

# Deploy to Cloudflare
npm run deploy
```

### Step 2: Configure Your Application

#### For HTTP API:

Set the environment variable:
```bash
# .env
FRAUD_DETECTION_URL=https://your-worker.workers.dev/validate
```

#### For RPC:

Add service binding in `wrangler.jsonc`:
```jsonc
{
  "services": [{
    "binding": "FRAUD_DETECTOR",
    "service": "markov-mail",
    "entrypoint": "FraudDetectionService"
  }]
}
```

### Step 3: Integrate into Your Signup Flow

```javascript
async function handleSignup(email, password, name) {
  // Validate email with fraud detection
  const validation = await validateEmail(email);

  if (!validation.allow) {
    throw new Error('This email address cannot be used');
  }

  // Continue with normal signup
  await createUser(email, password, name);
}
```

See [examples/integrations/](../examples/integrations/) for framework-specific code.

---

## Fail-Open Pattern

**Critical:** Always implement fail-open behavior to ensure service outages don't block legitimate users.

### Good Example ✅

```javascript
async function validateEmail(email) {
  try {
    const response = await fetch(FRAUD_URL, {
      method: 'POST',
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(2000) // 2s timeout
    });

    if (!response.ok) {
      // Service error - fail open
      console.warn('Fraud detection unavailable, allowing signup');
      return { allow: true, decision: 'allow', riskScore: 0 };
    }

    const result = await response.json();
    return {
      allow: result.decision !== 'block',
      decision: result.decision,
      riskScore: result.riskScore
    };
  } catch (error) {
    // Network error, timeout, etc. - fail open
    console.error('Fraud detection failed:', error.message);
    console.info('Failing open: allowing signup to proceed');
    return { allow: true, decision: 'allow', riskScore: 0 };
  }
}
```

### Bad Example ❌

```javascript
async function validateEmail(email) {
  // NO TIMEOUT - can hang indefinitely
  const response = await fetch(FRAUD_URL, {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  // NO ERROR HANDLING - will throw and block signup
  const result = await response.json();

  // NO FAIL-OPEN - service error blocks all signups
  if (!response.ok) {
    throw new Error('Fraud detection failed');
  }

  return result;
}
```

### Key Requirements

1. ✅ **Timeout**: Always set a timeout (2-3 seconds)
2. ✅ **Try-Catch**: Wrap in try-catch
3. ✅ **Fail Open**: Return `allow: true` on error
4. ✅ **Log Errors**: Log failures for monitoring
5. ✅ **HTTP Status**: Check response.ok before parsing

---

## Decision Handling

The worker returns three decision types:

### 1. `allow` - Low Risk (< 0.3)

**Action:** Proceed normally

```javascript
if (result.decision === 'allow') {
  // Normal signup flow
  await createUser(email, password);
}
```

### 2. `warn` - Medium Risk (0.3 - 0.6)

**Action:** Allow with extra verification

```javascript
if (result.decision === 'warn') {
  console.warn(`Suspicious signup: ${email} (risk: ${result.riskScore})`);

  // Option 1: Require email verification
  await sendVerificationEmail(email);

  // Option 2: Add to review queue
  await flagForReview(email, result.riskScore);

  // Option 3: Require additional verification (phone, captcha)
  requirePhoneVerification = true;

  // Still allow signup
  await createUser(email, password);
}
```

### 3. `block` - High Risk (> 0.6)

**Action:** Reject signup

```javascript
if (result.decision === 'block') {
  console.warn(`Blocked signup: ${email} (reason: ${result.signals.blockReason})`);

  // Return user-friendly error
  throw new Error('This email address cannot be used for signup');

  // Or return specific error message
  return {
    error: 'INVALID_EMAIL',
    message: 'Please use a different email address'
  };
}
```

### Full Example

```javascript
async function handleSignup(email, password, name) {
  const validation = await validateEmail(email);

  switch (validation.decision) {
    case 'block':
      throw new Error('This email cannot be used');

    case 'warn':
      console.warn(`Suspicious email: ${email}`);
      await flagForReview(email, validation.riskScore);
      // Fall through to allow signup

    case 'allow':
      await createUser(email, password, name);
      break;
  }
}
```

---

## Progressive Rollout

Roll out fraud detection gradually to minimize risk:

### Phase 1: Logging Only (Week 1-2)

**Goal:** Collect data without impacting users

```javascript
const result = await validateEmail(email);

// Log decisions but never block
console.log({
  email: hashEmail(email),
  decision: result.decision,
  riskScore: result.riskScore,
  signals: result.signals
});

// Always allow
await createUser(email, password);
```

**Monitor:**
- Detection rate
- False positive indicators
- Risk score distribution

### Phase 2: Warn Mode (Week 3-4)

**Goal:** Add extra verification for suspicious emails

```javascript
const result = await validateEmail(email);

if (result.decision === 'warn' || result.decision === 'block') {
  // Add extra verification
  await sendVerificationEmail(email);
  requireEmailConfirmation = true;
}

// Still allow signup
await createUser(email, password);
```

**Monitor:**
- Email verification completion rate
- User complaints
- Actual fraud incidents

### Phase 3: Soft Block (Week 5-6)

**Goal:** Block only very high-risk emails

```javascript
const result = await validateEmail(email);

if (result.decision === 'block' && result.riskScore > 0.8) {
  // Block only high-confidence fraud
  throw new Error('Email cannot be used');
}

// Allow everything else
await createUser(email, password);
```

**Monitor:**
- Block rate
- User feedback
- Fraud reduction

### Phase 4: Full Enforcement (Week 7+)

**Goal:** Full fraud detection enforcement

```javascript
const result = await validateEmail(email);

if (result.decision === 'block') {
  throw new Error('Email cannot be used');
}

await createUser(email, password);
```

**Monitor:**
- False positive rate
- User satisfaction
- Fraud incidents

---

## Performance Optimization

### 1. Timeout Configuration

Set appropriate timeouts based on your SLA:

```javascript
// Strict SLA (< 100ms total signup time)
const TIMEOUT_MS = 1000; // 1 second

// Moderate SLA (< 500ms total signup time)
const TIMEOUT_MS = 2000; // 2 seconds

// Relaxed SLA (< 1s total signup time)
const TIMEOUT_MS = 3000; // 3 seconds
```

### 2. Parallel Validation

Don't block other operations while validating:

```javascript
async function handleSignup(email, password, name) {
  // Start validation and user creation in parallel
  const [validation, _] = await Promise.all([
    validateEmail(email),
    hashPassword(password) // Can run while validating
  ]);

  if (!validation.allow) {
    throw new Error('Email blocked');
  }

  await createUserInDatabase(email, hashedPassword, name);
}
```

### 3. Caching

Cache validation results for repeat attempts:

```javascript
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

async function validateEmailCached(email) {
  const cached = cache.get(email);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const result = await validateEmail(email);
  cache.set(email, { result, timestamp: Date.now() });
  return result;
}
```

**When to cache:**
- High-traffic endpoints
- Repeat validation attempts (form resubmissions)
- Rate-limited flows

**When NOT to cache:**
- Evolving attack patterns
- Real-time risk assessment needs

### 4. Background Validation

For analytics-only mode (no blocking):

```javascript
async function handleSignup(email, password, name, ctx) {
  // Start validation in background (don't await)
  ctx.waitUntil(
    validateEmail(email).then(result => {
      if (result.decision === 'block') {
        console.log(`[ANALYTICS] Would have blocked: ${email}`);
      }
    })
  );

  // Immediately proceed with signup
  await createUser(email, password, name);
}
```

---

## Error Handling

### Common Errors

#### 1. Network Timeout

```javascript
catch (error) {
  if (error.name === 'AbortError') {
    console.warn('Fraud detection timeout');
    return { allow: true, decision: 'allow', riskScore: 0 };
  }
}
```

#### 2. HTTP Error (503, 500)

```javascript
if (!response.ok) {
  console.warn(`Fraud detection returned ${response.status}`);
  return { allow: true, decision: 'allow', riskScore: 0 };
}
```

#### 3. Invalid Response

```javascript
try {
  const result = await response.json();
  if (!result.decision) {
    throw new Error('Invalid response format');
  }
  return result;
} catch (error) {
  console.error('Failed to parse response');
  return { allow: true, decision: 'allow', riskScore: 0 };
}
```

### Circuit Breaker Pattern

Stop calling the service after repeated failures:

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failures = 0;
    this.threshold = threshold;
    this.state = 'closed'; // closed | open | half-open
    this.nextAttempt = 0;
  }

  async execute(fn) {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttempt) {
        // Circuit is open, fail fast
        return { allow: true, decision: 'allow', riskScore: 0 };
      }
      this.state = 'half-open';
    }

    try {
      const result = await fn();
      // Success - reset
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.state = 'open';
        this.nextAttempt = Date.now() + this.timeout;
      }
      return { allow: true, decision: 'allow', riskScore: 0 };
    }
  }
}
```

---

## Security Considerations

### 1. Don't Expose Risk Scores to Users

❌ **Bad:**
```javascript
return {
  error: 'Email blocked',
  riskScore: 0.85,
  reason: 'sequential_pattern'
};
```

✅ **Good:**
```javascript
return {
  error: 'This email address cannot be used for signup'
};
// Log details server-side only
```

### 2. Hash Emails in Logs

```javascript
import crypto from 'crypto';

function hashEmail(email) {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 16);
}

console.log({
  emailHash: hashEmail(email),
  decision: result.decision,
  riskScore: result.riskScore
});
```

### 3. Rate Limiting

Add rate limiting to prevent enumeration:

```javascript
// Allow 10 signup attempts per IP per hour
const rateLimiter = new RateLimiter({ max: 10, window: 3600000 });

if (!await rateLimiter.check(ip)) {
  throw new Error('Too many attempts');
}

const validation = await validateEmail(email);
```

### 4. Input Validation

Always validate email format first:

```javascript
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

if (!isValidEmail(email)) {
  throw new Error('Invalid email format');
}

// Then check fraud
const validation = await validateEmail(email);
```

---

## Testing

### Unit Tests

```javascript
describe('validateEmail', () => {
  it('should allow legitimate emails', async () => {
    const result = await validateEmail('person1.person2@example.com');
    expect(result.allow).toBe(true);
    expect(result.decision).toBe('allow');
  });

  it('should block sequential patterns', async () => {
    const result = await validateEmail('user123@example.com');
    expect(result.allow).toBe(false);
    expect(result.decision).toBe('block');
  });

  it('should fail open on timeout', async () => {
    // Mock timeout
    global.fetch = jest.fn(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 100)
      )
    );

    const result = await validateEmail('test@example.com');
    expect(result.allow).toBe(true); // Fails open
  });

  it('should fail open on service error', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 503 })
    );

    const result = await validateEmail('test@example.com');
    expect(result.allow).toBe(true); // Fails open
  });
});
```

### Integration Tests

```javascript
describe('signup endpoint', () => {
  it('should allow legitimate signups', async () => {
    const response = await request(app)
      .post('/api/signup')
      .send({
        email: 'person1@example.com',
        password: 'secure123',
        name: 'John Doe'
      });

    expect(response.status).toBe(200);
  });

  it('should block fraudulent signups', async () => {
    const response = await request(app)
      .post('/api/signup')
      .send({
        email: 'user123@example.com',
        password: 'test',
        name: 'Test'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('email');
  });
});
```

### Load Testing

Test with realistic traffic:

```bash
# Using k6
k6 run --vus 100 --duration 30s load-test.js
```

```javascript
// load-test.js
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  const payload = JSON.stringify({
    email: `user${__VU}@example.com`,
    password: 'test123',
    name: 'Test User'
  });

  const response = http.post('http://localhost:3000/api/signup', payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  check(response, {
    'status is 200 or 400': (r) => [200, 400].includes(r.status),
    'response time < 500ms': (r) => r.timings.duration < 500
  });
}
```

---

## Monitoring

### Key Metrics

Track these metrics in production:

```javascript
// Validation metrics
{
  validation_success_rate: 99.5, // % of successful API calls
  avg_latency_ms: 12.3,
  p95_latency_ms: 25.1,
  p99_latency_ms: 48.2,
  timeout_rate: 0.1, // % of timeouts

  // Decision distribution
  allow_rate: 85.2,
  warn_rate: 12.3,
  block_rate: 2.5,

  // Risk scores
  avg_risk_score: 0.23,
  p95_risk_score: 0.62,

  // Errors
  network_error_rate: 0.2,
  service_error_rate: 0.1
}
```

### Alerting

Set up alerts for:

**Critical:**
- Validation success rate < 95%
- P99 latency > 1000ms
- Service error rate > 5%

**Warning:**
- Block rate > 5% (potential false positives)
- Timeout rate > 1%
- Avg latency > 100ms

### Logging

Log all validations for analysis:

```javascript
console.log({
  timestamp: new Date().toISOString(),
  event: 'email_validation',
  emailHash: hashEmail(email),
  decision: result.decision,
  riskScore: result.riskScore,
  blockReason: result.signals?.blockReason,
  latencyMs: duration,
  success: true
});
```

---

## Production Checklist

### Before Launch

**Implementation:**
- [ ] Fail-open pattern implemented
- [ ] Timeout configured (2-3 seconds)
- [ ] Error handling covers all cases
- [ ] Logging enabled (with hashed emails)
- [ ] Environment variables configured

**Testing:**
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Load testing completed
- [ ] Timeout handling verified
- [ ] Service failure handling verified

**Monitoring:**
- [ ] Metrics tracking configured
- [ ] Alerts configured
- [ ] Dashboard created
- [ ] On-call rotation defined

**Rollout:**
- [ ] Start in log-only mode
- [ ] Define progressive rollout plan
- [ ] Review criteria for each phase
- [ ] Rollback plan documented

### Post-Launch

**Week 1:**
- [ ] Monitor validation success rate (target: > 99%)
- [ ] Review latency metrics (target: p95 < 50ms)
- [ ] Analyze decision distribution
- [ ] Check for false positives

**Week 2:**
- [ ] Review blocked email samples
- [ ] Adjust configuration if needed
- [ ] Plan move to next phase

**Ongoing:**
- [ ] Weekly review of metrics
- [ ] Monthly review of false positives
- [ ] Quarterly configuration tuning

---

## Related Documentation

- [API Reference](API.md) - Complete API documentation
- [Configuration Guide](CONFIGURATION.md) - Configure risk thresholds
- [Analytics Dashboard](ANALYTICS.md) - Monitor fraud detection
- [Integration Examples](../examples/integrations/) - Framework-specific code

---

**Questions?** Open an issue on GitHub or refer to the API documentation.

**Last Updated:** 2025-11-01
