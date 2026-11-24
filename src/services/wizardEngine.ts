import {
    addWorkingDays,
    getTodayCalendarDate,
    StatuteCode,
    STATUTES,
    STATUTORY_CLAUSES,
} from '../data/statutes';
import { AgencyRecord, PublicRecordItem } from '../types/models';

export interface StrategyCard {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'action';
  detail: string;
  recommendedText?: string;
}

export interface WizardClassification {
  suggestedStatute: StatuteCode;
  suggestedTitle: string;
  suggestedDueDate: string;
  isSplitCandidate: boolean;
  splitSuggestions: string[];
  strategyCards: StrategyCard[];
}

const CRIMINAL_JUSTICE_KEYWORDS = [
  'police',
  'sheriff',
  'jail',
  'arrest',
  'incident',
  'bodycam',
  'body cam',
  'dashcam',
  'internal affairs',
  'ia ',
  'use of force',
  'dispatch',
  'citation',
  'booking',
  'post',
  'criminal justice',
];

const FEDERAL_KEYWORDS = [
  'federal',
  'fbi',
  'blm',
  'forest service',
  'epa',
  'foia',
  'usfs',
  'department of',
];

const PERSONNEL_KEYWORDS = [
  'personnel',
  'employee',
  'salary',
  'pay',
  'wage',
  'discipline',
  'disciplined',
  'terminated',
  'fired',
  'resigned',
  'contract',
  'hired',
];

const BROAD_MULTI_TOPIC_KEYWORDS = [
  'all records',
  'everything',
  'emails and texts',
  'invoices and contracts',
  'policies and procedures',
  'communications',
  'multiple',
  'all files',
];

export function classifyRequestInput(
  rawPrompt: string,
  agency?: AgencyRecord | null,
  startDate: string = getTodayCalendarDate()
): WizardClassification {
  const clean = rawPrompt.trim();
  const lower = clean.toLowerCase();

  let suggestedStatute: StatuteCode =
    agency?.defaultStatute === 'CORA' ||
    agency?.defaultStatute === 'CCJRA' ||
    agency?.defaultStatute === 'FOIA'
      ? agency.defaultStatute
      : 'CORA';

  if (FEDERAL_KEYWORDS.some((kw) => lower.includes(kw))) {
    suggestedStatute = 'FOIA';
  } else if (CRIMINAL_JUSTICE_KEYWORDS.some((kw) => lower.includes(kw))) {
    suggestedStatute = 'CCJRA';
  }

  const statuteDef = STATUTES[suggestedStatute];
  const suggestedDueDate = addWorkingDays(
    startDate,
    statuteDef.defaultWorkingDays
  );

  const words = clean.split(/\s+/).filter(Boolean);
  const baseTitle =
    words.length === 0
      ? 'Public Records Request'
      : words.slice(0, 7).join(' ') + (words.length > 7 ? '...' : '');

  const strategyCards: StrategyCard[] = [];

  // 1. Native electronic format clause (helpful for digital records)
  strategyCards.push({
    id: 'native-format',
    title: 'Request Native Electronic Format',
    severity: 'info',
    detail:
      'Asking for native digital files avoids slow print-and-scan delays and helps keep data searchable.',
    recommendedText: STATUTORY_CLAUSES.nativeElectronicFormat,
  });

  // 2. Statute-specific strategy cards
  if (suggestedStatute === 'CCJRA') {
    strategyCards.push({
      id: 'ccjra-affirmation',
      title: 'CCJRA Non-Pecuniary Gain Affirmation Required',
      severity: 'action',
      detail:
        'Criminal justice record requests under C.R.S. — 24-72-305.5 require a statement affirming no direct business solicitation for pecuniary gain.',
      recommendedText: STATUTORY_CLAUSES.ccjraNonPecuniaryAffirmation,
    });

    if (
      lower.includes('internal affairs') ||
      lower.includes('ia ') ||
      lower.includes('misconduct') ||
      lower.includes('discipline')
    ) {
      strategyCards.push({
        id: 'ccjra-ia-scope',
        title: 'Scope Internal Affairs & Misconduct Narrowly',
        severity: 'warning',
        detail:
          'Specify exact incident dates, unit/division, and policy/final-action records so custodians cannot over-broadly withhold non-exempt material.',
      });
    }
  }

  if (
    suggestedStatute === 'CORA' &&
    PERSONNEL_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    strategyCards.push({
      id: 'cora-personnel-carveout',
      title: 'CORA Personnel File Public Carve-Outs',
      severity: 'action',
      detail:
        'While general personnel files face privacy review, compensation, contracts, employment dates, and certain misconduct/POST details have specific public inspection rules.',
      recommendedText: `Please include public inspection items such as: ${STATUTORY_CLAUSES.coraPersonnelCarveOut.join('; ')}.`,
    });
  }

  // 3. Fee-splitting / multi-part scoping check
  const hasConjunction =
    lower.includes(' and ') ||
    lower.includes(' plus ') ||
    lower.includes(' as well as ');
  const isSplitCandidate =
    BROAD_MULTI_TOPIC_KEYWORDS.some((kw) => lower.includes(kw)) ||
    (hasConjunction && clean.length > 45);

  const splitSuggestions: string[] = [];
  if (isSplitCandidate) {
    if (hasConjunction) {
      const parts = clean
        .split(/\b(?:and|plus|as well as)\b/i)
        .map((p) => p.trim())
        .filter((p) => p.length > 2);
      for (const part of parts.slice(0, 3)) {
        splitSuggestions.push(`Focused sub-request: ${part}`);
      }
    }
    if (splitSuggestions.length === 0) {
      splitSuggestions.push(
        `${baseTitle} — Policy & Directives`,
        `${baseTitle} — Specific Date Range / Logs`
      );
    }

    strategyCards.push({
      id: 'split-fee-strategy',
      title: 'Consider Splitting Broad Requests',
      severity: 'warning',
      detail:
        'Breaking broad or multi-topic requests into separate focused requests can prevent one bottleneck from stalling everything and helps isolate fee/search estimates.',
    });
  }

  // 4. Missing agency form or portal fallback
  if (!agency || (!agency.formPdfRelativePath && !agency.portalUrl)) {
    strategyCards.push({
      id: 'missing-form-fallback',
      title: 'No Agency Form or Portal Linked Yet',
      severity: 'info',
      detail:
        'You can proceed with a written statutory request directly or attach/add an agency form and portal URL later in the agency record.',
    });
  }

  return {
    suggestedStatute,
    suggestedTitle: baseTitle,
    suggestedDueDate,
    isSplitCandidate,
    splitSuggestions,
    strategyCards,
  };
}

