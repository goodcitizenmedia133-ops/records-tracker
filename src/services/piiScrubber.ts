export type PiiCategory =
  | 'ssn'
  | 'email'
  | 'phone'
  | 'street_address'
  | 'id_or_account';

export interface PiiMatch {
  category: PiiCategory;
  original: string;
  replacement: string;
  index: number;
}

export interface ScrubResult {
  scrubbedText: string;
  totalRedactions: number;
  matches: PiiMatch[];
}

interface RedactionRule {
  category: PiiCategory;
  label: string;
  regex: RegExp;
  replacement: string;
}

const RULES: RedactionRule[] = [
  {
    category: 'ssn',
    label: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED-SSN]',
  },
  {
    category: 'email',
    label: 'Email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: '[REDACTED-EMAIL]',
  },
  {
    category: 'phone',
    label: 'Phone',
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[REDACTED-PHONE]',
  },
  {
    category: 'street_address',
    label: 'Address',
    regex:
      /\b\d{1,6}\s+(?:[A-Za-z0-9.]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Trail|Trl)\b\.?/gi,
    replacement: '[REDACTED-ADDRESS]',
  },
  {
    category: 'id_or_account',
    label: 'ID/Account',
    regex: /\b(?:ACCT|ACCOUNT|CASE|DOCKET|ID|BADGE|VIN)[#:\-\s]*[A-Z0-9-]{5,}\b/gi,
    replacement: '[REDACTED-ID]',
  },
];

export function scanForPii(rawText: string): PiiMatch[] {
  if (!rawText) return [];
  const found: PiiMatch[] = [];

  for (const rule of RULES) {
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    let match: RegExpExecArray | null = regex.exec(rawText);
    while (match !== null) {
      found.push({
        category: rule.category,
        original: match[0],
        replacement: rule.replacement,
        index: match.index,
      });
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
      match = regex.exec(rawText);
    }
  }

  return found.sort((a, b) => a.index - b.index);
}

export function scrubPii(
  rawText: string,
  options?: {
    categories?: PiiCategory[];
    customTerms?: string[];
  }
): ScrubResult {
  if (!rawText) {
    return { scrubbedText: '', totalRedactions: 0, matches: [] };
  }

  const allowedCategories = options?.categories
    ? new Set<PiiCategory>(options.categories)
    : null;

  const matches: PiiMatch[] = [];
  let output = rawText;

  for (const rule of RULES) {
    if (allowedCategories && !allowedCategories.has(rule.category)) {
      continue;
    }

    const scanRegex = new RegExp(rule.regex.source, rule.regex.flags);
    let m: RegExpExecArray | null = scanRegex.exec(rawText);
    while (m !== null) {
      matches.push({
        category: rule.category,
        original: m[0],
        replacement: rule.replacement,
        index: m.index,
      });
      if (m[0].length === 0) scanRegex.lastIndex += 1;
      m = scanRegex.exec(rawText);
    }

    output = output.replace(rule.regex, rule.replacement);
  }

  if (options?.customTerms && options.customTerms.length > 0) {
    for (const rawTerm of options.customTerms) {
      const term = rawTerm.trim();
      if (!term) continue;
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const customRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
      let cm: RegExpExecArray | null = customRegex.exec(output);
      while (cm !== null) {
        matches.push({
          category: 'id_or_account',
          original: cm[0],
          replacement: '[REDACTED]',
          index: cm.index,
        });
        if (cm[0].length === 0) customRegex.lastIndex += 1;
        cm = customRegex.exec(output);
      }
      output = output.replace(customRegex, '[REDACTED]');
    }
  }

  return {
    scrubbedText: output,
    totalRedactions: matches.length,
    matches: matches.sort((a, b) => a.index - b.index),
  };
}