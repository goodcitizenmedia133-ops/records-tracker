export type VaultUploadMode = 'blank_form' | 'scrubbed_response';
export type VaultGuardDecision = 'approve' | 'quarantine' | 'reject';

export interface JurisdictionTarget {
  stateCode: string;
  countyName: string;
  cityName?: string | null;
}

export interface VaultGuardInput {
  fileName: string;
  fileSizeBytes: number;
  extractedText: string;
  hasAcroFormFields: boolean;
  hasPrefilledFormValues: boolean;
  uploadMode: VaultUploadMode;
  target: JurisdictionTarget;
  sha256Hex: string;
  userReviewedPages: boolean;
  scrubPiiEnabled: boolean;
}

export interface VaultCatalogEntry {
  id: string;
  r2Key: string;
  sha256Hex: string;
  uploadMode: VaultUploadMode;
  status: 'verified' | 'quarantined';
  jurisdictionPath: string;
  createdAtIso: string;
  warnings: string[];
}

export interface VaultGuardResult {
  decision: VaultGuardDecision;
  scrubbedText: string;
  jurisdictionPath: string;
  r2Key: string;
  reasons: string[];
  requiresManualReview: boolean;
  catalogEntry: VaultCatalogEntry;
}

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const STREET_RE = /\b\d{1,6}\s+[A-Za-z0-9.]+(?:\s+[A-Za-z0-9.]+){0,3}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Cir|Circle)\b/gi;
const CASE_ACCT_RE = /\b(?:case|docket|acct|account|invoice|claim)\s*(?:#|no\.?|number)?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi;
const OTHER_STATE_RE = /\b(?:new jersey|texas|california|florida|new york|ohio|michigan|arizona|utah|wyoming|new mexico)\b/gi;

function slugPart(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
}

export function buildJurisdictionPath(target: JurisdictionTarget): string {
  const parts = [slugPart(target.stateCode), slugPart(target.countyName)];
  if (target.cityName && target.cityName.trim()) parts.push(slugPart(target.cityName));
  return parts.join('/');
}

export function scrubVaultRecordText(rawText: string, enabled: boolean): string {
  if (!enabled || !rawText) return rawText;
  return rawText.replace(SSN_RE, '[REDACTED-SSN]').replace(EMAIL_RE, '[REDACTED-EMAIL]').replace(PHONE_RE, '[REDACTED-PHONE]').replace(STREET_RE, '[REDACTED-ADDRESS]').replace(CASE_ACCT_RE, '[REDACTED-ID]');
}

export function evaluateVaultUpload(input: VaultGuardInput): VaultGuardResult {
  const reasons: string[] = [];
  let decision: VaultGuardDecision = 'approve';
  const jurisdictionPath = buildJurisdictionPath(input.target);
  const lane = input.uploadMode === 'blank_form' ? 'forms' : 'responses';
  const safeFile = input.fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  const cleanText = (input.extractedText || '').trim();
  const lowerText = cleanText.toLowerCase();
  const cityLower = (input.target.cityName || '').trim().toLowerCase();
  const countyLower = input.target.countyName.trim().toLowerCase();
  const stateLower = input.target.stateCode.trim().toLowerCase();
  if (cleanText.length < 25) {
    reasons.push('Little or no selectable text detected (possible scan or image PDF); verify pages before publishing.');
    decision = 'quarantine';
  }
  if (stateLower === 'co' || stateLower === 'colorado') {
    const otherStates = cleanText.match(OTHER_STATE_RE);
    if (otherStates && otherStates.length > 0) {
      reasons.push(`Detected non-Colorado jurisdiction reference (${Array.from(new Set(otherStates)).join(', ')}) for target ${jurisdictionPath}.`);
      decision = 'quarantine';
    }
  }
  if (cityLower && !lowerText.includes(cityLower) && !lowerText.includes(countyLower)) {
    reasons.push(`Target city/county (${input.target.cityName || input.target.countyName}) not found in extracted PDF text.`);
    if (decision === 'approve') decision = 'quarantine';
  }
  let scrubbedText = cleanText;
  if (input.uploadMode === 'blank_form') {
    if (input.hasPrefilledFormValues) {
      reasons.push('Prefilled form field values detected on blank form upload; clear or verify blank form before publishing.');
      decision = 'quarantine';
    }
    if (/\b(pursuant to c\.r\.s\.|i hereby request|signature of requester|date submitted)\b/i.test(cleanText)) {
      reasons.push('Text resembles a completed request rather than a blank agency form.');
      decision = 'reject';
    }
  } else {
    scrubbedText = scrubVaultRecordText(cleanText, input.scrubPiiEnabled);
    if (!input.scrubPiiEnabled) {
      reasons.push('PII scrubbing is disabled; verify personal data is intentionally public.');
      if (decision === 'approve') decision = 'quarantine';
    }
  }
  if (!input.userReviewedPages && decision !== 'reject') {
    reasons.push('Mandatory Review Gate pending: confirm every page has been checked before vault publish.');
    if (decision === 'approve') decision = 'quarantine';
  }
  const catalogStatus: 'verified' | 'quarantined' = decision === 'approve' ? 'verified' : 'quarantined';
  const safeSlug = (safeFile || 'document.pdf').replace(/[^a-z0-9._-]+/g, '-');
  const hashPrefix = (input.sha256Hex || 'unhashed').slice(0, 12);
  const r2Key =
    catalogStatus === 'quarantined'
      ? `quarantine/${jurisdictionPath}/${lane}/${hashPrefix}-${safeSlug}`
      : `${jurisdictionPath}/${lane}/${hashPrefix}-${safeSlug}`;
  const catalogEntry: VaultCatalogEntry = { id: `vlt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, r2Key, sha256Hex: input.sha256Hex, uploadMode: input.uploadMode, status: catalogStatus, jurisdictionPath, createdAtIso: new Date().toISOString(), warnings: reasons };
  return { decision, scrubbedText, jurisdictionPath, r2Key, reasons, requiresManualReview: true, catalogEntry };
}