export function buildSplitChildItems(
  parentItem: PublicRecordItem,
  splitTitles: string[]
): PublicRecordItem[] {
  const cleanTitles = splitTitles.map((t) => t.trim()).filter(Boolean);
  const parentSummary = (parentItem.summary || '').trim();
  const isCcjra = parentItem.statuteCode.trim().toUpperCase() === 'CCJRA';

  return cleanTitles.map((rawTitle, idx) => {
    const cleanSlice = rawTitle.replace(/^Focused sub-request:\s*/i, '').trim();
    const standaloneTitle = cleanSlice || rawTitle;
    const scopeParts = [
      `Standalone public records request specifically for: ${standaloneTitle}.`,
      parentSummary ? `Context & date/record parameters: ${parentSummary}` : '',
      isCcjra && !parentSummary.includes('24-72-305.5')
        ? STATUTORY_CLAUSES.ccjraNonPecuniaryAffirmation
        : '',
    ].filter(Boolean);

    return {
      id: `${parentItem.id}-split-${idx + 1}`,
      title: standaloneTitle,
      agencyId: parentItem.agencyId,
      agencyName: parentItem.agencyName,
      statuteCode: parentItem.statuteCode,
      summary: scopeParts.join(' '),
      status: 'draft',
      createdAt: new Date().toISOString(),
      sentAt: null,
      dueDate: parentItem.dueDate,
      feeQuoted: null,
      notes: [
        parentItem.notes,
        `Independent split request ${idx + 1} of ${cleanTitles.length} (Batch: ${parentItem.batchLabel ?? parentItem.title}).`,
      ]
        .filter(Boolean)
        .join(' '),
      parentItemId: parentItem.id,
      batchLabel: parentItem.batchLabel ?? parentItem.title,
    };
  });
}
export interface VaultWorkflowStep {
  stepNumber: number;
  title: string;
  detail: string;
  highlightWarning?: boolean;
}

export function buildVaultWorkflowSteps(
  fileSizeBytes: number,
  repoName: string = 'your-user/records-vault-index',
  branchName: string = 'main'
): VaultWorkflowStep[] {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  const isLargePdf = sizeMb >= 10;

  return [
    {
      stepNumber: 1,
      title: 'Pick PDF & Run Local Guard',
      detail:
        'Choose the PDF file, compute its SHA-256 hash, and check for PII, blank/prefilled forms, or jurisdiction mismatches locally on the device.',
    },
    {
      stepNumber: 2,
      title: 'Verify Every Page Before Publishing',
      detail:
        'Inspect all pages (especially multi-page municipal packets) for unredacted names, phone numbers, addresses, or IDs, then toggle the page-review gate.',
    },
    {
      stepNumber: 3,
      title: isLargePdf
        ? `Large PDF (${sizeMb.toFixed(1)} MB) -> Attach to a GitHub Release`
        : 'Host PDF via GitHub Release Asset or Repo Folder',
      detail: isLargePdf
        ? 'Large town/county PDFs can bloat git history if committed directly. Upload the PDF as a GitHub Release asset on ' +
          repoName +
          ' and paste its direct asset download URL below.'
        : 'Attach the PDF to a GitHub Release asset (recommended for large files) or commit smaller files to ' +
          repoName +
          ' (' +
          branchName +
          ') and use its direct URL.',
      highlightWarning: isLargePdf,
    },
    {
      stepNumber: 4,
      title: 'Copy Index JSON & Commit to index/*.json',
      detail:
        'Stage the entry, copy the generated JSON snippet, and add it to index/US-CO.json, index/US-FED.json, or index/catalog.json in GitHub.',
    },
  ];
}

