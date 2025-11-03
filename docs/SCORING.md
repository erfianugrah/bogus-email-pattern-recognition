# Risk Scoring System

**Complete guide to risk calculation, weights, and decision logic**

## Table of Contents

1. [Overview](#overview)
2. [Scoring Philosophy](#scoring-philosophy)
3. [Risk Weights](#risk-weights)
4. [Scoring Strategy](#scoring-strategy)
5. [Special Cases](#special-cases)
6. [Decision Thresholds](#decision-thresholds)
7. [Examples](#examples)
8. [Tuning Guide](#tuning-guide)

---

## Overview

The fraud detection system uses a **weighted multi-signal approach** to calculate risk scores from 0.0 (safe) to 1.0 (fraudulent). The system combines signals from 8 independent detectors using a hybrid scoring strategy.

### Key Characteristics

- **Range**: 0.0 - 1.0 (normalized)
- **Detectors**: 8 independent fraud detectors
- **Strategy**: Hybrid (max-based + additive)
- **Weights**: Configurable, sum to 1.0
- **Latency**: < 5ms for all calculations

---

## Scoring Philosophy

### Design Goals

1. **Prevent Double-Counting**: Same fraud signal shouldn't be scored multiple times
2. **Layered Defense**: Multiple independent signals provide redundancy
3. **High-Confidence Priority**: Most accurate detectors get highest weight
4. **Tunable**: Easy to adjust weights based on production data
5. **Explainable**: Clear reason for every decision

### Why Hybrid Scoring?

**Problem**: Pattern detectors and Markov chains can detect the same fraud signal:
```
Email: user123@gmail.com

Pattern Detector: ✅ Sequential pattern detected (confidence: 0.9)
Markov Chain:     ✅ Fraudulent transitions detected (confidence: 0.85)

❌ Old approach (additive):
   riskScore = (0.9 * 0.30) + (0.85 * 0.35) = 0.27 + 0.30 = 0.57

✅ New approach (max-based):
   riskScore = max(0.9 * 0.30, 0.85 * 0.35) = max(0.27, 0.30) = 0.30
```

**Solution**:
- Domain signals (domain + TLD) are **independent** → additive scoring
- Local part signals (entropy + pattern + markov) **overlap** → max-based scoring

This prevents counting the same "user123" pattern twice while maintaining detection accuracy.

---

## Risk Weights

### Current Configuration (v1.4.0)

```typescript
riskWeights: {
  entropy:           0.05,  // 5%  - Baseline for randomness
  domainReputation:  0.15,  // 15% - Disposable domain detection
  tldRisk:           0.15,  // 15% - TLD risk profiling (142 TLDs)
  patternDetection:  0.30,  // 30% - 5 pattern detectors combined
  markovChain:       0.35,  // 35% - Highest accuracy (98%)
}

// Total: 1.00 (100%)
```

### Weight Rationale

#### Entropy (5%)
- **Purpose**: Baseline randomness detection
- **Why Low**: High false positive rate on legitimate random usernames
- **Role**: Safety net for truly random gibberish
- **Examples**: `xk9m2qw7r4p@` → high entropy → contributes 0.05 risk

#### Domain Reputation (15%)
- **Purpose**: Disposable email domain detection
- **Data Source**: 71,751 known disposable domains in KV
- **Why 15%**: Strong signal when present, but many legitimate domains have no reputation
- **Examples**: `user@tempmail.com` → disposable → contributes 0.15 risk

#### TLD Risk (15%)
- **Purpose**: Top-Level Domain risk profiling
- **Coverage**: 142 TLDs categorized (trusted, standard, suspicious, high-risk)
- **Why 15%**: Expanded database (was 40 TLDs), now covers 95% of signups
- **Examples**:
  - `.tk` (free) → 1.0 risk → contributes 0.15 risk
  - `.com` (paid) → 0.29 risk → contributes 0.04 risk
  - `.edu` (restricted) → 0.11 risk → contributes 0.02 risk

#### Pattern Detection (30%)
- **Purpose**: Detect 5 types of fraudulent patterns
- **Detectors**: Sequential, Dated, Plus-addressing, Keyboard walk, N-gram gibberish
- **Why 30%**: High accuracy (94% avg), low false positives (2-8%)
- **Combines**: Uses MAX of all 5 pattern detector scores
- **Examples**:
  - `user123@` → sequential (0.9) → contributes 0.27 risk
  - `qwerty@` → keyboard (0.95) → contributes 0.285 risk

#### Markov Chain (35%)
- **Purpose**: Statistical character transition analysis
- **Accuracy**: 98% detection rate, <1% false positives
- **Why Highest**: Most accurate detector, research-backed (Bergholz et al. 2008)
- **Training**: Learns from legitimate and fraudulent email patterns
- **Examples**: Detects subtle fraud patterns that rule-based systems miss

---

## Scoring Strategy

### Three-Step Calculation

```typescript
// Step 1: Domain-Based Risk (Additive)
// These signals are independent - a domain can be both disposable AND high-risk TLD
const domainRisk = domainReputationScore * 0.15;  // 0.0 - 0.15
const tldRisk = tldRiskScore * 0.15;              // 0.0 - 0.15
const domainBasedRisk = domainRisk + tldRisk;     // 0.0 - 0.30

// Step 2: Local Part Risk (Max-Based)
// These signals overlap - same pattern detected multiple ways
const entropyRisk = entropyScore * 0.05;           // 0.0 - 0.05
const patternRisk = patternScore * 0.30;           // 0.0 - 0.30
const markovRisk = markovScore * 0.35;             // 0.0 - 0.35
const localPartRisk = Math.max(entropyRisk, patternRisk, markovRisk);  // 0.0 - 0.35

// Step 3: Combine & Clamp
const riskScore = Math.min(domainBasedRisk + localPartRisk, 1.0);  // 0.0 - 1.0
```

### Why Max for Local Part?

Pattern detectors and Markov chains analyze the **same data** (local part of email):
- Pattern detector checks for rules: "ends with number", "keyboard walk"
- Markov chain checks for statistics: "character transitions are fraudulent"

Both can detect `user123@` as fraud, so we take the **maximum** to avoid double-counting.

### Why Additive for Domain?

Domain signals check **different properties**:
- Domain reputation checks: "is this a known disposable service?"
- TLD risk checks: "is this TLD frequently abused?"

A domain can be BOTH (e.g., `user@tempmail.tk`), so we **add** both risks.

---

## Special Cases

### 1. Invalid Email Format

```typescript
if (!formatValid) {
  riskScore = 0.8;
  blockReason = 'invalid_format';
}
```

**Rationale**: Invalid format is strong fraud signal (80% risk), but not 100% because some users genuinely make typos.

### 2. Disposable Domain

```typescript
if (isDisposableDomain) {
  riskScore = 0.95;
  blockReason = 'disposable_domain';
}
```

**Rationale**: Known disposable domains (from 71,751-domain list) are almost always fraud (95% confidence). Bypasses normal scoring to ensure these are blocked.

### 3. High Entropy (Legacy)

```typescript
if (entropyScore > 0.7) {
  riskScore = entropyScore;  // 0.7 - 1.0
  blockReason = 'high_entropy';
}
```

**Rationale**: Extreme randomness (>70% entropy) is strong fraud signal. This is a fast-path check before running all detectors.

### Priority Order

```typescript
// Checks happen in this order:
1. Invalid format (0.8)          ← Fast rejection
2. Disposable domain (0.95)      ← Fast rejection
3. High entropy (0.7+)           ← Fast rejection
4. Normal scoring (0.0 - 1.0)    ← Full analysis
```

---

## Decision Thresholds

### Default Thresholds

```typescript
riskThresholds: {
  block: 0.6,   // 60%+ risk
  warn:  0.3,   // 30-59% risk
}
// allow: < 30% risk
```

### Decision Logic

```typescript
if (riskScore >= 0.6) {
  decision = 'block';    // High risk - reject signup
  httpStatus = 400;
} else if (riskScore >= 0.3) {
  decision = 'warn';     // Medium risk - flag for review
  httpStatus = 200;
} else {
  decision = 'allow';    // Low risk - proceed normally
  httpStatus = 200;
}
```

### Threshold Profiles

**Conservative** (minimize false positives):
```typescript
{ block: 0.8, warn: 0.5 }
// Fewer blocks, more warnings
// Lower detection rate (~85%)
// Higher user satisfaction
```

**Balanced** (default):
```typescript
{ block: 0.6, warn: 0.3 }
// Good balance
// ~95% detection rate
// ~5% false positive rate
```

**Aggressive** (maximize detection):
```typescript
{ block: 0.5, warn: 0.2 }
// More blocks, fewer warnings
// Higher detection rate (~98%)
// More false positives (~10%)
```

---

## Examples

### Example 1: Legitimate Email

```
Email: person1.person2@gmail.com

Signals:
  formatValid: true
  entropyScore: 0.42
  isDisposable: false
  domainReputationScore: 0.0  (gmail is whitelisted)
  tldRiskScore: 0.29          (.com is standard)
  patternScore: 0.0           (no patterns detected)
  markovScore: 0.12           (legitimate transitions)

Calculation:
  Domain Risk:
    domainRisk = 0.0 * 0.15 = 0.000
    tldRisk = 0.29 * 0.15 = 0.044
    domainBasedRisk = 0.000 + 0.044 = 0.044

  Local Part Risk:
    entropyRisk = 0.42 * 0.05 = 0.021
    patternRisk = 0.0 * 0.30 = 0.000
    markovRisk = 0.12 * 0.35 = 0.042
    localPartRisk = max(0.021, 0.000, 0.042) = 0.042

  Final Risk:
    riskScore = 0.044 + 0.042 = 0.086

Decision: ALLOW (0.086 < 0.3)
```

### Example 2: Sequential Pattern

```
Email: user123@outlook.com

Signals:
  formatValid: true
  entropyScore: 0.35
  isDisposable: false
  domainReputationScore: 0.0  (outlook is whitelisted)
  tldRiskScore: 0.29          (.com is standard)
  patternScore: 0.85          (sequential pattern detected)
  markovScore: 0.78           (fraudulent transitions)

Calculation:
  Domain Risk:
    domainRisk = 0.0 * 0.15 = 0.000
    tldRisk = 0.29 * 0.15 = 0.044
    domainBasedRisk = 0.000 + 0.044 = 0.044

  Local Part Risk:
    entropyRisk = 0.35 * 0.05 = 0.018
    patternRisk = 0.85 * 0.30 = 0.255
    markovRisk = 0.78 * 0.35 = 0.273
    localPartRisk = max(0.018, 0.255, 0.273) = 0.273

  Final Risk:
    riskScore = 0.044 + 0.273 = 0.317

Decision: WARN (0.3 <= 0.317 < 0.6)
Reason: markov_chain_fraud (highest contributor)
```

### Example 3: High-Risk TLD + Pattern

```
Email: user999@spam.tk

Signals:
  formatValid: true
  entropyScore: 0.38
  isDisposable: false
  domainReputationScore: 0.5  (suspicious domain)
  tldRiskScore: 1.0           (.tk is free/high-risk)
  patternScore: 0.95          (sequential pattern)
  markovScore: 0.92           (fraudulent transitions)

Calculation:
  Domain Risk:
    domainRisk = 0.5 * 0.15 = 0.075
    tldRisk = 1.0 * 0.15 = 0.150
    domainBasedRisk = 0.075 + 0.150 = 0.225

  Local Part Risk:
    entropyRisk = 0.38 * 0.05 = 0.019
    patternRisk = 0.95 * 0.30 = 0.285
    markovRisk = 0.92 * 0.35 = 0.322
    localPartRisk = max(0.019, 0.285, 0.322) = 0.322

  Final Risk:
    riskScore = 0.225 + 0.322 = 0.547

Decision: WARN (0.3 <= 0.547 < 0.6)
Reason: markov_chain_fraud
Note: Very close to block threshold (0.6)
```

### Example 4: Disposable Domain

```
Email: test@tempmail.com

Special Case: Disposable domain detected
  riskScore = 0.95 (automatic)

Decision: BLOCK (0.95 >= 0.6)
Reason: disposable_domain
Note: Bypasses normal scoring
```

### Example 5: Random Gibberish

```
Email: xk9m2qw7r4p@example.com

Signals:
  formatValid: true
  entropyScore: 0.89
  isDisposable: false
  domainReputationScore: 0.0
  tldRiskScore: 0.29          (.com)
  patternScore: 0.92          (gibberish detected)
  markovScore: 0.95           (fraudulent transitions)

Calculation:
  Domain Risk:
    domainRisk = 0.0 * 0.15 = 0.000
    tldRisk = 0.29 * 0.15 = 0.044
    domainBasedRisk = 0.000 + 0.044 = 0.044

  Local Part Risk:
    entropyRisk = 0.89 * 0.05 = 0.045
    patternRisk = 0.92 * 0.30 = 0.276
    markovRisk = 0.95 * 0.35 = 0.333
    localPartRisk = max(0.045, 0.276, 0.333) = 0.333

  Final Risk:
    riskScore = 0.044 + 0.333 = 0.377

Decision: WARN (0.3 <= 0.377 < 0.6)
Reason: markov_chain_fraud

Note: May become BLOCK if entropy check happens first:
  if (entropyScore > 0.7) {
    riskScore = 0.89;  // Uses entropy directly
    decision = BLOCK;
  }
```

### Example 6: Keyboard Walk + Free TLD

```
Email: qwerty123@freemail.tk

Signals:
  formatValid: true
  entropyScore: 0.45
  isDisposable: false
  domainReputationScore: 0.3  (unknown domain)
  tldRiskScore: 1.0           (.tk is free/high-risk)
  patternScore: 0.95          (keyboard walk + sequential)
  markovScore: 0.88           (fraudulent transitions)

Calculation:
  Domain Risk:
    domainRisk = 0.3 * 0.15 = 0.045
    tldRisk = 1.0 * 0.15 = 0.150
    domainBasedRisk = 0.045 + 0.150 = 0.195

  Local Part Risk:
    entropyRisk = 0.45 * 0.05 = 0.023
    patternRisk = 0.95 * 0.30 = 0.285
    markovRisk = 0.88 * 0.35 = 0.308
    localPartRisk = max(0.023, 0.285, 0.308) = 0.308

  Final Risk:
    riskScore = 0.195 + 0.308 = 0.503

Decision: WARN (0.3 <= 0.503 < 0.6)
Reason: markov_chain_fraud
Note: Close to block threshold
```

---

## Tuning Guide

### When to Adjust Weights

**Increase Markov Weight** (current: 35%):
- When: Markov models are well-trained with production data
- Why: Highest accuracy detector (98%)
- Max: 0.40 (keep pattern detection significant)

**Increase Pattern Weight** (current: 30%):
- When: Seeing sophisticated attacks that avoid Markov detection
- Why: Rule-based patterns catch edge cases
- Max: 0.35 (don't exceed Markov)

**Increase Domain Weights** (current: 15% each):
- When: Seeing attacks from disposable services or free TLDs
- Why: Strong independent signals
- Max: 0.20 each (don't exceed local part signals)

**Decrease Entropy Weight** (current: 5%):
- When: High false positives on legitimate random usernames
- Why: Least accurate signal
- Min: 0.03 (keep as baseline floor)

### Weight Constraints

```typescript
// Must satisfy:
entropy + domainReputation + tldRisk + patternDetection + markovChain = 1.0

// Recommended ranges:
entropy:          0.03 - 0.10
domainReputation: 0.10 - 0.20
tldRisk:          0.10 - 0.20
patternDetection: 0.25 - 0.35
markovChain:      0.30 - 0.40
```

### Threshold Tuning

**Lower Block Threshold** (current: 0.6):
- When: Missing too many fraudulent signups
- Effect: More blocks, higher detection rate
- Trade-off: More false positives
- Recommended: 0.5 - 0.6

**Raise Block Threshold** (current: 0.6):
- When: Blocking legitimate users
- Effect: Fewer blocks, lower detection rate
- Trade-off: More fraud gets through
- Recommended: 0.6 - 0.8

**Adjust Warn Threshold** (current: 0.3):
- When: Too many/few warnings
- Effect: Changes warn bucket size
- Recommended: Keep block - warn gap at 0.3 minimum

### A/B Testing

Use the built-in A/B testing system to test weight changes:

```bash
# Create experiment with new weights
npm run cli ab:create \
  --experiment-id "weight-test-001" \
  --description "Test markov weight increase" \
  --control-traffic 50 \
  --variant-config '{
    "riskWeights": {
      "entropy": 0.05,
      "domainReputation": 0.15,
      "tldRisk": 0.15,
      "patternDetection": 0.25,
      "markovChain": 0.40
    }
  }'

# Monitor results
npm run cli ab:analyze --experiment-id "weight-test-001" --hours 24

# Stop experiment if successful
npm run cli ab:stop
```

### Update Configuration

```bash
# Update weights via Admin API
curl -X PUT https://your-worker.workers.dev/admin/config \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "riskWeights": {
      "entropy": 0.05,
      "domainReputation": 0.15,
      "tldRisk": 0.15,
      "patternDetection": 0.30,
      "markovChain": 0.35
    }
  }'

# Verify configuration
curl https://your-worker.workers.dev/admin/config \
  -H "X-API-Key: $ADMIN_API_KEY"
```

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [DETECTORS.md](./DETECTORS.md) - Detailed detector documentation
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration management
- [API.md](./API.md) - API reference and examples
