# Bogus Email Pattern Recognition - Implementation Plan

## Project Overview
Create an inline email validation service for Cloudflare Workers that prevents fake account signups by analyzing email patterns, fingerprinting users, and detecting suspicious behavior.

## Available Fingerprinting Data
Based on Cloudflare Workers request data, we have access to:

### Primary Signals
- `cf-connecting-ip` - Client IP address
- `cf-ja4` - JA4 fingerprint (TLS client hello)
- `cf-ja3-hash` - JA3 fingerprint (legacy)
- `user-agent` - User agent string
- `cf-bot-score` - Bot detection score (1-99)

### Geolocation Data
- `cf-ipcountry`, `cf-region`, `cf-ipcity`
- `cf-timezone`
- `cf-iplatitude`, `cf-iplongitude`
- `cf-postal-code`

### Advanced Signals
- `botManagement.ja4Signals` - Behavioral ratios and rankings
  - `h2h3_ratio_1h` - HTTP/2 vs HTTP/3 usage
  - `browser_ratio_1h` - Browser behavior patterns
  - `reqs_rank_1h` - Request frequency ranking
  - `ips_rank_1h` - IP reputation ranking
  - `cache_ratio_1h` - Cache hit patterns
- `cf-device-type` - Device classification
- `tlsVersion`, `tlsCipher` - TLS configuration
- `clientTcpRtt` - Network latency
- `asn`, `asOrganization` - ISP information

### Composite Fingerprint Strategy
Create unique fingerprint: `SHA256(IP + JA4 + ASN + Device-Type + Bot-Score)`

## ⚠️ Threat Model: Sophisticated Attackers

### Attack Profile (Updated Understanding)

**Key Characteristics:**
1. **Residential IPs** - Not datacenter/VPN IPs, appear as legitimate home users
   - ISPs: Comcast, AT&T, Verizon, etc.
   - Geolocation matches residential areas
   - Cannot rely on ASN filtering alone

2. **Low Volume Attacks** - Stay below traditional rate limits
   - 1-5 signups per hour per IP
   - Distributed across many IPs
   - Avoid burst patterns
   - Long time between attempts (90+ minutes)

3. **OTP Capable** - Can complete email verification
   - Use real, working email addresses
   - Not disposable domains
   - Often Gmail, Yahoo, Outlook
   - Can receive and complete verification flows

4. **Pattern Awareness** - Sophisticated and adaptive
   - Avoid obvious disposable domains
   - Use realistic-looking names
   - Rotate fingerprints (user agents, TLS configs)
   - Mimic legitimate user behavior

### Example Attack Scenario

```
09:00 - IP: 73.x.x.x (Comcast, CA) - john.smith.2024@gmail.com
10:30 - IP: 99.x.x.x (AT&T, TX) - jane.doe.2024@gmail.com
12:15 - IP: 108.x.x.x (Verizon, NY) - mike.johnson.2024@gmail.com
14:45 - IP: 76.x.x.x (Comcast, FL) - sarah.williams.2024@gmail.com

All PASS current checks:
✅ Valid format
✅ Not disposable domain (Gmail)
✅ Low entropy (real names)
✅ Different IPs (residential)
✅ Different fingerprints
✅ Can complete OTP verification
✅ No rate limit hit (1-2 per IP per day)

Detection Gap: All would be ALLOWED! ⚠️
```

### What Makes Them Detectable?

**Email Pattern Families:**
Even sophisticated attackers create patterns:

1. **Sequential Patterns:**
   - `user123@`, `user456@`, `user789@`
   - `john1@`, `john2@`, `john3@`
   - `testaccount1@`, `testaccount2@`

2. **Date/Year Patterns:**
   - `firstname.lastname.2024@`
   - `user2024@`, `user2025@`
   - `name_oct2024@`, `name_nov2024@`

3. **Common Format Patterns:**
   - `firstname.lastname@` (too consistent)
   - `firstnamelastname@` (no separator variety)
   - `first_last_XXXX@` (same structure)

4. **Plus-Addressing Abuse:**
   - `baseuser+1@`, `baseuser+2@`, `baseuser+3@`
   - Easy to detect with normalization