export interface RequestPatternMatch {
  patternKey:
    | 'fee_and_cost'
    | 'email_correspondence'
    | 'denial_or_exemption'
    | 'ballots_and_elections'
    | 'personnel_records'
    | 'general_inspection';
  label: string;
  matchedKeywords: string[];
  coraCitations: string[];
  guidance: string;
}

export function detectRequestPatterns(
  rawText: string,
  statuteCode: string = 'CORA'
): RequestPatternMatch[] {
  const lower = (rawText || '').toLowerCase();
  const matches: RequestPatternMatch[] = [];

  const feeKw = ['fee', 'fees', 'cost', 'invoice', 'deposit', 'estimate', 'charge', 'research', 'retrieval', 'copying'].filter(
    (k) => lower.includes(k)
  );
  if (feeKw.length > 0) {
    matches.push({
      patternKey: 'fee_and_cost',
      label: 'Fee, Search & Copying Scope',
      matchedKeywords: feeKw,
      coraCitations: ['C.R.S. — 24-72-205', 'C.R.S. — 24-72-203'],
      guidance:
        'Clarify fee limits, free initial search/retrieval rules, and request advance written notice before any charges accrue.',
    });
  }

  const emailKw = ['email', 'emails', 'e-mail', 'correspondence', 'inbox', 'messages', 'threads'].filter(
    (k) => lower.includes(k)
  );
  if (emailKw.length > 0) {
    matches.push({
      patternKey: 'email_correspondence',
      label: 'Email & Written Correspondence',
      matchedKeywords: emailKw,
      coraCitations: ['C.R.S. — 24-72-202', 'C.R.S. — 24-72-204.5'],
      guidance:
        'Reference public records definitions and electronic mail policy/retention scope where applicable.',
    });
  }

  const denialKw = ['denial', 'denied', 'exempt', 'exemption', 'withheld', 'redact', 'redaction', 'appeal'].filter(
    (k) => lower.includes(k)
  );
  if (denialKw.length > 0) {
    matches.push({
      patternKey: 'denial_or_exemption',
      label: 'Exemptions, Redactions & Review Rights',
      matchedKeywords: denialKw,
      coraCitations: ['C.R.S. — 24-72-204', 'C.R.S. — 24-72-201'],
      guidance:
        'Note the presumption of public access and request specific statutory citations for any withheld or redacted material.',
    });
  }

  const ballotKw = ['ballot', 'ballots', 'election', 'recount', 'voter'].filter(
    (k) => lower.includes(k)
  );
  if (ballotKw.length > 0) {
    matches.push({
      patternKey: 'ballots_and_elections',
      label: 'Ballots & Election Records',
      matchedKeywords: ballotKw,
      coraCitations: ['C.R.S. — 24-72-205.5'],
      guidance:
        'Account for statutory ballot inspection rules, stay periods, and recount timelines.',
    });
  }

  const personKw = PERSONNEL_KEYWORDS.filter((k) => lower.includes(k));
  if (personKw.length > 0) {
    matches.push({
      patternKey: 'personnel_records',
      label: 'Personnel & Employment Context',
      matchedKeywords: personKw.slice(0, 5),
      coraCitations: ['C.R.S. — 24-72-202', 'C.R.S. — 24-72-204'],
      guidance:
        'Separate public compensation, contracts, and non-exempt records from protected personnel privacy material.',
    });
  }

  if (matches.length === 0) {
    matches.push({
      patternKey: 'general_inspection',
      label: 'Standard Public Records Inspection & Copies',
      matchedKeywords: [],
      coraCitations:
        statuteCode.toUpperCase() === 'CORA'
          ? ['C.R.S. — 24-72-200.1', 'C.R.S. — 24-72-201', 'C.R.S. — 24-72-202', 'C.R.S. — 24-72-203']
          : [],
      guidance:
        'Anchor the request in the statutory right of inspection/copying and reasonable custodian access rules.',
    });
  }

  return matches;
}
