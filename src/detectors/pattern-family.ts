/**
 * Pattern Family Extractor
 *
 * Combines all pattern detectors to extract a "pattern family" signature
 * that groups similar emails together regardless of specific values.
 *
 * Examples:
 * - "john.doe.2024@gmail.com" → family: "name.name.YEAR@gmail"
 * - "jane.smith.2024@gmail.com" → SAME family (both firstname.lastname.YEAR)
 * - "user123@yahoo.com" → family: "word.NUM@yahoo"
 * - "user456@yahoo.com" → SAME family
 *
 * This allows tracking abuse patterns across multiple accounts.
 */

import { detectSequentialPattern, getSequentialPatternFamily } from './sequential';
import { detectDatedPattern, getDatedPatternFamily } from './dated';
import { normalizeEmail } from './plus-addressing';

export type PatternType =
  | 'sequential'       // user1, user2, user3
  | 'dated'           // firstname.lastname.2024
  | 'plus-addressing' // user+1, user+2
  | 'formatted'       // firstname.lastname, first.last
  | 'random'          // xk9m2qw7r4p3
  | 'simple'          // john, test, admin
  | 'unknown';

export interface PatternFamilyResult {
  family: string;          // Pattern family signature
  familyHash: string;      // SHA-256 hash of family (for indexing)
  patternType: PatternType;
  confidence: number;      // 0.0-1.0
  metadata: {
    normalizedEmail: string;
    hasSequential: boolean;
    hasDated: boolean;
    hasPlusAddressing: boolean;
    localPartStructure: string; // Structure description
    domainType: 'free' | 'business' | 'disposable' | 'unknown';
  };
}

/**
 * Extract the pattern family for an email address
 */
export async function extractPatternFamily(email: string): Promise<PatternFamilyResult> {
  const normalized = normalizeEmail(email);
  const [localPart, domain] = normalized.normalized.split('@');

  // Run all detectors
  const sequentialResult = detectSequentialPattern(email);
  const datedResult = detectDatedPattern(email);

  // Determine primary pattern type
  let patternType: PatternType = 'unknown';
  let familyString = '';
  let confidence = 0.0;

  // Priority 1: Dated patterns (highest confidence when detected)
  if (datedResult.hasDatedPattern && datedResult.confidence >= 0.6) {
    patternType = 'dated';
    confidence = datedResult.confidence;

    // Create family: base pattern + date type + domain
    const dateToken = datedResult.dateType === 'year' ? 'YEAR' :
                      datedResult.dateType === 'short-year' ? 'YY' :
                      datedResult.dateType === 'month-year' ? 'MONTH-YEAR' :
                      datedResult.dateType === 'full-date' ? 'DATE' : 'DATE';

    const baseStructure = analyzeStructure(datedResult.basePattern);
    familyString = `${baseStructure}.${dateToken}@${domain}`;
  }
  // Priority 2: Sequential patterns
  else if (sequentialResult.isSequential && sequentialResult.confidence >= 0.5) {
    patternType = 'sequential';
    confidence = sequentialResult.confidence;

    const baseStructure = analyzeStructure(sequentialResult.basePattern);
    familyString = `${baseStructure}.NUM@${domain}`;
  }
  // Priority 3: Plus-addressing
  else if (normalized.hasPlus) {
    patternType = 'plus-addressing';
    confidence = normalized.metadata?.suspiciousTag ? 0.7 : 0.5;

    const baseStructure = analyzeStructure(normalized.normalized.split('@')[0]);
    familyString = `${baseStructure}+TAG@${domain}`;
  }
  // Priority 4: Analyze structure
  else {
    const structure = analyzeStructure(localPart);

    // Check if it looks random (high entropy, no clear structure)
    if (isRandomPattern(localPart)) {
      patternType = 'random';
      confidence = 0.6;
      familyString = `RANDOM@${domain}`;
    }
    // Check if it has clear formatting (dots, underscores)
    else if (hasFormatting(localPart)) {
      patternType = 'formatted';
      confidence = 0.4;
      familyString = `${structure}@${domain}`;
    }
    // Simple pattern
    else {
      patternType = 'simple';
      confidence = 0.3;
      familyString = `${structure}@${domain}`;
    }
  }

  // Generate hash of family for indexing
  const familyHash = await hashString(familyString);

  // Classify domain type
  const domainType = classifyDomain(domain);

  return {
    family: familyString,
    familyHash,
    patternType,
    confidence,
    metadata: {
      normalizedEmail: normalized.normalized,
      hasSequential: sequentialResult.isSequential,
      hasDated: datedResult.hasDatedPattern,
      hasPlusAddressing: normalized.hasPlus,
      localPartStructure: analyzeStructure(localPart),
      domainType
    }
  };
}

/**
 * Analyze the structure of a local part and create a pattern
 */
function analyzeStructure(localPart: string): string {
  // Replace actual names/words with tokens
  const parts = localPart.split(/[._-]/);

  if (parts.length === 1) {
    // Single word
    if (localPart.length <= 4) {
      return 'SHORT';
    } else if (isNameLike(localPart)) {
      return 'NAME';
    } else {
      return 'WORD';
    }
  }

  // Multiple parts separated by dots/underscores/hyphens
  const tokens = parts.map(part => {
    if (/^\d+$/.test(part)) {
      return 'NUM';
    } else if (isNameLike(part)) {
      return 'NAME';
    } else if (part.length <= 3) {
      return 'SHORT';
    } else {
      return 'WORD';
    }
  });

  return tokens.join('.');
}

