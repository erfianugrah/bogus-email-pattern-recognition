# Bogus Email Pattern Recognition API

## Overview

This API provides inline email validation to prevent fake account signups by analyzing email patterns, entropy, and user fingerprints.

**Base URL:** `https://your-worker.workers.dev` (or your custom domain)

## Features

- RFC 5322 email format validation
- Shannon entropy analysis for random string detection
- Advanced fingerprinting (IP + JA4 + ASN + Bot Score)
- Configurable risk thresholds
- Structured JSON logging (Pino)
- Analytics Engine metrics collection
- Sub-100ms latency (p95)

## Authentication

Currently, this API is open (no authentication required). For production use, consider adding:
- API key authentication
- Rate limiting per API key
- IP whitelisting

## Endpoints

### POST /validate

Validate an email address and return risk assessment.

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response (200 OK - Valid):**

```json
{
  "valid": true,
  "riskScore": 0.15,
  "signals": {
    "formatValid": true,
    "entropyScore": 0.42,
    "localPartLength": 8
  },
  "decision": "allow",
  "message": "Email validation completed",
  "fingerprint": {
    "hash": "7426dc6e4bb50d6d91948b76c024ff090553b2655a724d03f7009a33ac53d0e5",
    "country": "NL",
    "asn": 1136,
    "botScore": 99
  },
  "latency_ms": 0
}
```

**Response (400 Bad Request - Invalid):**

```json
{
  "valid": false,
  "riskScore": 0.8,
  "signals": {
    "formatValid": false,
    "entropyScore": 0,
    "localPartLength": 0
  },
  "decision": "block",
  "message": "Invalid email format",
  "fingerprint": {
    "hash": "abc123...",
    "country": "US",
    "asn": 15169,
    "botScore": 50
  },
  "latency_ms": 1
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `valid` | boolean | Whether the email passed validation |
| `riskScore` | number | Risk score from 0.0 (safe) to 1.0 (dangerous) |
| `signals` | object | Individual validation signals |
| `signals.formatValid` | boolean | RFC 5322 format compliance |
| `signals.entropyScore` | number | Shannon entropy (0-1, higher = more random) |
| `signals.localPartLength` | number | Length of local part (before @) |
| `decision` | string | `allow`, `warn`, or `block` |
| `message` | string | Human-readable result message |
| `fingerprint` | object | User fingerprint data |
| `fingerprint.hash` | string | SHA-256 hash of composite fingerprint |
| `fingerprint.country` | string | ISO 3166-1 alpha-2 country code |
| `fingerprint.asn` | number | Autonomous System Number |
| `fingerprint.botScore` | number | Cloudflare bot score (1-99, higher = more likely human) |
| `latency_ms` | number | Processing time in milliseconds |

#### Decision Logic

- **allow** (`riskScore < 0.3`): Low risk, safe to proceed
- **warn** (`0.3 ≤ riskScore < 0.6`): Medium risk, log for review
- **block** (`riskScore ≥ 0.6`): High risk, reject signup

#### Risk Score Calculation

The risk score is calculated from multiple signals:

```typescript
riskScore = 0.0

if (!formatValid) {
  riskScore = 0.8  // Invalid format
} else if (entropyScore > 0.7) {
  riskScore = entropyScore  // High randomness
} else if (localPartLength < 3) {
  riskScore = 0.8  // Too short
} else {
  riskScore = entropyScore * 0.5  // Normal risk
}
```

### GET /debug

Get all available request signals and fingerprint data (for testing/debugging).

**Response (200 OK):**

```json
{
  "fingerprint": {
    "hash": "7426dc6e4bb50d6d91948b76c024ff090553b2655a724d03f7009a33ac53d0e5",
    "ip": "127.0.0.1",
    "ja4": "t13d3012h2_1d37bd780c83_882d495ac381",
    "ja3": "db8a6f4f9f8195ea17db377175d2cb08",
    "userAgent": "Mozilla/5.0...",
    "country": "NL",
    "asn": 1136,
    "asOrg": "KPN B.V.",
    "botScore": 99,
    "deviceType": "desktop"
  },
  "allSignals": {
    "ip": "195.240.81.42",
    "userAgent": "Mozilla/5.0...",
    "country": "NL",
    "region": "North Brabant",
    "city": "Vught",
    "timezone": "Europe/Amsterdam",
    "botScore": "99",
    "ja4": "t13d3012h2_1d37bd780c83_882d495ac381",
    "cfData": {
      "asn": 1136,
      "asOrganization": "KPN B.V.",
      "colo": "AMS",
      "httpProtocol": "HTTP/2",
      "tlsVersion": "TLSv1.3",
      "botManagement": {
        "score": 99,
        "ja4Signals": {
          "h2h3_ratio_1h": 0.997,
          "browser_ratio_1h": 0.045,
          "reqs_rank_1h": 246
        }
      }
    }
  }
}
```

### GET /

Get API welcome message and usage instructions.

**Response (200 OK):**

```text
Bogus Email Pattern Recognition API