5. **Provider Clustering:**
   - All use Gmail (unusual for real users)
   - Never use business domains
   - Avoid smaller providers

6. **Temporal Patterns:**
   - Regular intervals (every 90 min)
   - Same time of day
   - Consistent timezone (despite IP location changes)
   - Burst patterns followed by quiet periods

### Enhanced Detection Strategy

**Layer 1: Email Pattern Analysis** ⭐ HIGH PRIORITY
```typescript
Pattern Detection:
- Extract base pattern (remove numbers, dates)
- Track pattern families (firstname.lastname.YEAR)
- Detect sequential numbering
- Plus-addressing normalization
- Year/date suffix detection

Example:
- "john.doe.2024@gmail.com" → pattern: "firstname.lastname.YEAR@gmail"
- "jane.smith.2024@gmail.com" → SAME PATTERN
- Risk increases with pattern frequency
```

**Layer 2: Rate Limiting 2.0** (Not just IP-based)
```typescript
Multiple Rate Limit Dimensions:
1. Per fingerprint: 5/hour (current)
2. Per email pattern family: 10/hour (NEW)
3. Per provider + pattern: 20/hour (NEW)
4. Per pattern globally: 50/hour (NEW)
5. Per ASN + pattern: 30/hour (NEW)

Key: Pattern family rate limits catch distributed attacks
```

**Layer 3: Temporal Analysis**
```typescript
Behavioral Signals:
- Inter-arrival time (IAT) consistency
- Time zone vs IP location match
- Activity rhythm analysis
- Burst detection
- Quiet period patterns
```

**Layer 4: Reputation System**
```typescript
Pattern Family Reputation:
- Track pattern families over time
- Historical abuse rates
- False positive tracking
- Adaptive risk scores
```

### Updated Detection Priorities

**Cannot Rely On:**
- ❌ IP-based rate limiting (residential IPs, low volume)
- ❌ ASN filtering (residential ISPs are legitimate)
- ❌ Bot score alone (can be high for real browsers)
- ❌ Disposable domain lists (they use Gmail/Yahoo)

**Must Focus On:**
- ✅ Email pattern structure analysis
- ✅ Pattern family frequency tracking
- ✅ Temporal behavioral patterns
- ✅ Cross-request pattern correlation
- ✅ Provider + pattern combinations
- ✅ Plus-addressing normalization

### Effectiveness Goals

**Current System:**
- Simple attacks: 90%+ detection ✅
- Sophisticated attacks: ~10% detection ⚠️

**Enhanced System (with pattern analysis):**
- Simple attacks: 95%+ detection ✅
- Sophisticated attacks: 60-70% detection 🎯
- False positive rate: < 5% ⭐

**Key Insight:** Volume-independent detection is crucial. We cannot rely on rate limits alone when attackers use low volume + distributed IPs.

## Observability & Logging

