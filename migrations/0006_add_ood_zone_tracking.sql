/**
 * Migration: Add OOD Zone Tracking
 * Version: 2.4.1
 * Date: 2025-01-12
 *
 * Adds ood_zone column to track which zone patterns fall into
 * with the piecewise threshold system.
 *
 * Changes:
 * - Add ood_zone column: tracks 'none', 'warn', or 'block' zone
 *
 * Related: v2.4.1 piecewise threshold implementation
 * Previous: 0005_add_ood_detection.sql
 */

-- Add OOD zone tracking column
-- Possible values: 'none' (below 3.8), 'warn' (3.8-5.5), 'block' (5.5+)
ALTER TABLE validations ADD COLUMN ood_zone TEXT;

-- Create index for OOD zone queries
CREATE INDEX IF NOT EXISTS idx_validations_ood_zone
ON validations(ood_zone)
WHERE ood_zone IS NOT NULL;

-- Create composite index for zone + decision analysis
CREATE INDEX IF NOT EXISTS idx_validations_ood_zone_decision
ON validations(ood_zone, decision, timestamp)
WHERE ood_zone IS NOT NULL;

/**
 * Usage Examples:
 *
 * 1. Count validations by OOD zone:
 * SELECT ood_zone, COUNT(*) as count
 * FROM validations
 * WHERE timestamp >= datetime('now', '-24 hours')
 * GROUP BY ood_zone;
 *
 * 2. Analyze decisions by zone:
 * SELECT ood_zone, decision, COUNT(*) as count
 * FROM validations
 * WHERE ood_detected = 1
 * GROUP BY ood_zone, decision;
 *
 * 3. Find patterns in specific zone:
 * SELECT email_local_part, min_entropy, abnormality_risk, decision
 * FROM validations
 * WHERE ood_zone = 'block'
 *   AND timestamp >= datetime('now', '-7 days')
 * ORDER BY min_entropy DESC
 * LIMIT 100;
 */