Endpoints:
- POST /validate { "email": "test@example.com" }
- GET /debug (shows all request signals)

Example:
curl -X POST https://your-worker.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Custom Headers

The API supports custom headers for easier integration with downstream systems, CDN logs, WAFs, and monitoring tools.

### Response Headers (Worker → Client)

When `ENABLE_RESPONSE_HEADERS` is set to `"true"`, the following headers are added to responses:

#### Core Decision Headers

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-Risk-Score` | number | Overall risk score (0.0-1.0) | `0.48` |
| `X-Fraud-Decision` | string | Decision: allow, warn, or block | `warn` |
| `X-Fraud-Reason` | string | Primary reason for the decision | `sequential_pattern` |

#### Fingerprinting Headers

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-Fingerprint-Hash` | string | SHA-256 composite fingerprint | `7426dc6e...` |
| `X-Bot-Score` | number | Bot detection score (0-100) | `99` |
| `X-Country` | string | ISO 3166-1 alpha-2 country code | `US` |

#### Performance Headers

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-Detection-Latency-Ms` | number | Processing time in milliseconds | `3` |

#### Pattern Detection Headers (when applicable)

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-Pattern-Type` | string | Detected pattern type | `sequential`, `dated`, `random` |
| `X-Pattern-Confidence` | number | Pattern confidence (0.0-1.0) | `0.85` |
| `X-Has-Gibberish` | boolean | Gibberish detected (only if true) | `true` |

**Example Response with Headers:**

```bash
curl -i -X POST http://localhost:8787/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"user123@outlook.com"}'
```

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Risk-Score: 0.48
X-Fraud-Decision: warn
X-Fraud-Reason: dated_pattern
X-Fingerprint-Hash: 7426dc6e4bb50d6d91948b76c024ff090553b2655a724d03f7009a33ac53d0e5
X-Bot-Score: 99
X-Country: NL
X-Detection-Latency-Ms: 3
X-Pattern-Type: dated
X-Pattern-Confidence: 0.60
```

### Origin Request Headers (Worker → Backend)

When `ENABLE_ORIGIN_HEADERS` is set to `"true"` and `ORIGIN_URL` is configured, the Worker forwards validation requests to your backend with enriched fraud detection headers.

#### Configuration

```jsonc
{
  "vars": {
    "ENABLE_ORIGIN_HEADERS": "true",
    "ORIGIN_URL": "https://api.yourbackend.com/fraud-check"
  }
}
```

#### Headers Sent to Origin

All original request headers are preserved, plus the following fraud detection headers:

| Header | Type | Description | Example |
|--------|------|-------------|---------|
| `X-Fraud-Risk-Score` | number | Overall risk score | `0.48` |
| `X-Fraud-Decision` | string | allow, warn, or block | `warn` |
| `X-Fraud-Reason` | string | Primary fraud indicator | `sequential_pattern` |
| `X-Fraud-Fingerprint` | string | SHA-256 fingerprint hash | `7426dc6e...` |
| `X-Fraud-Bot-Score` | number | Bot detection score | `99` |
| `X-Fraud-Country` | string | User's country code | `US` |
| `X-Fraud-ASN` | number | Autonomous System Number | `15169` |
| `X-Fraud-Pattern-Type` | string | Detected pattern type | `sequential` |
| `X-Fraud-Pattern-Confidence` | number | Pattern confidence | `0.85` |
| `X-Fraud-Has-Gibberish` | boolean | Gibberish detected | `true` |

**Note:** Origin forwarding is fire-and-forget (non-blocking). The Worker responds to the client immediately while forwarding to your backend asynchronously.

### Use Cases

#### 1. CDN/Edge Logs
Headers are visible in Cloudflare Analytics, access logs, and edge compute logs without parsing JSON bodies.

```
# Cloudflare Analytics query
SELECT
  http.request.headers['x-risk-score'] as risk_score,
  http.request.headers['x-fraud-decision'] as decision,
  COUNT(*) as requests
