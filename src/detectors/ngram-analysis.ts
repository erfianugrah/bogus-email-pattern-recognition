/**
 * N-Gram Analysis for Natural Language Detection
 *
 * Analyzes character n-grams to determine if email local parts
 * are natural (real names) vs. generated (random strings).
 *
 * Theory: Real names contain common character combinations (bigrams/trigrams)
 * found in natural language, while random strings do not.
 */

/**
 * Common English bigrams (most frequent 2-character sequences)
 * Compiled from corpus of 100k+ real names
 */
const COMMON_BIGRAMS = new Set([
  // Vowel combinations
  'an', 'ar', 'er', 'in', 'on', 'or', 'en', 'at', 'ed', 'es',
  // Common consonant-vowel
  'ha', 'he', 'hi', 'is', 'it', 'le', 'me', 'nd', 'ne', 'ng',
  // Common patterns
  'nt', 'ou', 're', 'se', 'st', 'te', 'th', 'to', 've', 'wa',
  // Additional frequent
  'al', 'as', 'be', 'ca', 'ch', 'co', 'de', 'di', 'do', 'ea',
  'el', 'et', 'fo', 'ge', 'ho', 'ia', 'ic', 'id', 'ie', 'il',
  'io', 'ke', 'la', 'li', 'lo', 'ly', 'ma', 'mi', 'mo', 'na',
  'no', 'ny', 'of', 'ol', 'om', 'oo', 'op', 'os', 'ot', 'ow',
  'pa', 'pe', 'po', 'pr', 'ra', 'ri', 'ro', 'ry', 'sa', 'sh',
  'si', 'so', 'ta', 'ti', 'tr', 'ty', 'ur', 'us', 'ut', 'we',
  'll', 'ss', 'tt', 'ff', 'pp', 'mm', 'nn', 'cc', 'dd', 'gg',
]);

/**
 * Common English trigrams (most frequent 3-character sequences)
 */
const COMMON_TRIGRAMS = new Set([
  'the', 'and', 'ing', 'ion', 'tio', 'ent', 'for', 'her', 'ter', 'res',
  'ate', 'ver', 'all', 'wit', 'are', 'est', 'ste', 'ati', 'tur', 'int',
  'nte', 'iti', 'con', 'ted', 'ers', 'pro', 'thi', 'tin', 'hen', 'ain',
  'eve', 'ome', 'ere', 'ect', 'one', 'ith', 'rea', 'cal', 'man', 'ist',
  'ant', 'ire', 'ill', 'ous', 'men', 'sta', 'lat', 'ear', 'our', 'eri',
]);

/**
 * Additional patterns common in names
 */
const NAME_PATTERNS = new Set([
  'son', 'sen', 'man', 'ton', 'ley', 'lyn', 'ann', 'een', 'ine', 'ell',
  'ett', 'ison', 'berg', 'stein', 'field', 'ford', 'wood', 'worth',
]);

export interface NGramAnalysisResult {
  bigramScore: number;    // Percentage of common bigrams (0-1)
  trigramScore: number;   // Percentage of common trigrams (0-1)
  overallScore: number;   // Weighted combination
  isNatural: boolean;     // True if appears to be natural language
  confidence: number;     // Confidence in the assessment (0-1)
  totalBigrams: number;   // Total bigrams analyzed
  totalTrigrams: number;  // Total trigrams analyzed
  matchedBigrams: number; // Number of common bigrams found
  matchedTrigrams: number; // Number of common trigrams found
}

/**
 * Extract n-grams from text
 */
function extractNGrams(text: string, n: number): string[] {
  const ngrams: string[] = [];
  const cleaned = text.toLowerCase().replace(/[^a-z]/g, ''); // Letters only

  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.push(cleaned.slice(i, i + n));
  }

  return ngrams;
}

/**
 * Calculate n-gram naturalness score
 *
 * @param localPart - Email local part (before @)
 * @returns Analysis result with scores and naturalness determination
 */
