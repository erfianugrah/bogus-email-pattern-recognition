# Analytics Dashboard & Queries

Real-time analytics powered by Cloudflare Workers Analytics Engine.

## Overview

The fraud detection worker tracks all validations and stores structured metrics in Analytics Engine. This enables powerful insights into:
- Decision patterns (allow/warn/block)
- Block reasons and trends
- Geographic distribution
- Performance metrics
- Risk score distributions
- Fingerprint activity

## Quick Start

### Using the Web Dashboard

1. **Deploy your worker** with analytics enabled
2. **Access the dashboard** at `https://your-worker.dev/analytics.html`
3. **Enter your Admin API key** (from `ADMIN_API_KEY` secret)
4. **Select a query** or view the default summary

### Using the API

```bash
# Get default summary (last 24 hours)
curl https://your-worker.dev/admin/analytics \
  -H "X-API-Key: your-admin-api-key"

# Get data for last 7 days
curl https://your-worker.dev/admin/analytics?hours=168 \
  -H "X-API-Key: your-admin-api-key"

# Get list of pre-built queries
curl https://your-worker.dev/admin/analytics/queries \
  -H "X-API-Key: your-admin-api-key"

# Run custom SQL query
curl "https://your-worker.dev/admin/analytics?query=$(urlencode 'SELECT...')" \
  -H "X-API-Key: your-admin-api-key"
```

## Column Mapping

Analytics Engine stores data in generic columns. Here's what each column represents:

| Column | Type | Description | Example Values |
|--------|------|-------------|----------------|
| `blob1` | string | Decision | `allow`, `warn`, `block` |
| `blob2` | string | Block Reason | `sequential_pattern`, `gibberish_detected`, `none` |
| `blob3` | string | Country | `US`, `GB`, `unknown` |
| `blob4` | string | Risk Bucket | `0.0-0.2`, `0.2-0.4`, `0.4-0.6`, `0.6-0.8`, `0.8-1.0` |
| `double1` | number | Risk Score | `0.0` to `1.0` |
| `double2` | number | Entropy Score | `0.0` to `1.0` |
| `double3` | number | Bot Score | `0` to `99` (lower = more bot-like) |
| `double4` | number | ASN | `13335` (Cloudflare), `15169` (Google), etc. |
| `double5` | number | Latency (ms) | `0.5` to `50.0` |
| `index1` | string | Fingerprint Hash | First 32 chars of SHA-256 hash |

**Use column aliases in your queries for readability:**

```sql
SELECT
  blob1 as decision,
  blob2 as block_reason,
  double1 as risk_score
FROM ANALYTICS
```

## Pre-built Queries

### 1. Decision Summary

Overview of allow/warn/block decisions.

```sql
SELECT
  blob1 as decision,
  COUNT() as count,
  AVG(double1) as avg_risk_score,
  AVG(double5) as avg_latency_ms
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY decision
ORDER BY count DESC
```

**Use Case:** High-level health check. Are we blocking too many emails? Are latencies acceptable?

**Expected Output:**
```
decision | count | avg_risk_score | avg_latency_ms
---------|-------|----------------|---------------
allow    | 8450  | 0.182          | 1.23
warn     | 1250  | 0.485          | 1.45
block    | 300   | 0.782          | 1.67
```

---

### 2. Top Block Reasons

Most common reasons for blocking emails.

```sql
SELECT
  blob2 as block_reason,
  COUNT() as count,
  AVG(double1) as avg_risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND blob1 = 'block'
  AND blob2 != 'none'
GROUP BY block_reason
ORDER BY count DESC
LIMIT 10
```

**Use Case:** Identify attack patterns. Are we seeing sequential patterns? Disposable domains?

**Expected Output:**
```
block_reason          | count | avg_risk_score
----------------------|-------|---------------
sequential_pattern    | 125   | 0.85
gibberish_detected    | 87    | 0.92
disposable_domain     | 65    | 0.95
plus_addressing_abuse | 23    | 0.78
```

---

### 3. Risk Score Distribution

Distribution of emails by risk bucket.

```sql
SELECT
  blob4 as risk_bucket,
  COUNT() as count,
  AVG(double1) as avg_risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY risk_bucket
ORDER BY risk_bucket
```

**Use Case:** Understand risk distribution. Are most emails low-risk? Do we need to adjust thresholds?

**Expected Output:**
```
risk_bucket | count | avg_risk_score
------------|-------|---------------
0.0-0.2     | 6780  | 0.12
0.2-0.4     | 1820  | 0.31
0.4-0.6     | 890   | 0.52
0.6-0.8     | 410   | 0.71
0.8-1.0     | 100   | 0.89
```

---

### 4. Country Breakdown

Validations by country and decision.

```sql
SELECT
  blob3 as country,
  blob1 as decision,
  COUNT() as count,
  AVG(double1) as avg_risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY country, decision
ORDER BY count DESC
LIMIT 20
```

**Use Case:** Geographic analysis. Which countries have higher fraud rates?