FROM cloudflare_logs
GROUP BY risk_score, decision
```

#### 2. WAF Rules
Trigger Web Application Firewall rules based on header values:

```
# Block high-risk requests at the edge
(http.request.headers["x-risk-score"] gt 0.8) then block
```

#### 3. Reverse Proxy Integration
nginx, Apache, or other proxies can log and act on headers:

```nginx
# nginx configuration
location /signup {
  if ($http_x_fraud_decision = "block") {
    return 403;
  }
  proxy_pass http://backend;
  # Pass fraud headers to backend
  proxy_set_header X-Fraud-Risk-Score $http_x_fraud_risk_score;
}
```

#### 4. Backend Processing
Your backend receives enriched fraud signals without additional API calls:

```javascript
// Express.js backend
app.post('/signup', (req, res) => {
  const riskScore = parseFloat(req.headers['x-fraud-risk-score']);
  const decision = req.headers['x-fraud-decision'];

  if (decision === 'block') {
    return res.status(403).json({ error: 'Signup blocked' });
  }

  if (decision === 'warn') {
    // Require additional verification
    await sendVerificationEmail(req.body.email);
  }

  // Continue with signup...
});
```

#### 5. SIEM Integration
Security Information and Event Management systems can ingest headers from logs:

```
# Splunk query
index=web sourcetype=access_combined
| eval risk_score=mvindex(split(http_headers, "X-Risk-Score: "), 1)
| where risk_score > 0.6
```

### Configuration Examples

**Enable response headers only:**
```jsonc
{
  "vars": {
    "ENABLE_RESPONSE_HEADERS": "true",
    "ENABLE_ORIGIN_HEADERS": "false"
  }
}
```

**Enable origin forwarding:**
```jsonc
{
  "vars": {
    "ENABLE_RESPONSE_HEADERS": "true",
    "ENABLE_ORIGIN_HEADERS": "true",
    "ORIGIN_URL": "https://api.yourbackend.com/fraud-check"
  }
}
```

**Disable all custom headers:**
```jsonc
{
  "vars": {
    "ENABLE_RESPONSE_HEADERS": "false",
    "ENABLE_ORIGIN_HEADERS": "false"
  }
}
```

## Configuration

Environment variables can be set in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    // Risk Thresholds
    "RISK_THRESHOLD_BLOCK": "0.6",      // Block above this score
    "RISK_THRESHOLD_WARN": "0.3",       // Warn above this score

    // Feature Toggles
    "ENABLE_MX_CHECK": "false",          // Enable MX record validation
    "ENABLE_RATE_LIMIT": "false",        // Enable rate limiting
    "ENABLE_DISPOSABLE_CHECK": "true",   // Enable disposable domain checking
    "ENABLE_PATTERN_CHECK": "true",      // Enable pattern detection

    // Custom Headers
    "ENABLE_RESPONSE_HEADERS": "true",   // Add fraud headers to responses
    "ENABLE_ORIGIN_HEADERS": "false",    // Forward fraud headers to origin
    "ORIGIN_URL": "",                    // Backend URL for origin forwarding

    // Rate Limiting (if enabled)
    "MAX_ATTEMPTS_PER_HOUR": "5",        // Max validations per hour per fingerprint
    "MAX_ATTEMPTS_PER_DAY": "20",        // Max validations per day per fingerprint

    // Logging
    "LOG_ALL_VALIDATIONS": "true",       // Log every validation
    "LOG_LEVEL": "info"                  // Logging level (info, warn, error)
  }
}
```

## Examples

