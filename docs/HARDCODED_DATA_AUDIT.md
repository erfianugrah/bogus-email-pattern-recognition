# Hardcoded Data Audit Report

**Date:** 2025-11-02
**Auditor:** Claude
**Purpose:** Identify hardcoded data that should be moved to KV for dynamic updates

## Executive Summary

Found **5 major areas** of hardcoded data that could benefit from KV storage approach:

| Data Source | Status | Lines | Items | Priority | Impact |
|-------------|--------|-------|-------|----------|--------|
| Disposable Domains | ✅ **Migrated** | 274 | 170→71,751 | **HIGH** | **422x increase** |
| Free Email Providers | ⚠️ Hardcoded | ~40 | 20 | **HIGH** | Easy updates |
| TLD Risk Profiles | ⚠️ Hardcoded | 1,440 | 142 | **MEDIUM** | Flexible risk tuning |
| Keyboard Layouts | ⚠️ Hardcoded | 666 | 5 layouts | **LOW** | Rarely changes |
| Whitelist Patterns | ⚠️ Hardcoded | ~200 | 8 patterns | **LOW** | User-specific |

---

## 1. ✅ Disposable Domains (COMPLETED)

**File:** `src/data/disposable-domains.ts`
**Status:** ✅ Migrated to KV
**Size:** 170 → 71,751 domains (422x increase)

### Implementation:
- ✅ Auto-updates from GitHub every 6 hours
- ✅ KV storage with metadata
- ✅ 1-hour in-memory cache
- ✅ Graceful fallback to hardcoded
- ✅ Admin API + CLI tools

---

## 2. ⚠️ Free Email Providers

**File:** `src/data/disposable-domains.ts:241-260`
**Current:** Hardcoded Set with ~20 domains
**Priority:** **HIGH**

### Current List:
```typescript
export const freeEmailProviders = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'zoho.com',
  'yandex.com',
  'mail.ru',
]);
```

### Migration Benefits:
- **Easy updates:** Add new providers without deployment
- **Regional providers:** Support international free email services
- **Dynamic scoring:** Different risk scores per provider
- **Admin control:** Enable/disable providers via API

### Recommendation:
**✅ MIGRATE** - Same approach as disposable domains

**Implementation Plan:**
1. Add to same KV namespace as disposable domains (or new key in existing)
2. Store as JSON array with metadata
3. Include in cron job updates
4. Add admin API endpoints
5. Maintain backward compatibility with fallback

**Estimated Effort:** 2-3 hours
**Risk:** Low (simple list)

---

## 3. ⚠️ TLD Risk Profiles

**File:** `src/detectors/tld-risk.ts:27-1400`
**Current:** 142 TLD profiles with risk scoring
**Size:** 1,440 lines
**Priority:** **MEDIUM**

### Data Structure:
```typescript
interface TLDRiskProfile {
  tld: string;
  category: 'trusted' | 'standard' | 'suspicious' | 'high_risk';
  disposableRatio: number;  // 0-1
  spamRatio: number;        // 0-1
  riskMultiplier: number;
  registrationCost: 'free' | 'low' | 'medium' | 'high' | 'restricted';
  description: string;
}
```

### Current TLDs:
- 3 trusted (.edu, .gov, .mil)
- 108 standard (.com, .net, .org, country codes)
- 19 suspicious (.info, .biz)
- 12 high-risk (.tk, .ml, .ga, free TLDs)

### Migration Benefits:
- **Flexible tuning:** Adjust risk scores without deployment
- **A/B testing:** Test different scoring strategies
- **Historical tracking:** Track score changes over time
- **External data:** Integrate with abuse databases
- **Regional variations:** Different scores by geography

### Concerns:
- **Large dataset:** 142 items × 7 fields = ~5KB
- **Frequent access:** Used on every email validation
- **Cache critical:** Need efficient caching strategy

### Recommendation:
**⚡ MIGRATE WITH OPTIMIZATION**

**Implementation Plan:**
1. Create `TLD_RISK_PROFILES` KV key
2. Store as compressed JSON (gzip)
3. Implement 6-hour cache (longer than domains)
4. Add version tracking
5. Admin API for updates
6. Gradual rollout via A/B testing

**Estimated Effort:** 4-6 hours
**Risk:** Medium (requires performance testing)

---

## 4. ⚠️ Keyboard Walk Layouts

**File:** `src/detectors/keyboard-walk.ts:45-200`
**Current:** 5 keyboard layouts (QWERTY, AZERTY, QWERTZ, Dvorak, Colemak)
**Size:** ~666 lines
**Priority:** **LOW**

### Data Structure:
```typescript
interface KeyboardLayout {
  name: string;
  rows: string[];
  cols: string[];
  diagonals: string[];
}
```

### Current Layouts:
1. QWERTY (US/UK)
2. AZERTY (French/Belgian)
3. QWERTZ (German/Central European)
4. Dvorak (Alternative)
5. Colemak (Modern)