**Expected Output:**
```
country | decision | count | avg_risk_score
--------|----------|-------|---------------
US      | allow    | 3200  | 0.15
GB      | allow    | 1450  | 0.18
US      | warn     | 450   | 0.47
CN      | block    | 320   | 0.82
```

---

### 5. High Risk Emails

Recent high-risk validations (risk score > 0.6).

```sql
SELECT
  blob1 as decision,
  blob2 as block_reason,
  blob3 as country,
  double1 as risk_score,
  double2 as entropy_score,
  timestamp
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND double1 > 0.6
ORDER BY timestamp DESC
LIMIT 100
```

**Use Case:** Investigate recent fraud attempts. Review blocked emails.

**Expected Output:**
```
decision | block_reason       | country | risk_score | entropy_score | timestamp
---------|-------------------|---------|------------|---------------|-------------------
block    | sequential_pattern | US      | 0.85       | 0.42          | 2025-11-01 14:23:45
warn     | plus_addressing   | GB      | 0.68       | 0.35          | 2025-11-01 14:22:10
block    | gibberish_detected| CN      | 0.92       | 0.88          | 2025-11-01 14:20:33
```

---

### 6. Performance Metrics

Latency statistics by decision type.

```sql
SELECT
  blob1 as decision,
  COUNT() as count,
  AVG(double5) as avg_latency_ms,
  quantile(0.5)(double5) as p50_latency_ms,
  quantile(0.95)(double5) as p95_latency_ms,
  quantile(0.99)(double5) as p99_latency_ms
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY decision
```

**Use Case:** Monitor performance. Are validations fast? Any degradation?

**Expected Output:**
```
decision | count | avg | p50  | p95  | p99
---------|-------|-----|------|------|-----
allow    | 8450  | 1.2 | 1.1  | 2.3  | 4.5
warn     | 1250  | 1.5 | 1.3  | 2.8  | 5.2
block    | 300   | 1.7 | 1.5  | 3.1  | 5.8
```

---

### 7. Hourly Timeline

Validations over time by decision.

```sql
SELECT
  toStartOfHour(timestamp) as hour,
  blob1 as decision,
  COUNT() as count,
  AVG(double1) as avg_risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY hour, decision
ORDER BY hour DESC
```

**Use Case:** Identify traffic patterns. When are attacks most common?

**Expected Output:**
```
hour                | decision | count | avg_risk_score
--------------------|----------|-------|---------------
2025-11-01 14:00:00 | allow    | 352   | 0.18
2025-11-01 14:00:00 | warn     | 52    | 0.48
2025-11-01 14:00:00 | block    | 12    | 0.81
2025-11-01 13:00:00 | allow    | 348   | 0.19
...
```

---

### 8. Top Fingerprints

Most active fingerprints (potential automation).

```sql
SELECT
  index1 as fingerprint,
  COUNT() as validation_count,
  AVG(double1) as avg_risk_score,
  blob3 as country
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY fingerprint, country
HAVING validation_count > 10
ORDER BY validation_count DESC
LIMIT 20
```

**Use Case:** Detect automated attacks. Identify high-volume fingerprints.

**Expected Output:**
```
fingerprint                      | validation_count | avg_risk_score | country
---------------------------------|------------------|----------------|--------
3d1852ab4f...                    | 125              | 0.85           | CN
7a3b91cd2e...                    | 87               | 0.72           | US
f4e82dc9a1...                    | 65               | 0.45           | GB
```

---

## Custom Queries

You can run any SQL query supported by Analytics Engine. The query is sent directly to the Analytics Engine SQL API.

### Query Syntax

Analytics Engine supports a SQL-like syntax with these features:

**Supported:**
- `SELECT`, `FROM`, `WHERE`, `GROUP BY`, `ORDER BY`, `HAVING`, `LIMIT`
- Aggregations: `COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`
- Percentiles: `quantile(0.5)()`, `quantile(0.95)()`
- Time functions: `toStartOfHour()`, `toStartOfDay()`, `NOW()`, `INTERVAL`
- Operators: `=`, `!=`, `>`, `<`, `>=`, `<=`, `AND`, `OR`
- String matching: `LIKE`, `IN`

**Not Supported:**
- `JOIN` (single table only)
- Subqueries
- `UPDATE`, `DELETE`, `INSERT`
- Window functions

### Example Custom Queries

#### Find emails from specific ASN

```sql
SELECT
  blob1 as decision,
  blob2 as block_reason,
  double1 as risk_score,
  timestamp
FROM ANALYTICS
WHERE double4 = 13335  -- Cloudflare ASN
  AND timestamp >= NOW() - INTERVAL '24' HOUR
ORDER BY timestamp DESC
LIMIT 100
```

#### Detect bot activity (low bot scores)

```sql
SELECT
  index1 as fingerprint,
  blob3 as country,
  COUNT() as count,
  AVG(double3) as avg_bot_score,
  AVG(double1) as avg_risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND double3 < 30  -- Bot score < 30
GROUP BY fingerprint, country
ORDER BY count DESC
LIMIT 20
```

#### High entropy emails