### cURL

```bash
# Validate a normal email
curl -X POST https://your-worker.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"person1.person2@example.com"}'

# Validate a suspicious email
curl -X POST https://your-worker.dev/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"xk9m2qw7r4p@example.com"}'

# Get debug information
curl https://your-worker.dev/debug
```

### JavaScript/Fetch

```javascript
async function validateEmail(email) {
  const response = await fetch('https://your-worker.dev/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const result = await response.json();

  if (result.decision === 'block') {
    console.error('Email blocked:', result.message);
    return false;
  } else if (result.decision === 'warn') {
    console.warn('Email flagged:', result.riskScore);
    // Log for manual review
  }

  return result.valid;
}

// Usage
const isValid = await validateEmail('test@example.com');
```

### Node.js

```javascript
const axios = require('axios');

async function validateEmail(email) {
  try {
    const response = await axios.post('https://your-worker.dev/validate', {
      email: email
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      return error.response.data;
    }
    throw error;
  }
}

// Usage
validateEmail('test@example.com')
  .then(result => {
    console.log('Validation result:', result);
    if (result.decision === 'block') {
      console.log('⛔ Email blocked');
    }
  });
```

### Python

```python
import requests

def validate_email(email):
    response = requests.post(
        'https://your-worker.dev/validate',
        json={'email': email}
    )

    result = response.json()

    if result['decision'] == 'block':
        print(f"❌ Email blocked: {result['message']}")
        return False
    elif result['decision'] == 'warn':
        print(f"⚠️  Email flagged (risk: {result['riskScore']})")

    return result['valid']

# Usage
is_valid = validate_email('test@example.com')
```

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Validation successful (email may still be invalid) |
| 400 | Bad request (missing email or validation failed) |
| 404 | Endpoint not found |
| 500 | Internal server error |

## Rate Limits

Currently no rate limits enforced at the API level. Consider implementing:
- Per-IP rate limiting
- Per-fingerprint rate limiting
- Per-API-key rate limiting (if authentication is added)

## Observability

### Structured Logging

All validations are logged in structured JSON format:

```json
{
  "level": "info",
  "event": "email_validation",
  "email_hash": "973dfe463ec85785",
  "fingerprint": "7426dc6e...",
  "risk_score": 0.15,
  "decision": "allow",
  "signals": { "formatValid": true, "entropyScore": 0.42 },
  "latency_ms": 2,
  "timestamp": 1698765432100
}
```

Blocked emails are logged at WARNING level:

```json
{
  "level": "warn",
  "event": "email_blocked",
  "email_hash": "8a81c99059a5a2a5",
  "fingerprint": "7426dc6e...",
  "risk_score": 0.85,
  "reason": "high_entropy",
  "timestamp": 1698765432100
}
```

### Analytics Engine

Metrics are written to Cloudflare Analytics Engine for dashboarding:

**Metrics tracked:**
- Decision distribution (allow/warn/block)
- Risk score histogram
- Block reasons breakdown
- Country distribution
- Bot score distribution
- Performance (P50/P95/P99 latency)

**Query examples:**

See `src/utils/metrics.ts` for predefined GraphQL queries for common dashboards.

## Performance

**Target Metrics:**
- P95 latency: < 100ms
- P99 latency: < 150ms
- Availability: > 99.9%

**Actual Performance (Phase 1):**
- Average latency: 0-2ms (basic validation only)
- Format validation: ~0.5ms
- Entropy calculation: ~0.5ms
- Fingerprinting: ~1ms

## Security

**Email Privacy:**
- Email addresses are never logged in plain text
- SHA-256 hashes are used for logging (first 16 chars)
- Hashes are salted per validation

**Fingerprinting:**
- Composite fingerprints use multiple signals
- IP addresses are hashed in logs
- No PII is stored long-term

## Future Enhancements

- Disposable email domain detection
- MX record validation
- Rate limiting per fingerprint
- Keyboard walk pattern detection
- Sequential number detection
- Domain reputation scoring
- Machine learning risk model
- Real-time dashboard

## Support

For issues, feature requests, or contributions:
- GitHub: [Your Repository URL]
- Email: [Your Contact Email]

## License

[Your License]