### Concerns:
- **Stability:** Keyboard layouts rarely change
- **Performance:** Patterns are static and pre-computed
- **Complexity:** Migration effort vs. benefit unclear
- **Cache efficiency:** Would always be cached anyway

### Recommendation:
**❌ KEEP HARDCODED**

**Rationale:**
- Keyboard layouts are **extremely stable** (QWERTY hasn't changed in 150 years)
- No external data source to sync from
- No business reason to update frequently
- Code is well-structured and testable as-is
- Migration would add complexity without clear benefit

**Alternative:** If needed, could export as separate JSON file for easier updates without full deployment

---

## 5. ⚠️ Whitelist Patterns

**File:** `src/detectors/whitelist.ts:63-200`
**Current:** 8 default whitelist entries
**Size:** ~200 lines
**Priority:** **LOW**

### Data Structure:
```typescript
interface WhitelistEntry {
  id: string;
  type: WhitelistPatternType;
  pattern: string;  // email, domain, or regex
  description: string;
  confidence: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: { ... };
}
```

### Current Patterns:
1. Corporate employee numbers (employee1@company.com)
2. Employee IDs with underscores (emp_12345)
3. Birth year patterns (john.1990@gmail.com)
4. International names
5. Known vendor domains
6. Regional name patterns
7. Business title patterns
8. Intern/contractor patterns

### Migration Benefits:
- **Per-customer:** Different whitelists per client
- **Easy updates:** Add patterns without deployment
- **Testing:** A/B test whitelist effectiveness
- **Audit trail:** Track who added what and when

### Current Implementation:
Already has `loadWhitelistConfig()` function that reads from KV! Partially implemented but **currently disabled** (line 452-483 in src/index.ts).

### Recommendation:
**✅ ALREADY DESIGNED FOR KV** (just disabled)

**Action Items:**
1. Re-enable whitelist system (currently commented out)
2. Document whitelist management
3. Create admin API for whitelist CRUD
4. Add CLI tool for whitelist management
5. Consider per-customer whitelist support

**Estimated Effort:** 1-2 hours (mostly re-enabling existing code)
**Risk:** Low (already built)

---

## Migration Priority & Timeline

### Phase 1: High Priority (Week 1)
1. ✅ **Disposable Domains** - COMPLETED
2. **Free Email Providers** - 2-3 hours
   - Use same approach as disposable domains
   - Low risk, high value

### Phase 2: Medium Priority (Week 2)
3. **TLD Risk Profiles** - 4-6 hours
   - Requires performance testing
   - A/B test before full rollout
   - Monitor cache hit rates

### Phase 3: Low Priority (Week 3+)
4. **Re-enable Whitelist System** - 1-2 hours
   - Already designed for KV
   - Just needs to be re-enabled and documented
5. **Keyboard Layouts** - ❌ Skip (no value)
   - Keep as hardcoded code
   - Maybe export to JSON file if really needed

---

## Implementation Checklist

### For Each Data Source:

- [ ] Create KV updater service
- [ ] Implement caching strategy (tune TTL per data type)
- [ ] Add fallback to hardcoded data
- [ ] Create admin API endpoints (GET metadata, POST update, DELETE cache)
- [ ] Add CLI commands
- [ ] Update documentation
- [ ] Write tests
- [ ] Monitor performance in production
- [ ] Set up alerts for stale data

### Shared Infrastructure:
- [ ] Consider consolidating into single `DETECTION_DATA` KV namespace
- [ ] Implement versioning for all data sources
- [ ] Create unified admin dashboard
- [ ] Add bulk update API
- [ ] Set up monitoring & alerting

---

## Cost & Performance Analysis

### KV Storage Costs:
- Disposable Domains: ~1MB (71,751 items)
- Free Email Providers: ~1KB (20 items)
- TLD Risk Profiles: ~5KB (142 items)
- **Total:** ~1.01MB

**Cost:** $0.50/GB/month = **~$0.0005/month** (negligible)

### KV Read Costs:
- 100k reads/day = $0.50/month per data source
- With 1-hour caching: ~24 reads/day per worker = **$0.012/month**

**Total Cost:** < $0.02/month (essentially free)

### Performance Impact:
- Cached reads: <1ms (in-memory)
- KV reads: 10-50ms (first load only)
- Cache hit rate: >99% (with 1-hour TTL)

**Impact:** Negligible (<0.1% latency increase)

---

## Recommendations Summary

| Action | Priority | Effort | Value |
|--------|----------|--------|-------|
| Migrate Free Email Providers | **HIGH** | 2-3h | **HIGH** |
| Migrate TLD Risk Profiles | **MEDIUM** | 4-6h | **MEDIUM** |
| Re-enable Whitelist System | **LOW** | 1-2h | **MEDIUM** |
| Keep Keyboard Layouts Hardcoded | N/A | 0h | N/A |

**Next Steps:**
1. ✅ Review and approve this audit
2. Implement free email providers migration
3. Test TLD risk profiles migration in staging
4. Re-enable and document whitelist system
5. Monitor and iterate

---

**Approved by:** _________________
**Date:** _________________
