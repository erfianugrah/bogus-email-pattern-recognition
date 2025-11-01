# 🎯 Fraudulent Email Testing System

**Generate and test realistic fraudulent email patterns with legitimate domains**

---

## 🚀 Quick Start

```bash
# 1. Generate 200 fraudulent emails
node generate-fraudulent-emails.js 200

# 2. Start dev server (Terminal 1)
npm run dev

# 3. Test detection (Terminal 2)
node test-fraudulent-emails.js
```

**Result**: Comprehensive detection statistics with pattern analysis

---

## 📦 What's Included

### 1. **Fraudulent Email Generator** (`generate-fraudulent-emails.js`)

Generates realistic fraud patterns using legitimate domains:

**11 Fraud Pattern Types**:
- Sequential (user1, user2, user3)
- Sequential Padded (test001, test002, test003)
- Dated Patterns (john.2025, user_2025)
- Plus-Addressing (user+1, user+2)
- Keyboard Walks (qwerty, asdfgh, 123456)
- Gibberish (xk9m2qw7r4p3)
- Name Sequential (john.smith1, john.smith2)
- Variations (user_1, user.2, user-3)
- Letter Sequential (user_a, user_b, user_c)
- Combination Patterns (multiple signals)
- Plus-Addressing with Tags (user+spam1, user+test2)

**Legitimate Domains Used**:
- Free: gmail.com, yahoo.com, outlook.com, hotmail.com, protonmail.com
- Enterprise: company.com, business.com, enterprise.com
- International: gmx.de, web.de, yandex.com, qq.com

**Output Files**:
- `fraudulent-emails.json` - Structured data with pattern metadata
- `fraudulent-emails.csv` - CSV format with consumer/flow fields

### 2. **Detection Tester** (`test-fraudulent-emails.js`)

Tests all generated emails against your validation API:

**Provides**:
- Overall detection rate (warn + block %)
- Pattern-specific detection rates
- Signal analysis (which detectors triggered)
- Failed detections (false negatives)
- Successful detections (true positives)
- Tuning recommendations

### 3. **Manual API Tester** (`test-api.js`)

Quick script to test individual scenarios manually:

**Features**:
- 31 pre-configured test cases
- Your specific payload format (email, consumer, flow)
- Real-time decision display
- Signal detection feedback

### 4. **Comprehensive Test Suite** (`tests/integration/comprehensive-validation.test.ts`)

**105 automated tests** covering:
- Legitimate emails
- Free providers
- Disposable domains
- All 11 fraud patterns
- Invalid formats
- TLD risk scenarios
- Batch attack simulations
- Performance validation

---

## 📊 Example Output

### Generator Output

```bash
$ node generate-fraudulent-emails.js 200

🎯 Generating 200 fraudulent emails with legitimate domains...

📧 Sample Emails (20 of 200):
================================================================================
 1. user1@company.com                        [sequential]
 2. person1.person2@gmail.com                      [dated]
 3. test+1@yahoo.com                         [plus_addressing]
 4. qwerty@example.com                       [keyboard_walk]
 5. xk9m2qw7r4p3@business.com                [gibberish]
...

📊 Pattern Distribution:
  sequential                20 (10.0%)
  dated                     19 (9.5%)
  plus_addressing           20 (10.0%)
  keyboard_walk             19 (9.5%)
  gibberish                 17 (8.5%)
  ...

✅ Exported 200 emails to fraudulent-emails.json
✅ Exported 200 emails to fraudulent-emails.csv
```

### Test Output

```bash
$ node test-fraudulent-emails.js

🧪 Testing Fraudulent Email Detection
================================================================================
📧 Total emails: 200
🌐 Endpoint: http://localhost:8787/validate
================================================================================

⏳ Progress: 20/200 (10%)
⏳ Progress: 40/200 (20%)
...

================================================================================
📊 OVERALL RESULTS
================================================================================

Decision Distribution:
  ✅ Allow: 28 (14.0%)
  ⚠️  Warn:  89 (44.5%)
  ❌ Block: 83 (41.5%)

🎯 Detection Rate: 86.0% (Warn + Block)
🎯 Block Rate: 41.5%

================================================================================
📋 DETECTION BY PATTERN
================================================================================

Pattern                    Total   Allow   Warn   Block   Detection
--------------------------------------------------------------------------------
gibberish                     17       0      2     15     100.0% ✅
plus_addressing               20       1      8     11      95.0% ✅
keyboard_walk                 19       1      7     11      94.7% ✅
sequential_padded             18       1      9      8      94.4% ✅
sequential                    18       2      8      8      88.9% ✅
dated                         19       3      9      7      84.2% ✅
...
```

