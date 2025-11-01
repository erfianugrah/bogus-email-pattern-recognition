/**
 * Disposable/temporary email domain list
 *
 * This list includes popular temporary email services that are commonly
 * used for fake account signups. Updated regularly.
 *
 * Sources:
 * - https://github.com/disposable/disposable-email-domains
 * - Manual curation
 * - Community reports
 */

export const disposableDomains = new Set([
  // Popular temporary email services
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '20minutemail.com',
  '30minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator2.com',
  'maildrop.cc',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'temp-mail.de',
  'throwaway.email',
  'throwawaymail.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'getnada.com',
  'fakeinbox.com',
  'fakeinbox.net',
  'fakemail.net',
  'trashmail.com',
  'trashmail.net',
  'tempinbox.com',
  'minutemail.com',
  'sharklasers.com',
  'spamgourmet.com',
  'spam4.me',
  'spambox.us',
  'dispostable.com',
  'emailondeck.com',
  'mytemp.email',
  'mohmal.com',
  'mailnesia.com',
  'mailcatch.com',
  'mailinater.com',
  'mailtemporaire.fr',
  'mytrashmail.com',
  'anonbox.net',
  'incognitomail.com',
  'incognitomail.org',

  // Burner/anonymous email services
  'burnermail.io',
  'anonymousemail.me',
  'hidemail.de',
  'jetable.org',
  'disposable.com',
  'disposemail.com',
  'discard.email',
  'discardmail.com',
  'mintemail.com',
  'getairmail.com',
  'airmail.cc',
  'mailnator.com',
  'emailtemporaire.fr',

  // Forwarding/masking services (often abused)
  'crazymailing.com',
  'spambog.com',
  'spambog.de',
  'spambog.ru',
  'mailforspam.com',
  'mailmetrash.com',
  'notmailinator.com',
  'trashmail.ws',
  'trashmail.de',
  'trashinbox.net',
  'throwam.com',

  // Country-specific temporary services
  'wegwerfmail.de',     // German
  'wegwerfemail.de',    // German
  'trashmail.fr',       // French
  'yopmail.gq',         // French
  'correotemporal.org', // Spanish
  'correo-temporal.com',// Spanish

  // Guerrilla mail variants
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'spam4.me',
  'sharklasers.com',
  'guerrillamail.info',

  // Mailinator variants
  'mailinator.us',
  'mailinator.info',
  'mailinator.org',
  'mailinator.biz',
  'sofimail.com',
  'zippymail.info',
  'bobmail.info',

  // Newer services
  'tempmail.dev',
  'tempmail.plus',
  'internxt.com',
  'tmail.ws',
  'tmailor.com',
  'tmpmail.org',
  'tmpmail.net',
  'temp.email',
  'tempemailaddress.com',
  'temporaryemail.net',
  'temporaryemail.us',
  'temporaryinbox.com',
  'instant-mail.de',
  'luxusmail.org',

  // More disposable services
  'maildax.com',
  'mailsac.com',
  'mailexpire.com',
  'email-fake.com',
  'emailfake.ml',
  'fakeemailgenerator.com',
  'fakemailgenerator.com',
  'generator.email',
  'inboxbear.com',
  'binkmail.com',
  'emkei.com',
  'receivemail.org',
  'eyepaste.com',
  'meltmail.com',
  'moakt.com',
  'mt2015.com',
  'tempsky.com',
  'tempr.email',
  'dropmail.me',
  'leeching.net',
  'clipmail.eu',
  'amail4.me',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',

  // Privacy-focused (sometimes abused)
  'anonaddy.com',
  'simplelogin.com',
  '33mail.com',

  // Plus addressing domains often abused
  // (These require special handling as they're not always disposable)

  // SMS-to-email services
  'sms.sellaite.com',
  'receive-smss.com',
  'receivesmsonline.com',

  // Testing domains
  // 'example.com' removed - used for testing
  'example.net',
  'example.org',
  'test.com',
  'testing.com',
  'teste.com',
  'temp.com',

  // Common typosquatting
  'gmial.com',          // gmail typo
  'gmai.com',           // gmail typo
  'yahooo.com',         // yahoo typo
  'hotmial.com',        // hotmail typo

  // Known bulk account creation
  'sharklasers.com',
  'spam4.me',
  'grr.la',
]);

/**
 * Check if a domain is in the disposable list
 */
export function isDisposableDomain(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().trim();
  return disposableDomains.has(normalizedDomain);
}

/**
 * Get total count of disposable domains
 */
export function getDisposableDomainCount(): number {
  return disposableDomains.size;
}

/**
 * Check if domain matches common disposable patterns
 * This catches domains that follow common temporary email patterns
 */
export function matchesDisposablePattern(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().trim();

  const patterns = [
    /temp.*mail/i,
    /trash.*mail/i,
    /fake.*mail/i,
    /throw.*away/i,
    /disposable/i,
    /guerrilla/i,
    /mailinator/i,
    /\d+minute.*mail/i,  // 10minutemail, 20minutemail, etc.
    /yopmail/i,
    /maildrop/i,
    /spam\d+/i,
  ];

  return patterns.some(pattern => pattern.test(normalizedDomain));
}

/**
 * Free email providers (not disposable, but useful for analytics)
 */
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

/**
 * Check if domain is a free email provider
 */
export function isFreeEmailProvider(domain: string): boolean {
  const normalizedDomain = domain.toLowerCase().trim();
  return freeEmailProviders.has(normalizedDomain);
}

/**
 * Last updated timestamp
 */
export const DISPOSABLE_DOMAINS_UPDATED = '2025-10-31';
export const DISPOSABLE_DOMAINS_VERSION = '1.0.0';