### Structured Logging with Pino
Use Pino.js for structured JSON logging per [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#logging-structured-json-objects):

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

// Log validation event
logger.info({
  event: 'email_validation',
  email_hash: hashEmail(email),
  fingerprint: fingerprint.hash,
  risk_score: result.riskScore,
  decision: result.decision,
  signals: result.signals,
  timestamp: Date.now()
});
```

### Log Categories
1. **Validation Events** - Every validation attempt with decision
2. **Blocks** - High-risk emails blocked (for review)
3. **Rate Limits** - When fingerprints hit rate limits
4. **Errors** - System errors and exceptions
5. **Metrics** - Aggregate statistics (every 1 min)

### Observability Dashboards

Use Cloudflare Workers Analytics Engine and custom dashboards:

**Metrics to Track:**
- **Validation Volume**
  - Total validations per minute/hour/day
  - Validations by decision (allow/warn/block)
  - Success vs error rate

- **Risk Distribution**
  - Risk score histogram (0.0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0)
  - Average risk score over time
  - High-risk pattern trends

- **Block Reasons**
  - Count by reason (disposable, entropy, rate limit, etc.)
  - Top blocked domains
  - False positive tracking

- **Fingerprint Analysis**
  - Unique fingerprints per hour
  - Top fingerprints by validation count
  - Bot score distribution
  - ASN distribution (detect hosting providers)

- **Performance**
  - P50, P95, P99 latency
  - Cache hit rates
  - DO query times

**Dashboard Implementation:**
```typescript
// Write metrics to Analytics Engine
env.ANALYTICS.writeDataPoint({
  blobs: [decision, blockReason, country],
  doubles: [riskScore, entropyScore, botScore],
  indexes: [fingerprintHash]
});
```

### Testing Strategy

Use [Vitest with Cloudflare Workers](https://developers.cloudflare.com/workers/testing/vitest-integration/):

**Test Structure:**
```
tests/
├── unit/
│   ├── validators/
│   │   ├── email.test.ts        # Email validation logic
│   │   └── domain.test.ts       # Domain validation logic
│   ├── detectors/
│   │   ├── entropy.test.ts      # Entropy calculations
│   │   └── patterns.test.ts     # Pattern matching
│   └── fingerprint.test.ts      # Fingerprinting logic
├── integration/
│   ├── validate-endpoint.test.ts    # Full validation flow
│   └── rate-limiting.test.ts        # Rate limit with DO
└── fixtures/
    └── test-emails.ts           # Sample emails for testing
```

**Test Coverage Goals:**
- Unit tests: > 90% coverage
- Integration tests: All endpoints
- Edge cases: Invalid inputs, high load, malformed data

**Example Test:**
```typescript
import { env, createExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Email Validation', () => {
  it('should block high-entropy emails', async () => {
    const request = new Request('http://localhost/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'xk9m2qw7r4p@example.com' })
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    const result = await response.json();

    expect(result.decision).toBe('warn');
    expect(result.signals.entropyScore).toBeGreaterThan(0.7);
  });
});
```

## Architecture

### 1. Core Components

#### A. Fingerprinting Service (`src/fingerprint.ts`)
- [ ] Extract all available signals from request
- [ ] Generate composite fingerprint hash
- [ ] Analyze bot management signals
- [ ] Calculate trust score from multiple signals
- [ ] Detect VPN/proxy/hosting providers via ASN

#### B. Email Validator (`src/validators/email.ts`)
- [ ] RFC 5322 format validation
- [ ] Entropy analysis for random strings
- [ ] Pattern matching (sequential numbers, keyboard walks)
- [ ] Local-part analysis (common test patterns)
- [ ] Plus-addressing detection and normalization

#### C. Domain Validator (`src/validators/domain.ts`)
- [ ] Disposable email provider detection
- [ ] MX record lookup and validation
- [ ] Domain reputation checking
- [ ] Free email provider detection (optional)
- [ ] Subdomain depth analysis

#### D. Pattern Detection (`src/detectors/`)
- [ ] `entropy.ts` - Calculate Shannon entropy for randomness
- [ ] `keyboard-walk.ts` - Detect qwerty/keyboard patterns
- [ ] `sequential.ts` - Find number sequences and patterns
- [ ] `common-patterns.ts` - Known bogus patterns database

#### E. Durable Object: ValidationTracker (`src/do/validation-tracker.ts`)
Uses SQLite for persistent storage:

**Tables (Enhanced for Sophisticated Attacks):**
```sql
-- Rate limiting by fingerprint
CREATE TABLE rate_limits (
  fingerprint TEXT PRIMARY KEY,
  attempts INTEGER DEFAULT 0,
  first_seen INTEGER,
  last_seen INTEGER,
  blocked INTEGER DEFAULT 0
);

-- Email pattern family tracking ⭐ NEW/ENHANCED
CREATE TABLE email_pattern_families (
  pattern_family TEXT PRIMARY KEY,  -- e.g., "firstname.lastname.YEAR@gmail"
  pattern_signature TEXT,            -- normalized pattern
  count INTEGER DEFAULT 0,
  first_seen INTEGER,
  last_seen INTEGER,
  blocked_count INTEGER DEFAULT 0,
  allowed_count INTEGER DEFAULT 0,
  risk_score REAL,
  provider TEXT,                     -- gmail, yahoo, etc.
  last_emails TEXT                   -- JSON array of recent examples (hashed)
);

-- Pattern family rate limiting ⭐ NEW
CREATE TABLE pattern_rate_limits (
  pattern_family TEXT,
  time_window INTEGER,               -- hour bucket
  attempt_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  PRIMARY KEY (pattern_family, time_window)
);

-- Provider + Pattern combinations ⭐ NEW
CREATE TABLE provider_pattern_stats (
  provider TEXT,                     -- gmail.com, yahoo.com
  pattern_type TEXT,                 -- sequential, dated, formatted
  count INTEGER DEFAULT 0,
  risk_score REAL,
  first_seen INTEGER,
  last_seen INTEGER,
  PRIMARY KEY (provider, pattern_type)
);

-- Temporal analysis ⭐ NEW
CREATE TABLE temporal_patterns (
  pattern_family TEXT,
  inter_arrival_times TEXT,          -- JSON array of IAT values
  last_timestamp INTEGER,
  regularity_score REAL,             -- 0-1, higher = more regular
  timezone_consistency REAL,         -- 0-1, higher = more consistent
  PRIMARY KEY (pattern_family)
);

-- Validation attempts log
CREATE TABLE validation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  fingerprint TEXT,
  email_hash TEXT,
  pattern_family TEXT,               -- ⭐ NEW
  risk_score REAL,
  decision TEXT,
  signals TEXT -- JSON
);