---

## 🎯 Usage Scenarios

### Scenario 1: Initial System Testing

**Goal**: Verify detection algorithms are working

```bash
# Generate small dataset
node generate-fraudulent-emails.js 50

# Test detection
node test-fraudulent-emails.js
```

**Expected**: 80%+ detection rate

### Scenario 2: Threshold Tuning

**Goal**: Optimize block/warn thresholds

```bash
# Generate test set
node generate-fraudulent-emails.js 200

# Test with current settings
node test-fraudulent-emails.js

# Edit wrangler.jsonc - adjust thresholds
# RISK_THRESHOLD_BLOCK: 0.6 → 0.55
# RISK_THRESHOLD_WARN: 0.3 → 0.25

# Restart dev server and retest
npm run dev
node test-fraudulent-emails.js
```

**Compare**: Detection rates before/after

### Scenario 3: Pattern-Specific Testing

**Goal**: Test specific fraud pattern detection

```bash
# Modify generate-fraudulent-emails.js
# Comment out all patterns except one
# Example: Only test gibberish detection

node generate-fraudulent-emails.js 100
node test-fraudulent-emails.js
```

**Analyze**: Detection rate for that specific pattern

### Scenario 4: Batch Attack Simulation

**Goal**: Test Benford's Law batch detection

```bash
# Generate large sequential batch
node generate-fraudulent-emails.js 500

# Test detection
node test-fraudulent-emails.js
```

**Expected**: Benford's Law should trigger for large batches

### Scenario 5: Production Validation

**Goal**: Test before deploying to production

```bash
# Generate comprehensive test set
node generate-fraudulent-emails.js 1000

# Test detection
node test-fraudulent-emails.js

# Review results
# - Detection rate > 80%?
# - False positive rate acceptable?
# - All patterns detected?
```

**Deploy**: If all checks pass

---

## 📈 Expected Performance

### Detection Rate Targets

| Pattern Type | Target | Acceptable |
|--------------|--------|------------|
| Gibberish | 95%+ | 90%+ |
| Plus-Addressing | 95%+ | 90%+ |
| Keyboard Walk | 95%+ | 90%+ |
| Sequential | 90%+ | 80%+ |
| Sequential Padded | 90%+ | 80%+ |
| Dated | 85%+ | 75%+ |
| Combination | 95%+ | 90%+ |
| Name Sequential | 75%+ | 60%+ |
| Variations | 80%+ | 70%+ |
| Letter Sequential | 70%+ | 60%+ |

**Overall Target**: 80-85% detection rate

### Why Some Patterns Are Harder

**Name Sequential** (john.smith1, john.smith2):
- Looks more legitimate
- Real names used
- Lower entropy
- Requires pattern correlation

**Letter Sequential** (user_a, user_b):
- Less obvious pattern
- Requires pattern recognition
- May look like legitimate variations

**Variations** (user_1, user.2):
- Common in legitimate contexts
- Separators used normally
- Context-dependent

---

## 🔧 Customization

### Add Your Own Pattern

Edit `generate-fraudulent-emails.js`:

```javascript
// Add new pattern generator
function generateMyCustomPattern(count = 10) {
  const emails = [];
  const domain = random(legitimateDomains);

  for (let i = 0; i < count; i++) {
    // Your custom logic
    emails.push({
      email: `custom${i}@${domain}`,
      pattern: 'custom_pattern',
      domain: domain,
    });
  }

  return emails;
}

// Add to main generator (line ~350)
allEmails.push(...generateMyCustomPattern(perPattern));
```

### Add Custom Domain

```javascript
// Add to legitimateDomains array (line ~10)
const legitimateDomains = [
  'yourcompany.com',
  'yourbusiness.com',
  // ... existing domains
];
```

### Change Consumer/Flow Distribution

Edit `exportAsCSV` function (line ~370):

```javascript
const consumer = random(['OWF']); // Only OWF
const flow = random(['SIGNUP_EMAIL_VERIFY']); // Only signup
```

---

## 🐛 Troubleshooting

### Issue: Low Detection Rate (< 60%)

**Possible Causes**:
1. Thresholds too high
2. Pattern detection disabled
3. Phase 6A not deployed

**Solutions**:
```bash
# Check configuration
cat wrangler.jsonc | grep -A 5 "vars"

# Verify settings:
# ENABLE_PATTERN_CHECK: "true"
# RISK_THRESHOLD_BLOCK: "0.6"
# RISK_THRESHOLD_WARN: "0.3"

# Restart dev server
npm run dev

# Retest
node test-fraudulent-emails.js
```

