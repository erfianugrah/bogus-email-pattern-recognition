export interface ValidationResult {
  valid: boolean;
  riskScore: number;
  signals: ValidationSignals;
  decision: 'allow' | 'warn' | 'block';
  message: string;
  code?: string;
}

export interface ValidationSignals {
  formatValid: boolean;
  entropyScore?: number;
  patternMatch?: string | null;
  localPartLength?: number;
  domainValid?: boolean;
  isDisposableDomain?: boolean;
  isFreeProvider?: boolean;
  domainReputationScore?: number;
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  signals: {
    formatValid: boolean;
    entropyScore: number;
    localPartLength: number;
  };
}

export interface Fingerprint {
  hash: string;
  ip: string;
  ja4?: string;
  ja3?: string;
  userAgent: string;
  country?: string;
  asn?: number;
  asOrg?: string;
  botScore?: number;
  deviceType?: string;
}