-- Disposable domains cache
CREATE TABLE disposable_domains (
  domain TEXT PRIMARY KEY,
  added_at INTEGER
);

-- Plus-addressing normalization cache ⭐ NEW
CREATE TABLE email_normalizations (
  original_hash TEXT PRIMARY KEY,
  normalized_hash TEXT,
  base_email TEXT,                   -- base@domain.com from base+tag@domain.com
  plus_tag TEXT                      -- the +tag part
);
```

**Methods (Enhanced):**

**Core Rate Limiting:**
- [ ] `checkRateLimit(fingerprint)` - Track attempts per fingerprint
- [ ] `checkPatternRateLimit(patternFamily)` - ⭐ NEW - Track per pattern family
- [ ] `checkProviderPatternLimit(provider, patternType)` - ⭐ NEW
- [ ] `checkGlobalPatternLimit(patternFamily)` - ⭐ NEW

**Pattern Analysis:**
- [ ] `extractPatternFamily(email)` - ⭐ NEW - Extract pattern signature
- [ ] `trackEmailPattern(email, patternFamily)` - Enhanced with family tracking
- [ ] `normalizeEmail(email)` - ⭐ NEW - Handle plus-addressing
- [ ] `detectPatternType(email)` - ⭐ NEW - Sequential/dated/formatted
- [ ] `getPatternReputation(patternFamily)` - ⭐ NEW - Historical risk score

**Temporal Analysis:**
- [ ] `recordTimestamp(patternFamily, timestamp)` - ⭐ NEW
- [ ] `analyzeInterArrivalTimes(patternFamily)` - ⭐ NEW
- [ ] `detectRegularityPattern(iatArray)` - ⭐ NEW
- [ ] `checkTimezoneConsistency(pattern, timezone, location)` - ⭐ NEW

**Statistics & Admin:**
- [ ] `recordValidation(data)` - Enhanced with pattern data
- [ ] `getPatternFamilyStats(patternFamily)` - ⭐ NEW
- [ ] `getTopRiskyPatterns(limit)` - ⭐ NEW
- [ ] `getStatistics()` - Enhanced return data
- [ ] `updatePatternReputation(patternFamily, feedback)` - ⭐ NEW

**Legacy (keeping for compatibility):**
- [ ] `isDisposableDomain(domain)` - Check against list
- [ ] `updateDisposableList(domains[])` - Bulk update domains

### 2. Validation Flow (Enhanced)

```
Request → Extract Fingerprint → Generate Composite ID
                                        ↓
                         ┌──────────────┴──────────────┐
                         ↓                              ↓
                 Normalize Email                Extract Pattern Family
                 (plus-addressing)              (firstname.lastname.YEAR)
                         ↓                              ↓
                 ┌───────┴────────┬─────────────────────┴─────────┐
                 ↓                ↓                               ↓
         Check Rate Limits:   Check Pattern          Check Provider+Pattern
         - Per fingerprint    Rate Limits:           Rate Limits:
         - Global            - Per pattern family    - Gmail+dated
                            - Per pattern globally   - Yahoo+sequential
                 └───────┬────────┴─────────────────────┬─────────┘
                         ↓                              ↓
                Parse & Validate Email          Get Pattern Reputation
                         ↓                       (historical risk)
        ┌────────────────┼────────────────┬──────────────┐
        ↓                ↓                ↓              ↓
 Local Analysis   Domain Check    Pattern Type    Temporal
 - Entropy        - Disposable    - Sequential    - IAT analysis
 - Format         - Free provider - Dated         - Regularity
 - Length         - Reputation    - Formatted     - Timezone
        └────────────────┼────────────────┴──────────────┘
                         ↓
                Aggregate Risk Score:
                - Format (5%)
                - Disposable (25%)
                - Entropy (15%)
                - Pattern match (20%) ⭐
                - Pattern reputation (15%) ⭐
                - Rate limits (10%)
                - Bot score (10%)
                         ↓
                ┌────────┴────────┐
                ↓                  ↓
         Decision Logic      Record to DO:
         - allow            - Pattern family
         - warn             - Timestamps
         - block            - Rate limits
                            - Reputation updates
                         ↓
                      Return Response