### Issue: High False Positives (Production)

**Symptoms**: Legitimate users being blocked

**Solutions**:
1. Increase thresholds (0.6 → 0.7)
2. Review blocked patterns
3. Test with real user emails first
4. Use warn-only mode initially

### Issue: Generator Errors

**Error**: `Cannot find module`

**Solution**:
```bash
# Install dependencies
npm install

# Retry
node generate-fraudulent-emails.js 200
```

### Issue: API Connection Failed

**Error**: `fetch failed` or `ECONNREFUSED`

**Solution**:
```bash
# Ensure dev server is running
npm run dev

# In another terminal, retry test
node test-fraudulent-emails.js
```

---

## 📚 Documentation

### Related Documentation
- **[Test Results](TEST_RESULTS.md)** - 97.0% detection rate on 1000 emails
- **[Test Suite Overview](TEST_SUITE_OVERVIEW.md)** - Complete test documentation
- **[Getting Started](../GETTING_STARTED.md)** - Setup and configuration
- **[Architecture](../ARCHITECTURE.md)** - Detection algorithms
- **[API Reference](../API.md)** - API documentation

---

## 🎓 Real-World Datasets

### Public Fraud Email Datasets

1. **Enron Email Dataset**
   - URL: https://www.cs.cmu.edu/~enron/
   - Size: 500,000+ emails
   - Contains: Spam patterns
   - Use: Extract fraud patterns

2. **SpamAssassin Public Corpus**
   - URL: https://spamassassin.apache.org/old/publiccorpus/
   - Size: Thousands of spam emails
   - Format: mbox format
   - Use: Email address patterns

3. **Kaggle Email Spam Datasets**
   - Search: "email spam dataset" on Kaggle
   - Various datasets available
   - Use: Training data extraction

4. **TREC Spam Corpus**
   - URL: https://trec.nist.gov/data/spam.html
   - Academic dataset
   - Large-scale spam collection

### Extracting Patterns from Real Data

```bash
# Example: Extract emails from dataset
grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}' dataset.txt > extracted-emails.txt

# Analyze patterns
grep -E 'user[0-9]+@' extracted-emails.txt  # Sequential
grep -E '\+[0-9]+@' extracted-emails.txt     # Plus-addressing
```

---

## 🔐 Security & Privacy

### Data Generation

- **No Real Emails**: All generated emails are synthetic
- **Legitimate Domains**: Uses real domain names but fake local parts
- **No PII**: No personally identifiable information

### Testing

- **Local Only**: All tests run locally
- **No Data Upload**: Data never leaves your system
- **Hashed Storage**: Emails hashed before logging (if enabled)

### Production Use

- **Hash Emails**: Always hash before long-term storage
- **GDPR Compliant**: No PII stored
- **Audit Logs**: Track detection decisions only

---

## 📊 Success Metrics

### Key Performance Indicators

| Metric | Target | Excellent | Good | Needs Improvement |
|--------|--------|-----------|------|-------------------|
| **Overall Detection** | 80%+ | 85%+ | 75-85% | <75% |
| **Block Rate** | 35-45% | 40-50% | 30-40% | <30% or >50% |
| **Warn Rate** | 35-45% | 40-50% | 30-40% | <30% or >50% |
| **False Negatives** | <20% | <15% | 15-25% | >25% |

### Pattern-Specific KPIs

- **High-Risk Patterns** (gibberish, keyboard walks): 95%+ detection
- **Medium-Risk Patterns** (sequential, dated): 85%+ detection
- **Complex Patterns** (name sequential, variations): 70%+ detection

---

## 🚀 Next Steps

1. **✅ Generate Test Data**
   ```bash
   node generate-fraudulent-emails.js 200
   ```

2. **✅ Test Detection**
   ```bash
   npm run dev
   node test-fraudulent-emails.js
   ```

3. **✅ Analyze Results**
   - Review detection rates
   - Check pattern performance
   - Identify weak spots

4. **✅ Tune System**
   - Adjust thresholds if needed
   - Review false negatives
   - Test again

5. **✅ Deploy with Confidence**
   ```bash
   npm run deploy
   ```

---

## 💡 Tips

- Start with 50-100 emails for quick testing
- Increase to 500+ for comprehensive validation
- Test pattern-by-pattern for deep analysis
- Compare before/after when making changes
- Document patterns you discover in production
- Regular testing (weekly/monthly) recommended

---

**Ready to test?** Run `node generate-fraudulent-emails.js 200` to begin!
