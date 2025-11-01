import {
  isDisposableDomain,
  matchesDisposablePattern,
  isFreeEmailProvider,
} from '../data/disposable-domains';

export interface DomainValidationResult {
  valid: boolean;
  isDisposable: boolean;
  isFreeProvider: boolean;
  matchesDisposablePattern: boolean;
  reason?: string;
  signals: {
    domainLength: number;
    hasValidTLD: boolean;
    subdomainDepth: number;
  };
}

/**
 * Validate domain and check for disposable/suspicious patterns
 */
export function validateDomain(domain: string): DomainValidationResult {
  const normalizedDomain = domain.toLowerCase().trim();

  // Basic validation
  if (!normalizedDomain || normalizedDomain.length === 0) {
    return {
      valid: false,
      isDisposable: false,
      isFreeProvider: false,
      matchesDisposablePattern: false,
      reason: 'Empty domain',
      signals: {
        domainLength: 0,
        hasValidTLD: false,
        subdomainDepth: 0,
      },
    };
  }

  // Check domain length
  if (normalizedDomain.length > 255) {
    return {
      valid: false,
      isDisposable: false,
      isFreeProvider: false,
      matchesDisposablePattern: false,
      reason: 'Domain too long',
      signals: {
        domainLength: normalizedDomain.length,
        hasValidTLD: false,
        subdomainDepth: 0,
      },
    };
  }

  // Check for valid structure
  const parts = normalizedDomain.split('.');
  const subdomainDepth = parts.length - 2; // example.com = 0, sub.example.com = 1

  // Must have at least domain + TLD
  if (parts.length < 2) {
    return {
      valid: false,
      isDisposable: false,
      isFreeProvider: false,
      matchesDisposablePattern: false,
      reason: 'Invalid domain structure',
      signals: {
        domainLength: normalizedDomain.length,
        hasValidTLD: false,
        subdomainDepth: 0,
      },
    };
  }

  // Check TLD
  const tld = parts[parts.length - 1];
  const hasValidTLD = tld.length >= 2 && /^[a-z]+$/.test(tld);

  if (!hasValidTLD) {
    return {
      valid: false,
      isDisposable: false,
      isFreeProvider: false,
      matchesDisposablePattern: false,
      reason: 'Invalid TLD',
      signals: {
        domainLength: normalizedDomain.length,
        hasValidTLD: false,
        subdomainDepth,
      },
    };
  }

  // Check against disposable list
  const isDisposableExact = isDisposableDomain(normalizedDomain);
  const matchesPattern = matchesDisposablePattern(normalizedDomain);
  const isFree = isFreeEmailProvider(normalizedDomain);

  // Determine if disposable
  const isDisposableResult = isDisposableExact || matchesPattern;

  const result: DomainValidationResult = {
    valid: !isDisposableResult, // Invalid if disposable
    isDisposable: isDisposableResult,
    isFreeProvider: isFree,
    matchesDisposablePattern: matchesPattern,
    signals: {
      domainLength: normalizedDomain.length,
      hasValidTLD,
      subdomainDepth,
    },
  };

  if (isDisposableExact) {
    result.reason = 'Known disposable email domain';
  } else if (matchesPattern) {
    result.reason = 'Domain matches disposable pattern';
  }

  return result;
}

/**
 * Check if domain has suspicious characteristics
 */
export function isDomainSuspicious(domain: string): {
  suspicious: boolean;
  reasons: string[];
} {
  const normalizedDomain = domain.toLowerCase().trim();
  const reasons: string[] = [];

  // Check for very long domains (often spam)
  if (normalizedDomain.length > 50) {
    reasons.push('Domain excessively long');
  }

  // Check for many subdomains (often temporary services)
  const subdomainDepth = normalizedDomain.split('.').length - 2;
  if (subdomainDepth > 3) {
    reasons.push('Too many subdomains');
  }

  // Check for numeric-only domain name
  const domainName = normalizedDomain.split('.')[0];
  if (/^\d+$/.test(domainName)) {
    reasons.push('Domain name is all numbers');
  }

  // Check for very short domain (< 3 chars before TLD)
  if (domainName.length < 3) {
    reasons.push('Domain name too short');
  }

  // Check for excessive hyphens
  const hyphenCount = (domainName.match(/-/g) || []).length;
  if (hyphenCount > 3) {
    reasons.push('Too many hyphens in domain');
  }

  // Check for random-looking domain
  const hasOnlyConsonants = /^[bcdfghjklmnpqrstvwxyz]+$/.test(domainName);
  if (hasOnlyConsonants && domainName.length > 5) {
    reasons.push('Domain appears random (no vowels)');
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Get domain reputation score (0.0 = trusted, 1.0 = suspicious)
 */
export function getDomainReputationScore(domain: string): number {
  const validation = validateDomain(domain);
  const suspicious = isDomainSuspicious(domain);

  let score = 0.0;

  // Disposable domains get highest score
  if (validation.isDisposable) {
    score += 0.9;
  }

  // Pattern matches add to score
  if (validation.matchesDisposablePattern) {
    score += 0.3;
  }

  // Suspicious characteristics
  if (suspicious.suspicious) {
    score += 0.1 * suspicious.reasons.length;
  }

  // Subdomain depth (more subdomains = more suspicious)
  if (validation.signals.subdomainDepth > 2) {
    score += 0.1 * validation.signals.subdomainDepth;
  }

  // Cap at 1.0
  return Math.min(score, 1.0);
}