```

### 3. Risk Scoring System (Enhanced)

**Score Calculation (0.0 - 1.0):**

| Check | Weight | Pass Score | Fail Score | Priority |
|-------|--------|------------|------------|----------|
| Format Valid | 0.05 | 0.0 | 1.0 | High |
| Disposable Domain | 0.25 | 0.0 | 0.95 | High |
| High Entropy | 0.10 | 0.0 | entropy_score | Medium |
| **Pattern Family Match** ⭐ | **0.20** | **0.0** | **0.7-0.9** | **Critical** |
| **Pattern Reputation** ⭐ | **0.15** | **0.0** | **reputation** | **Critical** |
| **Pattern Rate Limit** ⭐ | **0.10** | **0.0** | **0.85** | **High** |
| Fingerprint Rate Limit | 0.05 | 0.0 | 0.7 | Medium |
| Bot Score | 0.05 | (100-score)/100 | - | Low |
| Hosting ASN | 0.03 | 0.0 | 0.5 | Low |
| **Temporal Regularity** ⭐ | **0.02** | **0.0** | **regularity** | **Medium** |

**Pattern Match Scoring:**
```typescript
Pattern Detection                        Score
--------------------------------------------
Sequential (user1, user2, user3)         0.8
Dated (firstname.lastname.2024)          0.7
Plus-addressing (base+1, base+2)         0.9
Common format repetition                 0.6
Keyboard walk                            0.8
```

**Pattern Reputation Scoring:**
```typescript
Historical Data                          Score
--------------------------------------------
Never seen before                        0.2 (neutral)
Seen 1-5 times, all allowed             0.1 (good)
Seen 5-20 times, mixed                  0.3 (suspicious)
Seen 20+ times, mostly blocked          0.8 (very risky)
Seen 50+ times in 24h                   0.9 (attack pattern)
```

**Decision Thresholds:**
- `< 0.3` - Allow (low risk)
- `0.3 - 0.6` - Warn (medium risk, log for review)
- `> 0.6` - Block (high risk)

**Key Changes:**
- ⭐ Pattern detection now 20% of score (highest single factor after disposable)
- ⭐ Pattern reputation adds 15% based on historical abuse
- ⭐ Pattern-based rate limiting separate from IP-based
- Reduced entropy weight from 15% to 10% (less reliable for sophisticated attacks)
- Added temporal regularity signal (low weight, but helpful)

### 4. Configuration

#### Environment Variables (`wrangler.jsonc`)
```jsonc
{
  "vars": {
    "RISK_THRESHOLD_BLOCK": "0.6",
    "RISK_THRESHOLD_WARN": "0.3",
    "ENABLE_MX_CHECK": "true",
    "ENABLE_RATE_LIMIT": "true",
    "MAX_ATTEMPTS_PER_HOUR": "5",
    "MAX_ATTEMPTS_PER_DAY": "20",
    "ENABLE_DISPOSABLE_CHECK": "true",
    "ENABLE_PATTERN_CHECK": "true",
    "LOG_ALL_VALIDATIONS": "true"
  }
}
```

#### KV Namespaces
- [ ] `EMAIL_VALIDATION_CACHE` - Cache MX lookups, domain reputation
- [ ] `DISPOSABLE_DOMAINS` - Disposable email provider list (updated weekly)

#### Durable Objects
- [ ] `ValidationTracker` - Rate limiting and behavioral tracking

### 5. API Design

#### Validation Endpoint
```typescript
POST /validate