```sql
SELECT
  blob1 as decision,
  blob2 as block_reason,
  double2 as entropy_score,
  double1 as risk_score
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '24' HOUR
  AND double2 > 0.7  -- High entropy
ORDER BY entropy_score DESC
LIMIT 50
```

#### Hourly block rate

```sql
SELECT
  toStartOfHour(timestamp) as hour,
  COUNT() as total_validations,
  SUM(CASE WHEN blob1 = 'block' THEN 1 ELSE 0 END) as blocks,
  (blocks * 100.0 / total_validations) as block_rate_percent
FROM ANALYTICS
WHERE timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY hour
ORDER BY hour DESC
```

---

## Integration with Monitoring Tools

### Grafana

Use the Cloudflare Analytics Engine data source plugin:

1. Install the [Cloudflare plugin for Grafana](https://grafana.com/grafana/plugins/cloudflare-app/)
2. Configure with your Cloudflare API token
3. Select the `ANALYTICS` dataset
4. Use the SQL queries from this document

### Prometheus

Export metrics using a custom script:

```javascript
// Fetch analytics via API
const response = await fetch('https://your-worker.dev/admin/analytics', {
  headers: { 'X-API-Key': process.env.ADMIN_API_KEY }
});
const data = await response.json();

// Convert to Prometheus format
console.log(`# HELP fraud_validations_total Total email validations`);
console.log(`# TYPE fraud_validations_total counter`);
data.data.forEach(row => {
  console.log(`fraud_validations_total{decision="${row.decision}"} ${row.count}`);
});
```

### Custom Dashboards

Use the `/admin/analytics` API endpoint to build custom dashboards:

```html
<script>
async function loadAnalytics() {
  const response = await fetch('/admin/analytics?hours=24', {
    headers: { 'X-API-Key': 'your-key' }
  });
  const data = await response.json();
  // Render charts, tables, etc.
}
</script>
```

---

## Best Practices

### 1. Use Appropriate Time Ranges

- **Real-time monitoring**: Last 1-6 hours
- **Daily reports**: Last 24 hours
- **Weekly trends**: Last 7 days (168 hours)
- **Avoid very long ranges**: Analytics Engine has retention limits

### 2. Optimize Queries

- **Use WHERE filters** to reduce data scanned
- **Limit results** with `LIMIT` clause
- **Aggregate when possible** instead of fetching raw rows
- **Cache results** for frequently-run queries

### 3. Monitor Key Metrics

Essential metrics to track:
- **Block rate**: `blocks / total_validations`
- **Average risk score**: Trending up = more attacks
- **P95 latency**: Should stay under 5ms
- **Top block reasons**: Identify attack patterns
- **Geographic distribution**: Unusual countries?

### 4. Set Up Alerts

Create alerts for:
- Block rate > 10% (unusual activity)
- P95 latency > 10ms (performance degradation)
- Specific fingerprint > 100 validations/hour (bot)
- Blocks from unexpected countries

---

## Troubleshooting

### "Analytics Engine not configured"

**Solution:** Ensure `analytics_engine_datasets` is configured in `wrangler.jsonc`:

```jsonc
{
  "analytics_engine_datasets": [
    { "binding": "ANALYTICS" }
  ]
}
```

### No data showing up

**Possible causes:**
1. Analytics Engine has a delay (1-2 minutes)
2. No validations have occurred yet
3. Time range is too narrow
4. ANALYTICS binding is missing

**Solution:** Wait a few minutes after validations, then query again.

### Query timeout

**Solution:**
- Reduce time range
- Add more specific WHERE filters
- Limit result size with `LIMIT`

### Invalid SQL syntax

**Error:** `Syntax error near...`

**Solution:** Check that you're using supported SQL syntax (no JOINs, no subqueries). Reference the [Analytics Engine SQL documentation](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/).

---

## API Reference

### GET /admin/analytics

Query Analytics Engine with custom SQL.

**Query Parameters:**
- `query` (optional): URL-encoded SQL query
- `hours` (optional): Number of hours to look back (default: 24)

**Headers:**
- `X-API-Key`: Your Admin API key (required)

**Response:**
```json
{
  "success": true,
  "query": "SELECT...",
  "hours": 24,
  "data": [...],
  "columnMapping": {
    "blob1": "decision (allow/warn/block)",
    "blob2": "block_reason",
    ...
  }
}
```

### GET /admin/analytics/queries

Get list of pre-built queries.

**Headers:**
- `X-API-Key`: Your Admin API key (required)

**Response:**
```json
{
  "queries": {
    "summary": {
      "name": "Decision Summary",
      "description": "Overview of allow/warn/block decisions",
      "sql": "SELECT..."
    },
    ...
  },
  "usage": "Use the SQL from any query with GET /admin/analytics?query=..."
}
```

---

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Configure analytics settings
- [API Reference](API.md) - All API endpoints
- [Getting Started](GETTING_STARTED.md) - Initial setup

---

**Last Updated:** 2025-11-01
**Dashboard Location:** `/analytics.html`
**API Endpoints:** `/admin/analytics`, `/admin/analytics/queries`
