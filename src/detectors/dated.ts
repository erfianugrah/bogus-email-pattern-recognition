/**
 * Dated Pattern Detector
 *
 * Detects email patterns with date or year components like:
 * - john.doe.2024@gmail.com, jane.smith.2024@gmail.com
 * - user_oct2024@yahoo.com, user_nov2024@yahoo.com
 * - firstname.lastname.20241031@domain.com
 *
 * These patterns are common in automated account creation campaigns
 * where attackers append timestamps to legitimate-looking names.
 */

export interface DatedPatternResult {
  hasDatedPattern: boolean;
  basePattern: string;       // "firstname.lastname" from "firstname.lastname.2024"
  dateComponent: string | null; // "2024", "oct2024", "20241031"
  dateType: 'year' | 'month-year' | 'full-date' | 'short-year' | 'none';
  confidence: number;        // 0.0-1.0
  metadata?: {
    year?: number;
    month?: string;
    position: 'trailing' | 'middle' | 'leading';
  };
}

// Common month abbreviations and names
const MONTHS = [
  'jan', 'january', 'feb', 'february', 'mar', 'march',
  'apr', 'april', 'may', 'jun', 'june',
  'jul', 'july', 'aug', 'august', 'sep', 'sept', 'september',
  'oct', 'october', 'nov', 'november', 'dec', 'december'
];

const MONTH_PATTERN = MONTHS.join('|');

/**
 * Detects if an email contains date/year patterns
 */
export function detectDatedPattern(email: string): DatedPatternResult {
  const normalizedEmail = email.toLowerCase().trim();
  const [localPart] = normalizedEmail.split('@');

  if (!localPart || localPart.length < 4) {
    return {
      hasDatedPattern: false,
      basePattern: localPart || '',
      dateComponent: null,
      dateType: 'none',
      confidence: 0.0
    };
  }

  // Pattern 1: Four-digit year (2024, 2025, etc.)
  // Examples: john.doe.2024, user_2025, firstname.lastname.2024
  const yearPattern = /^(.+?)[._-]?(20\d{2}|19\d{2})([._-].+)?$/;
  const yearMatch = localPart.match(yearPattern);

  if (yearMatch) {
    const [, prefix, yearStr, suffix] = yearMatch;
    const year = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();

    // Only consider years within reasonable range (current year ± 5)
    if (year >= currentYear - 5 && year <= currentYear + 5) {
      let confidence = 0.7; // Base confidence for 4-digit year

      // Higher confidence if it's the current or next year
      if (year === currentYear || year === currentYear + 1) {
        confidence += 0.2;
      }

      // Higher confidence if year is at the end (most common pattern)
      if (!suffix) {
        confidence += 0.1;
      }

      const position = suffix ? 'middle' : 'trailing';
      const basePattern = suffix ? `${prefix}.[YEAR].${suffix.substring(1)}` : prefix;

      return {
        hasDatedPattern: true,
        basePattern,
        dateComponent: yearStr,
        dateType: 'year',
        confidence: Math.min(confidence, 1.0),
        metadata: {
          year,
          position
        }
      };
    }
  }

  // Pattern 2: Two-digit year (24, 25)
  // Examples: john.doe.24, user_25
  const shortYearPattern = /^(.+?)[._-]?(\d{2})$/;
  const shortYearMatch = localPart.match(shortYearPattern);

  if (shortYearMatch) {
    const [, prefix, yearStr] = shortYearMatch;
    const year = parseInt(yearStr, 10);
    const currentYearShort = new Date().getFullYear() % 100;

    // Only years close to current (e.g., 23, 24, 25, 26)
    if (Math.abs(year - currentYearShort) <= 3) {
      // Lower confidence than full year (could be other things)
      let confidence = 0.5;

      if (year === currentYearShort || year === currentYearShort + 1) {
        confidence += 0.15;
      }

      // Need longer base to be confident (avoid false positives)
      if (prefix.length >= 5) {
        confidence += 0.1;
      }

      return {
        hasDatedPattern: true,
        basePattern: prefix,
        dateComponent: yearStr,
        dateType: 'short-year',
        confidence: Math.min(confidence, 1.0),
        metadata: {
          year: 2000 + year,
          position: 'trailing'
        }
      };
    }
  }

  // Pattern 3: Month + Year (oct2024, jan2025, 102024, 012025)
  // Examples: user_oct2024, firstname.lastname.jan2025, test_012025
  const monthYearPattern = new RegExp(
    `^(.+?)[._-]?((?:${MONTH_PATTERN})|(?:\\d{2}))(20\\d{2})([._-].+)?$`,
    'i'
  );
  const monthYearMatch = localPart.match(monthYearPattern);

  if (monthYearMatch) {
    const [, prefix, monthStr, yearStr, suffix] = monthYearMatch;
    const year = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();

    if (year >= currentYear - 2 && year <= currentYear + 2) {
      let confidence = 0.8; // High confidence for month+year

      // Very suspicious pattern for account generation
      if (year === currentYear || year === currentYear + 1) {
        confidence += 0.15;
      }

      const position = suffix ? 'middle' : 'trailing';
      const basePattern = suffix ? `${prefix}.[MONTH-YEAR].${suffix.substring(1)}` : prefix;

      return {
        hasDatedPattern: true,
        basePattern,
        dateComponent: `${monthStr}${yearStr}`,
        dateType: 'month-year',
        confidence: Math.min(confidence, 1.0),
        metadata: {
          year,
          month: monthStr,
          position
        }
      };
    }
  }

  // Pattern 4: Full date (20241031, 2024-10-31, 2024_10_31)
  // Examples: user_20241031, firstname.lastname.2024-10-31
  const fullDatePattern = /^(.+?)[._-]?(20\d{2})[._-]?(\d{2})[._-]?(\d{2})([._-].+)?$/;
  const fullDateMatch = localPart.match(fullDatePattern);

  if (fullDateMatch) {
    const [, prefix, yearStr, monthStr, dayStr, suffix] = fullDateMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Validate date ranges
    if (
      year >= 2020 && year <= 2030 &&
      month >= 1 && month <= 12 &&
      day >= 1 && day <= 31
    ) {
      // Very high confidence - full dates are rare in legitimate emails
      let confidence = 0.9;

      const position = suffix ? 'middle' : 'trailing';
      const basePattern = suffix ? `${prefix}.[DATE].${suffix.substring(1)}` : prefix;

      return {
        hasDatedPattern: true,
        basePattern,
        dateComponent: `${yearStr}${monthStr}${dayStr}`,
        dateType: 'full-date',
        confidence: Math.min(confidence, 1.0),
        metadata: {
          year,
          month: monthStr,
          position
        }
      };
    }
  }

  // Pattern 5: Leading year (less common but exists)
  // Examples: 2024.john.doe, 2025_username
  const leadingYearPattern = /^(20\d{2}|19\d{2})[._-](.+)$/;
  const leadingYearMatch = localPart.match(leadingYearPattern);

  if (leadingYearMatch) {
    const [, yearStr, suffix] = leadingYearMatch;
    const year = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();

    if (year >= currentYear - 5 && year <= currentYear + 5) {
      // Lower confidence for leading years (less common)
      let confidence = 0.6;

      if (year === currentYear || year === currentYear + 1) {
        confidence += 0.15;
      }

      return {
        hasDatedPattern: true,
        basePattern: suffix,
        dateComponent: yearStr,
        dateType: 'year',
        confidence: Math.min(confidence, 1.0),
        metadata: {
          year,
          position: 'leading'
        }
      };
    }
  }

  // No dated pattern detected
  return {
    hasDatedPattern: false,
    basePattern: localPart,
    dateComponent: null,
    dateType: 'none',
    confidence: 0.0
  };
}