Request:
{
  "email": "user@example.com",
  "context": {
    "source": "signup_form",    // Optional: track source
    "metadata": {}               // Optional: additional context
  }
}

Response (Success):
{
  "valid": true,
  "riskScore": 0.15,
  "fingerprint": "abc123...",
  "signals": {
    "formatValid": true,
    "disposableDomain": false,
    "patternMatch": null,
    "entropyScore": 0.45,
    "mxValid": true,
    "rateLimitOk": true,
    "botScore": 1
  },
  "decision": "allow",
  "message": "Email validated successfully"
}

Response (Blocked):
{
  "valid": false,
  "riskScore": 0.85,
  "fingerprint": "def456...",
  "signals": {
    "formatValid": true,
    "disposableDomain": true,
    "patternMatch": "disposable_provider",
    "entropyScore": 0.65,
    "mxValid": true,
    "rateLimitOk": true,
    "botScore": 15
  },
  "decision": "block",
  "message": "Disposable email domain detected",
  "code": "DISPOSABLE_DOMAIN"
}
```

#### Admin Endpoints
```typescript
GET /stats - Get validation statistics
POST /whitelist - Add domain/email to whitelist
POST /blacklist - Add domain/email to blacklist
POST /update-disposable-list - Update disposable domain list
```

### 6. Implementation Phases

#### Phase 1: Core Infrastructure ✓
- [x] Project setup
- [x] Fingerprinting service
- [x] Email format validation
- [x] Basic pattern detection (entropy)
- [x] Test endpoint with validation

#### Phase 2: Logging & Observability
- [ ] Install and configure Pino.js
- [ ] Create logger utility with structured logging
- [ ] Add Analytics Engine binding
- [ ] Implement metrics collection
- [ ] Log all validation events with proper categories
- [ ] Create dashboard queries for monitoring

#### Phase 3: Testing Infrastructure
- [ ] Install Vitest and @cloudflare/vitest-pool-workers
- [ ] Set up test configuration
- [ ] Create test fixtures (sample emails)
- [ ] Write unit tests for validators
- [ ] Write unit tests for fingerprinting
- [ ] Create integration tests for endpoints
- [ ] Set up CI/CD with test coverage

#### Phase 4: Domain Validation
- [ ] Disposable domain list (top 1000)
- [ ] MX record lookup with caching
- [ ] Domain reputation basics
- [ ] KV namespace for caching

#### Phase 5: Durable Objects
- [ ] Rate limiting with SQLite
- [ ] Pattern tracking
- [ ] Validation logging to DO
- [ ] Statistics aggregation

#### Phase 6: Advanced Detection

**Phase 6A: Quick Wins (✅ COMPLETED 2025-11-01)**
- [x] Keyboard walk detection
- [x] Sequential pattern detection
- [x] Dated pattern detection
- [x] Plus-addressing normalization
- [x] N-Gram gibberish detection
- [x] TLD risk profiling (40+ TLDs)
- [x] Benford's Law batch analysis
- Tests: 169/169 passing
- Detection improvement: +15 percentage points

**Phase 6B: Statistical Methods (🚧 PLANNED)**
- [ ] Markov Chain character transition analysis
- [ ] Edit Distance clustering (Levenshtein)
- [ ] Enhanced name generation detection
- Timeline: 2-3 weeks
- Expected improvement: +5-10%

**Phase 6C: Temporal Analysis (🚧 PLANNED - Requires DO)**
- [ ] Inter-Arrival Time Analysis
- [ ] Velocity Scoring per fingerprint/pattern
- [ ] Rate Limiting (multi-dimensional)
- [ ] Durable Objects with SQLite backend
- Timeline: 4-6 weeks
- Expected improvement: +3-5%

#### Phase 7: API & Integration
- [ ] Admin endpoints (whitelist/blacklist)
- [ ] Statistics endpoint
- [ ] Example integration code
- [ ] API documentation
- [ ] Rate limit configuration

#### Phase 8: Optimization & Production
- [ ] Performance optimization (< 100ms p95)
- [ ] Cache strategy refinement
- [ ] Edge case handling
- [ ] Load testing
- [ ] Production deployment checklist

### 7. Disposable Email Providers List

Initial seed list (top 50, expand to 1000+):
- 10minutemail.com, guerrillamail.com, mailinator.com
- tempmail.com, throwaway.email, getnada.com
- maildrop.cc, yopmail.com, temp-mail.org
- minutemail.com, sharklasers.com, fakeinbox.com
- etc.

Update strategy:
- Weekly updates from community lists
- Manual additions via admin endpoint
- Auto-detection based on patterns

### 8. Performance Targets

- Validation latency: < 100ms (p95)
- Cache hit rate: > 80% for domain lookups
- False positive rate: < 5%
- False negative rate: < 10%

### 9. Monitoring & Alerts

Track via Workers Analytics:
- Validation requests per minute
- Block rate percentage
- Average risk scores
- Most common failure reasons
- Fingerprint collision rate

### 10. Future Enhancements

- [ ] Machine learning model for pattern detection
- [ ] Email verification via SMTP
- [ ] Honeypot email detection
- [ ] Temporal pattern analysis (burst detection)
- [ ] Collaborative filtering (shared blocklist)
- [ ] A/B testing framework for thresholds
- [ ] Real-time admin dashboard

## File Structure

```
src/
├── index.ts                 # Main worker entry point
├── fingerprint.ts           # Fingerprinting service
├── logger.ts                # Pino logger configuration
├── validators/
│   ├── email.ts            # Email format validation
│   └── domain.ts           # Domain validation
├── detectors/
│   ├── entropy.ts          # Entropy analysis
│   ├── keyboard-walk.ts    # Keyboard pattern detection
│   ├── sequential.ts       # Sequential pattern detection
│   └── common-patterns.ts  # Known patterns database
├── do/
│   └── validation-tracker.ts  # Durable Object with SQLite
├── types/
│   └── index.ts            # TypeScript types
├── utils/
│   ├── scoring.ts          # Risk score calculation
│   ├── cache.ts            # KV cache helpers
│   └── metrics.ts          # Analytics Engine helpers
└── data/
    └── disposable-domains.ts  # Disposable domain list

tests/
├── unit/
│   ├── validators/
│   │   ├── email.test.ts
│   │   └── domain.test.ts
│   ├── detectors/
│   │   ├── entropy.test.ts
│   │   ├── keyboard-walk.test.ts
│   │   └── sequential.test.ts
│   └── fingerprint.test.ts
├── integration/
│   ├── validate-endpoint.test.ts
│   ├── rate-limiting.test.ts
│   └── admin-endpoints.test.ts
├── fixtures/
│   └── test-emails.ts
└── setup.ts

docs/
├── API.md
├── INTEGRATION.md
├── OBSERVABILITY.md
└── DEPLOYMENT.md

analytics/
└── dashboard-queries.sql    # GraphQL queries for dashboards
```

## Getting Started

1. Update wrangler.jsonc with bindings
2. Implement core validators
3. Set up Durable Object with SQLite
4. Create disposable domain list
5. Build main validation endpoint
6. Test with sample payloads
7. Deploy to production

## Success Metrics

- 90%+ of fake signups blocked
- < 5% false positive rate
- < 100ms p95 latency
- Easy integration for developers
- Configurable thresholds
- Comprehensive logging for debugging
