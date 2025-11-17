# Database Schema Initialization Guide

## Overview

This guide covers D1 database setup for Markov-Mail (this repository). For Forminator schema setup, see the [Forminator documentation](https://github.com/erfianugrah/forminator/blob/main/docs/SCHEMA-INITIALIZATION.md).

Markov-Mail supports two initialization methods:
- **schema.sql**: Single-file initialization for new deployments (recommended)
- **migrations/**: Incremental updates for existing deployments with data

---

## Database Setup

### For New Deployments (Recommended)

The consolidated `schema.sql` file contains all migrations up to 0007 (v2.5.0).

**File**: [`schema.sql`](../schema.sql) (this repo)

**Tables**:
- `validations` - Email validation events with fraud detection data (66 columns)
- `training_metrics` - Model training pipeline events
- `ab_test_metrics` - A/B experiment tracking
- `admin_metrics` - Administrative actions

**Initialize Database**:
```bash
# Initialize remote database (production)
wrangler d1 execute DB --file=./schema.sql --remote

# Initialize local database (development)
wrangler d1 execute DB --file=./schema.sql --local
```

**Verify Initialization**:
```bash
# Check tables were created
wrangler d1 execute DB --command="SELECT name FROM sqlite_master WHERE type='table'" --remote

# Expected output:
# - validations
# - training_metrics
# - ab_test_metrics
# - admin_metrics

# Check validations table has all columns
wrangler d1 execute DB --command="PRAGMA table_info(validations)" --remote | grep -E "(region|ja4|verified_bot)"

# Should show enhanced metadata columns from v2.5
```

---

### For Existing Deployments (With Data)

If you have an existing deployment with data, use migrations instead of schema.sql to preserve your data.

**Check Migration Status**:
```bash
# List applied and pending migrations
wrangler d1 migrations list DB --remote
```

**Apply Pending Migrations**:
```bash
# Apply all pending migrations
wrangler d1 migrations apply DB --remote

# Apply specific migration
wrangler d1 migrations apply DB --remote --step=1
```

**Migration History** (in [`migrations/`](../migrations/) directory):
- [`0001_create_initial_schema.sql`](../migrations/0001_create_initial_schema.sql) - Base schema (v2.0)
- [`0002_add_pattern_classification_version.sql`](../migrations/0002_add_pattern_classification_version.sql) - Algorithm versioning (v2.1)
- [`0003_deprecate_heuristic_detectors.sql`](../migrations/0003_deprecate_heuristic_detectors.sql) - Deprecate keyboard/gibberish detectors (v2.2)
- [`0004_add_ensemble_metadata.sql`](../migrations/0004_add_ensemble_metadata.sql) - Ensemble strategy tracking (v2.3)
- [`0005_add_ood_detection.sql`](../migrations/0005_add_ood_detection.sql) - Out-of-Distribution detection (v2.4)
- [`0006_add_ood_zone_tracking.sql`](../migrations/0006_add_ood_zone_tracking.sql) - OOD zone classification (v2.4.1)
- [`0007_add_enhanced_request_metadata.sql`](../migrations/0007_add_enhanced_request_metadata.sql) - **RPC metadata integration (v2.5)**

---

## Schema Version

**Current Version**: 2.5.0
**Last Updated**: 2025-11-17 (includes all migrations 0001-0007)
**Columns**: 66 total in validations table

| Category | Columns |
|----------|---------|
| Core | decision, risk_score, block_reason, email_local_part, domain, tld, fingerprint_hash |
| Pattern Detection | pattern_type, pattern_family, is_disposable, is_free_provider, has_plus_addressing |
| Markov Analysis | markov_detected, markov_confidence, markov_cross_entropy_legit, markov_cross_entropy_fraud |
| Ensemble (v2.3) | ensemble_reasoning, model_2gram_prediction, model_3gram_prediction |
| OOD Detection (v2.4) | min_entropy, abnormality_score, abnormality_risk, ood_detected, ood_zone |
| Geographic (v2.5) | country, region, city, postal_code, timezone, latitude, longitude, continent, is_eu_country |
| Network (v2.5) | asn, as_organization, colo, http_protocol, tls_version, tls_cipher |
| Bot Detection (v2.5) | bot_score, client_trust_score, verified_bot, js_detection_passed, detection_ids |
| Fingerprints (v2.5) | ja3_hash, ja4, ja4_signals |
| Online Learning | client_ip, user_agent, model_version, exclude_from_training, ip_reputation_score |
| A/B Testing | experiment_id, variant, bucket |

**Indexes**: 20 indexes optimized for common queries

**Additional Tables**:
- `training_metrics` - Model training events and performance
- `ab_test_metrics` - A/B experiment tracking
- `admin_metrics` - Administrative actions

---

## Comparison: schema.sql vs migrations

| Aspect | schema.sql | migrations/ |
|--------|------------|-------------|
| **Use Case** | New deployments | Existing deployments with data |
| **Speed** | Fast (1 file) | Slower (7 files) |
| **Data Safety** | Wipes all data | Preserves existing data |
| **Version Control** | Single source of truth | Incremental history |
| **Recommended For** | Fresh installations | Production updates |

---

## Common Issues

### Issue: "Table already exists"

**Symptom**: Error when running schema.sql on existing database

**Solution**: Use migrations instead to preserve data
```bash
wrangler d1 migrations apply DB --remote
```

---

### Issue: "Migration already applied"

**Symptom**: Wrangler reports migration already applied

**Solution**: This is normal - migrations are idempotent
```bash
# Check which migrations are applied
wrangler d1 migrations list DB --remote

# If you see "Migrations to be applied: (empty)", you're up to date
```

---

### Issue: "Column does not exist"

**Symptom**: SQL errors about missing columns after deployment

**Solution**: Schema not initialized or migration not applied
```bash
# For new deployment
wrangler d1 execute DB --file=./schema.sql --remote

# For existing deployment
wrangler d1 migrations apply DB --remote
```

---

## Testing Schema

### Test Database Connection
```bash
# Insert test validation with enhanced metadata (v2.5 fields)
wrangler d1 execute DB --command="
INSERT INTO validations (
  decision, risk_score, fingerprint_hash, latency,
  region, city, colo, ja4
) VALUES (
  'allow', 0.15, 'test123', 35.5,
  'CA', 'San Francisco', 'SFO', 't13d1516h2_8daaf6152771_e5627efa2ab1'
)
" --remote

# Verify enhanced metadata columns exist
wrangler d1 execute DB --command="
SELECT decision, region, city, colo, ja4 FROM validations ORDER BY id DESC LIMIT 1
" --remote

# Clean up
wrangler d1 execute DB --command="DELETE FROM validations WHERE fingerprint_hash = 'test123'" --remote
```

### Test via CLI
```bash
# Use markov-mail CLI to query analytics
npm run cli analytics:query "SELECT COUNT(*) as total FROM validations"

# Test API endpoint
npm run cli test:api user@example.com
```

---

## Best Practices

### New Deployments
1. Use `schema.sql` for clean initialization
2. Initialize local database: `wrangler d1 execute DB --file=./schema.sql --local`
3. Verify schema after deployment
4. Document which version you deployed (currently v2.5.0)

### Existing Deployments
1. **Always use migrations** to update schema (never schema.sql with data)
2. Test migrations on local/staging first: `wrangler d1 migrations apply DB --local`
3. Check migration status before deploying: `wrangler d1 migrations list DB --remote`
4. Apply migrations **before** deploying new worker code

### General
1. Keep wrangler.jsonc database IDs correct
2. Monitor D1 console for errors after schema changes
3. Use CLI for analytics queries: `npm run cli analytics:query "SELECT ..."`
4. Back up important data before major migrations

---

## Development Workflow

### Initial Setup
```bash
# 1. Initialize local database
wrangler d1 execute DB --file=./schema.sql --local

# 2. Start local development
wrangler dev --local

# 3. Test API
curl -X POST http://localhost:8787/validate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Production Deployment
```bash
# 1. Check migration status
wrangler d1 migrations list DB --remote

# 2. Apply pending migrations (if any)
wrangler d1 migrations apply DB --remote

# 3. Verify schema
wrangler d1 execute DB --command="PRAGMA table_info(validations)" --remote | grep -E "(region|ja4)"

# 4. Deploy worker
npm run deploy

# 5. Verify deployment
npm run cli test:api test@example.com
```

---

## Related Documentation

### This Repository (Markov-Mail)
- [Main Documentation (CLAUDE.md)](../CLAUDE.md) - Comprehensive project guide
- [Getting Started](./GETTING_STARTED.md) - Quick start guide and CLI usage
- [RPC Integration](./RPC-INTEGRATION.md) - Worker-to-Worker RPC integration with Forminator
- [Database Schema](../schema.sql) - Complete D1 schema definition (v2.5.0)
- [Migrations Directory](../migrations/) - All schema migrations (0001-0007)

### External Resources
- [Forminator Documentation](https://github.com/erfianugrah/forminator/blob/main/docs/SCHEMA-INITIALIZATION.md) - Form submission platform schema
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/) - Official D1 database guide
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - Workers runtime documentation