/**
 * Extract a normalized pattern family string for dated patterns
 * This allows grouping: john.doe.2024, jane.smith.2024 → "NAME.NAME.[YEAR]"
 */
export function getDatedPatternFamily(email: string): string | null {
  const result = detectDatedPattern(email);

  if (!result.hasDatedPattern) {
    return null;
  }

  const [, domain] = email.toLowerCase().split('@');
  const typeToken = result.dateType === 'year' || result.dateType === 'short-year'
    ? '[YEAR]'
    : result.dateType === 'month-year'
    ? '[MONTH-YEAR]'
    : '[DATE]';

  // Normalize the pattern - replace actual name with PATTERN
  return `[PATTERN].${typeToken}@${domain}`;
}

/**
 * Batch analysis: detect if multiple emails follow the same dated pattern
 */
export function analyzeDatedBatch(emails: string[]): {
  hasDatedPattern: boolean;
  patternFamily: string | null;
  confidence: number;
  matchingEmails: string[];
  dateComponents: string[];
} {
  if (emails.length < 2) {
    return {
      hasDatedPattern: false,
      patternFamily: null,
      confidence: 0.0,
      matchingEmails: [],
      dateComponents: []
    };
  }

  const patterns = new Map<string, { emails: string[]; dates: string[] }>();

  for (const email of emails) {
    const result = detectDatedPattern(email);
    if (result.hasDatedPattern) {
      const family = getDatedPatternFamily(email);
      if (family) {
        if (!patterns.has(family)) {
          patterns.set(family, { emails: [], dates: [] });
        }
        const entry = patterns.get(family)!;
        entry.emails.push(email);
        if (result.dateComponent) {
          entry.dates.push(result.dateComponent);
        }
      }
    }
  }

  // Find the most common pattern
  let maxCount = 0;
  let dominantPattern: string | null = null;
  let matchingEmails: string[] = [];
  let dateComponents: string[] = [];

  for (const [pattern, data] of patterns.entries()) {
    if (data.emails.length > maxCount) {
      maxCount = data.emails.length;
      dominantPattern = pattern;
      matchingEmails = data.emails;
      dateComponents = data.dates;
    }
  }

  if (!dominantPattern || maxCount < 2) {
    return {
      hasDatedPattern: false,
      patternFamily: null,
      confidence: 0.0,
      matchingEmails: [],
      dateComponents: []
    };
  }

  // Very high confidence if multiple emails share same dated pattern
  // This is a strong signal of automated generation
  let confidence = 0.7 + (maxCount * 0.1);
  confidence = Math.min(confidence, 1.0);

  return {
    hasDatedPattern: true,
    patternFamily: dominantPattern,
    confidence,
    matchingEmails,
    dateComponents
  };
}

/**
 * Check if date component is suspiciously recent/current
 */
export function isCurrentDatePattern(dateComponent: string): boolean {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Check for current year
  if (dateComponent.includes(currentYear.toString())) {
    return true;
  }

  // Check for current month abbreviations
  const currentMonthName = new Date().toLocaleString('en', { month: 'short' }).toLowerCase();
  if (dateComponent.includes(currentMonthName)) {
    return true;
  }

  return false;
}