/**
 * Check if a string looks like a name (lowercase letters only, reasonable length)
 */
function isNameLike(str: string): boolean {
  // Names are typically 2-15 characters, lowercase letters only
  return /^[a-z]{2,15}$/.test(str) && !isCommonTestWord(str);
}

/**
 * Check if a string is a common test/fake word
 */
function isCommonTestWord(str: string): boolean {
  const testWords = [
    'test', 'temp', 'fake', 'spam', 'admin', 'root', 'demo',
    'trial', 'sample', 'example', 'null', 'void'
  ];
  return testWords.includes(str.toLowerCase());
}

/**
 * Check if pattern looks random (high entropy, no clear structure)
 */
function isRandomPattern(localPart: string): boolean {
  // Calculate basic entropy
  const chars = new Set(localPart.split(''));
  const entropy = chars.size / localPart.length;

  // High character diversity
  if (entropy > 0.7 && localPart.length >= 8) {
    return true;
  }

  // Mix of letters and numbers with no clear pattern
  const hasLetters = /[a-z]/.test(localPart);
  const hasNumbers = /\d/.test(localPart);
  const hasNoStructure = !hasFormatting(localPart);

  return hasLetters && hasNumbers && hasNoStructure && localPart.length >= 8;
}

/**
 * Check if local part has clear formatting (dots, underscores, hyphens)
 */
function hasFormatting(localPart: string): boolean {
  return /[._-]/.test(localPart);
}

/**
 * Classify domain type
 */
function classifyDomain(domain: string): 'free' | 'business' | 'disposable' | 'unknown' {
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'icloud.com', 'aol.com', 'protonmail.com', 'mail.com'
  ];

  const disposableKeywords = [
    'temp', 'trash', 'disposable', 'throwaway', 'fake',
    'guerrilla', 'mailinator', 'minute'
  ];

  if (freeProviders.includes(domain)) {
    return 'free';
  }

  if (disposableKeywords.some(kw => domain.includes(kw))) {
    return 'disposable';
  }

  // Business domains typically have company names, not generic words
  // This is a simplified check
  if (!domain.includes('mail') && domain.split('.').length === 2) {
    return 'business';
  }

  return 'unknown';
}

/**
 * Hash a string using SHA-256
 */
async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Batch analysis: find common pattern families across multiple emails
 */
export async function analyzePatternFamilies(emails: string[]): Promise<{
  families: Map<string, string[]>; // family -> emails
  topFamily: { family: string; count: number; emails: string[] } | null;
  suspiciousFamilies: Array<{ family: string; count: number; patternType: PatternType }>;
}> {
  const families = new Map<string, string[]>();
  const patternTypes = new Map<string, PatternType>();

  for (const email of emails) {
    const result = await extractPatternFamily(email);
    const family = result.family;

    if (!families.has(family)) {
      families.set(family, []);
      patternTypes.set(family, result.patternType);
    }
    families.get(family)!.push(email);
  }

  // Find top family
  let topFamily: { family: string; count: number; emails: string[] } | null = null;
  let maxCount = 0;

  for (const [family, emails] of families.entries()) {
    if (emails.length > maxCount) {
      maxCount = emails.length;
      topFamily = { family, count: emails.length, emails };
    }
  }

  // Find suspicious families (multiple emails, suspicious pattern type)
  const suspiciousFamilies: Array<{ family: string; count: number; patternType: PatternType }> = [];

  for (const [family, emails] of families.entries()) {
    const patternType = patternTypes.get(family)!;

    // Consider suspicious if:
    // - 3+ emails in same family with sequential/dated pattern
    // - 5+ emails in same family with any pattern
    if (
      (emails.length >= 3 && (patternType === 'sequential' || patternType === 'dated')) ||
      emails.length >= 5
    ) {
      suspiciousFamilies.push({
        family,
        count: emails.length,
        patternType
      });
    }
  }

  // Sort by count
  suspiciousFamilies.sort((a, b) => b.count - a.count);

  return {
    families,
    topFamily,
    suspiciousFamilies
  };
}

/**
 * Calculate risk score contribution from pattern analysis
 */
export function getPatternRiskScore(result: PatternFamilyResult): number {
  let risk = 0.0;

  // Base risk by pattern type
  switch (result.patternType) {
    case 'sequential':
      risk += 0.4;
      break;
    case 'dated':
      risk += 0.35;
      break;
    case 'plus-addressing':
      risk += 0.3;
      break;
    case 'random':
      risk += 0.25;
      break;
    case 'formatted':
      risk += 0.1;
      break;
    case 'simple':
      risk += 0.05;
      break;
  }

  // Add confidence-weighted risk
  risk += result.confidence * 0.3;

  // Free email providers with suspicious patterns are riskier
  if (result.metadata.domainType === 'free' &&
      (result.patternType === 'sequential' || result.patternType === 'dated')) {
    risk += 0.2;
  }

  // Disposable domains
  if (result.metadata.domainType === 'disposable') {
    risk += 0.4;
  }

  return Math.min(risk, 1.0);
}