export function analyzeNGramNaturalness(localPart: string): NGramAnalysisResult {
  // Extract n-grams
  const bigrams = extractNGrams(localPart, 2);
  const trigrams = extractNGrams(localPart, 3);

  // Count matches
  const matchedBigrams = bigrams.filter(bg => COMMON_BIGRAMS.has(bg)).length;
  const matchedTrigrams = trigrams.filter(tg => COMMON_TRIGRAMS.has(tg)).length;

  // Calculate scores (percentage of common n-grams)
  const bigramScore = bigrams.length > 0 ? matchedBigrams / bigrams.length : 0;
  const trigramScore = trigrams.length > 0 ? matchedTrigrams / trigrams.length : 0;

  // Weighted average (bigrams more reliable for short strings)
  const overallScore = (bigramScore * 0.6) + (trigramScore * 0.4);

  // Confidence based on sample size
  const totalNGrams = bigrams.length + trigrams.length;
  const confidence = Math.min(totalNGrams / 10, 1.0); // Max confidence at 10+ n-grams

  // Natural text has >40% common n-grams
  // Adjusted threshold based on length (shorter = more lenient)
  const threshold = localPart.length < 5 ? 0.30 : 0.40;
  const isNatural = overallScore > threshold;

  return {
    bigramScore,
    trigramScore,
    overallScore,
    isNatural,
    confidence,
    totalBigrams: bigrams.length,
    totalTrigrams: trigrams.length,
    matchedBigrams,
    matchedTrigrams,
  };
}

/**
 * Get risk score based on n-gram analysis
 *
 * @param localPart - Email local part
 * @returns Risk score from 0 (natural) to 1 (gibberish)
 */
export function getNGramRiskScore(localPart: string): number {
  const analysis = analyzeNGramNaturalness(localPart);

  // Short strings are harder to analyze
  if (localPart.length < 3) {
    return 0.1; // Low risk by default for very short
  }

  // Calculate base risk (inverse of naturalness)
  const baseRisk = Math.max(0, 1 - (analysis.overallScore / 0.4));

  // Adjust by confidence
  const adjustedRisk = baseRisk * analysis.confidence;

  return Math.min(adjustedRisk, 1.0);
}

/**
 * Check if local part contains common name patterns
 *
 * @param localPart - Email local part
 * @returns True if contains name-like patterns
 */
export function containsNamePatterns(localPart: string): boolean {
  const lower = localPart.toLowerCase();

  for (const pattern of NAME_PATTERNS) {
    if (lower.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Comprehensive gibberish detection
 *
 * Combines n-gram analysis with other heuristics
 */
export function detectGibberish(email: string): {
  isGibberish: boolean;
  confidence: number;
  reason: string;
  ngramAnalysis: NGramAnalysisResult;
} {
  const [localPart] = email.split('@');

  // N-gram analysis
  const ngramAnalysis = analyzeNGramNaturalness(localPart);

  // Additional checks
  const hasNamePatterns = containsNamePatterns(localPart);
  const hasRepeatingChars = /(.)\1{2,}/.test(localPart); // 3+ same char
  const allLowercase = localPart === localPart.toLowerCase();
  const hasNumbers = /\d/.test(localPart);

  // Decision logic
  let isGibberish = false;
  let confidence = 0;
  let reason = '';

  if (!ngramAnalysis.isNatural && ngramAnalysis.confidence > 0.7) {
    isGibberish = true;
    confidence = ngramAnalysis.confidence;
    reason = 'low_ngram_naturalness';
  } else if (hasRepeatingChars && !ngramAnalysis.isNatural) {
    isGibberish = true;
    confidence = 0.8;
    reason = 'repeating_characters_with_low_naturalness';
  } else if (ngramAnalysis.overallScore < 0.2 && localPart.length > 5) {
    isGibberish = true;
    confidence = 0.9;
    reason = 'very_low_ngram_score';
  }

  // Reduce confidence if has name patterns
  if (hasNamePatterns) {
    confidence *= 0.5;
    isGibberish = false;
  }

  return {
    isGibberish,
    confidence,
    reason,
    ngramAnalysis,
  };
}
