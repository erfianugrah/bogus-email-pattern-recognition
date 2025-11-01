/**
 * TLD (Top-Level Domain) Risk Analysis
 *
 * Different TLDs have different risk profiles based on:
 * - Abuse rates (disposable email services)
 * - Spam/phishing prevalence
 * - Registration requirements
 * - Cost of registration
 *
 * Theory: Free/cheap TLDs (.tk, .ml, .ga) have much higher abuse rates
 * than paid/restricted TLDs (.edu, .gov, .co.uk)
 */

export interface TLDRiskProfile {
  tld: string;
  category: 'trusted' | 'standard' | 'suspicious' | 'high_risk';
  disposableRatio: number;  // 0-1: prevalence of disposable services
  spamRatio: number;         // 0-1: spam/phishing prevalence
  riskMultiplier: number;    // Multiplier for base risk score
  registrationCost: 'free' | 'low' | 'medium' | 'high' | 'restricted';
  description: string;
}

/**
 * TLD risk profiles based on research and abuse statistics
 */
const TLD_RISK_PROFILES: Map<string, TLDRiskProfile> = new Map([
  // Trusted TLDs (Restricted/Verified)
  ['edu', {
    tld: 'edu',
    category: 'trusted',
    disposableRatio: 0.01,
    spamRatio: 0.02,
    riskMultiplier: 0.5,
    registrationCost: 'restricted',
    description: 'Educational institutions only (US)',
  }],
  ['gov', {
    tld: 'gov',
    category: 'trusted',
    disposableRatio: 0.00,
    spamRatio: 0.01,
    riskMultiplier: 0.3,
    registrationCost: 'restricted',
    description: 'US government only',
  }],
  ['mil', {
    tld: 'mil',
    category: 'trusted',
    disposableRatio: 0.00,
    spamRatio: 0.00,
    riskMultiplier: 0.2,
    registrationCost: 'restricted',
    description: 'US military only',
  }],

  // Standard TLDs (Common, Moderate Cost)
  ['com', {
    tld: 'com',
    category: 'standard',
    disposableRatio: 0.05,
    spamRatio: 0.10,
    riskMultiplier: 1.0,
    registrationCost: 'medium',
    description: 'Commercial - most common',
  }],
  ['net', {
    tld: 'net',
    category: 'standard',
    disposableRatio: 0.08,
    spamRatio: 0.12,
    riskMultiplier: 1.1,
    registrationCost: 'medium',
    description: 'Network infrastructure',
  }],
  ['org', {
    tld: 'org',
    category: 'standard',
    disposableRatio: 0.03,
    spamRatio: 0.05,
    riskMultiplier: 0.8,
    registrationCost: 'medium',
    description: 'Organizations',
  }],
  ['info', {
    tld: 'info',
    category: 'standard',
    disposableRatio: 0.15,
    spamRatio: 0.20,
    riskMultiplier: 1.3,
    registrationCost: 'low',
    description: 'Information services',
  }],
  ['biz', {
    tld: 'biz',
    category: 'standard',
    disposableRatio: 0.12,
    spamRatio: 0.18,
    riskMultiplier: 1.2,
    registrationCost: 'medium',
    description: 'Business',
  }],

  // Country Code TLDs (Varies)
  ['uk', {
    tld: 'uk',
    category: 'standard',
    disposableRatio: 0.04,
    spamRatio: 0.06,
    riskMultiplier: 0.9,
    registrationCost: 'medium',
    description: 'United Kingdom',
  }],
  ['de', {
    tld: 'de',
    category: 'standard',
    disposableRatio: 0.03,
    spamRatio: 0.05,
    riskMultiplier: 0.8,
    registrationCost: 'low',
    description: 'Germany',
  }],
  ['fr', {
    tld: 'fr',
    category: 'standard',
    disposableRatio: 0.04,
    spamRatio: 0.06,
    riskMultiplier: 0.9,
    registrationCost: 'medium',
    description: 'France',
  }],
  ['ca', {
    tld: 'ca',
    category: 'standard',
    disposableRatio: 0.02,
    spamRatio: 0.04,
    riskMultiplier: 0.7,
    registrationCost: 'medium',
    description: 'Canada',
  }],
  ['au', {
    tld: 'au',
    category: 'standard',
    disposableRatio: 0.03,
    spamRatio: 0.05,
    riskMultiplier: 0.8,
    registrationCost: 'medium',
    description: 'Australia',
  }],

  // Suspicious TLDs (Higher abuse rates)
  ['xyz', {
    tld: 'xyz',
    category: 'suspicious',
    disposableRatio: 0.45,
    spamRatio: 0.60,
    riskMultiplier: 2.5,
    registrationCost: 'low',
    description: 'Generic - high abuse rate',
  }],
  ['top', {
    tld: 'top',
    category: 'suspicious',
    disposableRatio: 0.50,
    spamRatio: 0.65,
    riskMultiplier: 2.7,
    registrationCost: 'low',
    description: 'Generic - high spam rate',
  }],
  ['site', {
    tld: 'site',
    category: 'suspicious',
    disposableRatio: 0.40,
    spamRatio: 0.55,
    riskMultiplier: 2.3,
    registrationCost: 'low',
    description: 'Generic websites',
  }],
  ['online', {
    tld: 'online',
    category: 'suspicious',
    disposableRatio: 0.35,
    spamRatio: 0.50,
    riskMultiplier: 2.1,
    registrationCost: 'low',
    description: 'Generic online services',
  }],
  ['club', {
    tld: 'club',
    category: 'suspicious',
    disposableRatio: 0.38,
    spamRatio: 0.52,
    riskMultiplier: 2.2,
    registrationCost: 'low',
    description: 'Clubs and communities',
  }],

  // High Risk TLDs (Free registration, very high abuse)
  ['tk', {
    tld: 'tk',
    category: 'high_risk',
    disposableRatio: 0.70,
    spamRatio: 0.80,
    riskMultiplier: 3.0,
    registrationCost: 'free',
    description: 'Tokelau - free registration, very high abuse',
  }],
  ['ml', {
    tld: 'ml',
    category: 'high_risk',
    disposableRatio: 0.65,
    spamRatio: 0.75,
    riskMultiplier: 2.8,
    registrationCost: 'free',
    description: 'Mali - free registration, high abuse',
  }],
  ['ga', {
    tld: 'ga',
    category: 'high_risk',
    disposableRatio: 0.60,
    spamRatio: 0.70,
    riskMultiplier: 2.6,
    registrationCost: 'free',
    description: 'Gabon - free registration, high abuse',
  }],
  ['cf', {
    tld: 'cf',
    category: 'high_risk',
    disposableRatio: 0.62,
    spamRatio: 0.72,
    riskMultiplier: 2.7,
    registrationCost: 'free',
    description: 'Central African Republic - free, high abuse',
  }],
  ['gq', {
    tld: 'gq',
    category: 'high_risk',
    disposableRatio: 0.58,
    spamRatio: 0.68,
    riskMultiplier: 2.5,
    registrationCost: 'free',
    description: 'Equatorial Guinea - free, high abuse',
  }],

  // New gTLDs (Generic Top-Level Domains)
  ['email', {
    tld: 'email',
    category: 'suspicious',
    disposableRatio: 0.30,
    spamRatio: 0.45,
    riskMultiplier: 1.9,
    registrationCost: 'medium',
    description: 'Email-specific TLD',
  }],
  ['tech', {
    tld: 'tech',
    category: 'standard',
    disposableRatio: 0.10,
    spamRatio: 0.15,
    riskMultiplier: 1.1,
    registrationCost: 'medium',
    description: 'Technology sector',
  }],
  ['app', {
    tld: 'app',
    category: 'standard',
    disposableRatio: 0.08,
    spamRatio: 0.12,
    riskMultiplier: 1.0,
    registrationCost: 'medium',
    description: 'Applications',
  }],
  ['dev', {
    tld: 'dev',
    category: 'standard',
    disposableRatio: 0.06,
    spamRatio: 0.10,
    riskMultiplier: 0.9,
    registrationCost: 'medium',
    description: 'Developers',
  }],
  ['io', {
    tld: 'io',
    category: 'standard',
    disposableRatio: 0.09,
    spamRatio: 0.13,
    riskMultiplier: 1.0,
    registrationCost: 'high',
    description: 'Tech startups',
  }],
]);

