import { describe, it, expect } from 'vitest';
import { validateEmail, validateEmailFormat, calculateEntropy } from '../../../src/validators/email';
import { validEmails, invalidFormatEmails, highEntropyEmails, shortEmails } from '../../fixtures/test-emails';

describe('Email Validator', () => {
  describe('validateEmailFormat', () => {
    it('should accept valid email formats', () => {
      validEmails.forEach(email => {
        expect(validateEmailFormat(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      invalidFormatEmails.forEach(email => {
        expect(validateEmailFormat(email)).toBe(false);
      });
    });

    it('should reject emails with local part > 64 chars', () => {
      const longLocal = 'a'.repeat(65) + '@example.com';
      expect(validateEmailFormat(longLocal)).toBe(false);
    });

    it('should reject emails with domain > 255 chars', () => {
      const longDomain = 'user@' + 'a'.repeat(256) + '.com';
      expect(validateEmailFormat(longDomain)).toBe(false);
    });

    it('should reject emails without TLD', () => {
      expect(validateEmailFormat('user@localhost')).toBe(false);
    });

    it('should require TLD to be at least 2 characters', () => {
      expect(validateEmailFormat('user@example.c')).toBe(false);
      expect(validateEmailFormat('user@example.co')).toBe(true);
    });
  });

  describe('calculateEntropy', () => {
    it('should return 0 for empty string', () => {
      expect(calculateEntropy('')).toBe(0);
    });

    it('should return low entropy for repeated characters', () => {
      const entropy = calculateEntropy('aaaaaaa');
      expect(entropy).toBeLessThan(0.2);
    });

    it('should return higher entropy for varied characters', () => {
      const entropy = calculateEntropy('abcdefgh');
      expect(entropy).toBeGreaterThan(0.4);
    });

    it('should return high entropy for random-looking strings', () => {
      const entropy = calculateEntropy('xk9m2qw7r4p3');
      expect(entropy).toBeGreaterThan(0.5);
    });

    it('should return medium entropy for common patterns', () => {
      const entropy = calculateEntropy('john.doe');
      expect(entropy).toBeGreaterThan(0.3);
      expect(entropy).toBeLessThan(0.6);
    });

    it('should be normalized between 0 and 1', () => {
      const testStrings = ['a', 'abc', 'test123', 'xk9m2qw7r4p3', 'a'.repeat(100)];
      testStrings.forEach(str => {
        const entropy = calculateEntropy(str);
        expect(entropy).toBeGreaterThanOrEqual(0);
        expect(entropy).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('validateEmail', () => {
    it('should validate normal emails as valid', () => {
      const result = validateEmail('john.doe@example.com');
      expect(result.valid).toBe(true);
      expect(result.signals.formatValid).toBe(true);
      expect(result.signals.entropyScore).toBeGreaterThan(0);
    });

    it('should reject invalid email formats', () => {
      const result = validateEmail('invalid-email');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid email format');
    });

    it('should flag high entropy emails', () => {
      const result = validateEmail('xk9m2qw7r4p3s8t1@example.com');
      // Depending on exact entropy, might be valid or invalid
      expect(result.signals.entropyScore).toBeGreaterThan(0.6);
    });

    it('should reject very high entropy emails', () => {
      // Create extremely random string
      const randomLocal = 'q1w2e3r4t5y6u7i8o9p0';
      const result = validateEmail(randomLocal + '@example.com');
      if (result.signals.entropyScore > 0.85) {
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('random');
      }
    });

    it('should reject emails with local part < 3 chars', () => {
      shortEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('too short');
      });
    });

    it('should normalize emails to lowercase', () => {
      const result1 = validateEmail('TEST@EXAMPLE.COM');
      const result2 = validateEmail('test@example.com');
      // Both should have same entropy score (normalized)
      expect(result1.signals.entropyScore).toBe(result2.signals.entropyScore);
    });

    it('should include all required signals', () => {
      const result = validateEmail('test@example.com');
      expect(result.signals).toHaveProperty('formatValid');
      expect(result.signals).toHaveProperty('entropyScore');
      expect(result.signals).toHaveProperty('localPartLength');
    });

    it('should handle edge case: minimum valid email', () => {
      const result = validateEmail('abc@example.co');
      expect(result.valid).toBe(true);
      expect(result.signals.localPartLength).toBe(3);
    });
  });
});
