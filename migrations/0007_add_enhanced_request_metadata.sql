-- Migration number: 0007 	 2025-11-17T10:40:00.000Z
-- Add enhanced request metadata from Cloudflare request.cf
-- Enables comprehensive fraud analysis with geographic, network, and bot detection signals

-- ============================================================================
-- Add Enhanced Geographic Fields
-- ============================================================================
ALTER TABLE validations ADD COLUMN region TEXT;
ALTER TABLE validations ADD COLUMN city TEXT;
ALTER TABLE validations ADD COLUMN postal_code TEXT;
ALTER TABLE validations ADD COLUMN timezone TEXT;
ALTER TABLE validations ADD COLUMN latitude TEXT;
ALTER TABLE validations ADD COLUMN longitude TEXT;
ALTER TABLE validations ADD COLUMN continent TEXT;
ALTER TABLE validations ADD COLUMN is_eu_country TEXT;

-- ============================================================================
-- Add Enhanced Network Fields
-- ============================================================================
ALTER TABLE validations ADD COLUMN as_organization TEXT;
ALTER TABLE validations ADD COLUMN colo TEXT;
ALTER TABLE validations ADD COLUMN http_protocol TEXT;
ALTER TABLE validations ADD COLUMN tls_version TEXT;
ALTER TABLE validations ADD COLUMN tls_cipher TEXT;

-- ============================================================================
-- Add Enhanced Bot Detection Fields
-- ============================================================================
ALTER TABLE validations ADD COLUMN client_trust_score INTEGER;
ALTER TABLE validations ADD COLUMN verified_bot INTEGER DEFAULT 0; -- 0=false, 1=true
ALTER TABLE validations ADD COLUMN js_detection_passed INTEGER DEFAULT 0; -- 0=false, 1=true
ALTER TABLE validations ADD COLUMN detection_ids TEXT; -- JSON array

-- ============================================================================
-- Add Enhanced Fingerprint Fields
-- ============================================================================
ALTER TABLE validations ADD COLUMN ja3_hash TEXT;
ALTER TABLE validations ADD COLUMN ja4 TEXT;
ALTER TABLE validations ADD COLUMN ja4_signals TEXT; -- JSON object

-- ============================================================================
-- Add Indexes for New Fields
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_validations_region ON validations(region);
CREATE INDEX IF NOT EXISTS idx_validations_city ON validations(city);
CREATE INDEX IF NOT EXISTS idx_validations_colo ON validations(colo);
CREATE INDEX IF NOT EXISTS idx_validations_ja3_hash ON validations(ja3_hash);
CREATE INDEX IF NOT EXISTS idx_validations_ja4 ON validations(ja4);
CREATE INDEX IF NOT EXISTS idx_validations_verified_bot ON validations(verified_bot);
CREATE INDEX IF NOT EXISTS idx_validations_client_trust_score ON validations(client_trust_score);