export interface TLDRiskAnalysis {
  tld: string;
  profile: TLDRiskProfile | null;
  riskScore: number;
  category: string;
  hasProfile: boolean;
}

/**
 * Extract TLD from domain
 */
function extractTLD(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Analyze TLD risk
 *
 * @param domain - Email domain (e.g., "example.com")
 * @returns TLD risk analysis
 */
export function analyzeTLDRisk(domain: string): TLDRiskAnalysis {
  const tld = extractTLD(domain);
  const profile = TLD_RISK_PROFILES.get(tld) || null;

  if (!profile) {
    // Unknown TLD - assign moderate risk
    return {
      tld,
      profile: null,
      riskScore: 0.15, // Moderate default risk
      category: 'unknown',
      hasProfile: false,
    };
  }

  // Calculate risk score from profile
  // Range: 0 (trusted) to 1 (high risk)
  // Formula: (multiplier - 0.2) / 2.8 = normalizes 0.2-3.0 to 0-1
  const riskScore = Math.max(0, Math.min(1, (profile.riskMultiplier - 0.2) / 2.8));

  return {
    tld,
    profile,
    riskScore,
    category: profile.category,
    hasProfile: true,
  };
}

/**
 * Get TLD category
 */
export function getTLDCategory(domain: string): string {
  const tld = extractTLD(domain);
  const profile = TLD_RISK_PROFILES.get(tld);
  return profile?.category || 'unknown';
}

/**
 * Check if TLD is high risk
 */
export function isHighRiskTLD(domain: string): boolean {
  const analysis = analyzeTLDRisk(domain);
  return analysis.riskScore > 0.7 || analysis.category === 'high_risk';
}

/**
 * Check if TLD is trusted
 */
export function isTrustedTLD(domain: string): boolean {
  const analysis = analyzeTLDRisk(domain);
  return analysis.category === 'trusted';
}

/**
 * Get all high-risk TLDs
 */
export function getHighRiskTLDs(): string[] {
  return Array.from(TLD_RISK_PROFILES.entries())
    .filter(([, profile]) => profile.category === 'high_risk')
    .map(([tld]) => tld);
}

/**
 * Get TLD statistics
 */
export function getTLDStats(): {
  total: number;
  trusted: number;
  standard: number;
  suspicious: number;
  highRisk: number;
} {
  const profiles = Array.from(TLD_RISK_PROFILES.values());

  return {
    total: profiles.length,
    trusted: profiles.filter(p => p.category === 'trusted').length,
    standard: profiles.filter(p => p.category === 'standard').length,
    suspicious: profiles.filter(p => p.category === 'suspicious').length,
    highRisk: profiles.filter(p => p.category === 'high_risk').length,
  };
}
