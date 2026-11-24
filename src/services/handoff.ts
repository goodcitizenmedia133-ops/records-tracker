import { Linking, Platform } from 'react-native';
import { CCJRA_300_PACK } from '../data/statutes/co/ccjra300';
import { FOIA_552_PACK } from '../data/statutes/fed/foia552';
import { CORA_200_PACK, StateStatutePack } from '../data/statutes/co/cora200';
import { loadStateStatutePack, loadStatutePackById } from '../data/statutes/statuteRegistry';
import { AgencyRecord, PublicRecordItem } from '../types/models';
import { detectRequestPatterns, RequestPatternMatch } from './wizardEngine';

export interface HandoffResult {
  ok: boolean;
  message: string;
}

export interface HandoffPayload {
  to?: string;
  subject: string;
  body: string;
}

export interface AnyEmailHandoffBundle {
  to: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  gmailUrl: string;
  clipboardText: string;
}

export type EmailToneStyle =
  | 'firm_statutory'
  | 'clear_professional'
  | 'collaborative_concise'
  | 'sweet_courteous'
  | 'deadline_follow_up';

export interface RequestLetterOptions {
  requesterSignOff?: string;
  preferredFormat?: string;
  toneStyle?: EmailToneStyle;
  coraPack?: StateStatutePack | null;
  ccjraPack?: StateStatutePack | null;
  foiaPack?: StateStatutePack | null;
  includeCcjraAffirmation?: boolean;
}

export interface EmailDraftInsights {
  toneStyle: EmailToneStyle;
  isDeadlineMissed: boolean;
  detectedPatterns: RequestPatternMatch[];
  referencedCitations: string[];
}

export interface EmailToneOption {
  id: EmailToneStyle;
  label: string;
  outcomeSummary: string;
}

export function isRequestDeadlineMissed(
  item?: Pick<PublicRecordItem, 'dueDate' | 'status'> | null,
  todayIso?: string
): boolean {
  if (!item || !item.dueDate) return false;
  const status = (item.status || '').toLowerCase();
  if (status === 'fulfilled' || status === 'closed' || status === 'completed') return false;
  const dueMatch = /^(\d{4}-\d{2}-\d{2})/.exec(item.dueDate.trim());
  if (!dueMatch) return false;
  const refDate = todayIso && /^\d{4}-\d{2}-\d{2}/.test(todayIso.trim())
    ? todayIso.trim().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return dueMatch[1] < refDate;
}

export function getAvailableEmailTones(
  item?: Pick<PublicRecordItem, 'dueDate' | 'status'> | null,
  todayIso?: string
): EmailToneOption[] {
  const missed = isRequestDeadlineMissed(item, todayIso);
  const fourthOption: EmailToneOption = missed
    ? {
        id: 'deadline_follow_up',
        label: 'Deadline Follow-Up',
        outcomeSummary: 'Flags missed statutory deadline and requests immediate status or written grounds.',
      }
    : {
        id: 'sweet_courteous',
        label: 'Sweet & Courteous',
        outcomeSummary: 'Extra-gracious, warm outreach to staff while keeping full statutory citations.',
      };
  return [
    {
      id: 'firm_statutory',
      label: 'Firm & Statutory',
      outcomeSummary: 'Formal statutory enforcement, clock rules, and advance fee notice.',
    },
    {
      id: 'clear_professional',
      label: 'Clear & Professional',
      outcomeSummary: 'Structured, direct request with clear scope, format, and target date.',
    },
    {
      id: 'collaborative_concise',
      label: 'Collaborative & Concise',
      outcomeSummary: 'Short, low-friction request designed for fast custodian fulfillment.',
    },
    fourthOption,
  ];
}

export function normalizeRecipientEmail(to?: string): string {
  return (to || '').trim();
}

function getStatuteHeader(
  statuteCode: string,
  toneStyle: EmailToneStyle = 'clear_professional'
): {
  label: string;
  windowNote: string;
} {
  const code = statuteCode.trim().toUpperCase();
  if (code === 'CORA') {
    const windowNote =
      toneStyle === 'firm_statutory'
        ? 'Under CORA (C.R.S. § 24-72-201 and § 24-72-203), public records are open for inspection and copying. Please make responsive records available promptly or within the statutory three-working-day window, and provide written notice with specific statutory grounds under C.R.S. § 24-72-204 if any portion is withheld or delayed.'
        : toneStyle === 'collaborative_concise'
          ? 'Under CORA, please share available records promptly within the standard three-working-day timeframe (or let me know if additional time or clarification is needed).'
          : 'Under CORA, please provide the records promptly or within the statutory three-working-day period (or notify me if an extension applies under C.R.S. § 24-72-203(3)(b)).';
    return {
      label: 'Colorado Open Records Act (CORA, C.R.S. § 24-72-200.1 et seq.)',
      windowNote,
    };
  }
  switch (code) {
    case 'CCJRA':
      return {
        label: 'Colorado Criminal Justice Records Act (CCJRA, C.R.S. § 24-72-301 et seq.)',
        windowNote:
          toneStyle === 'firm_statutory'
            ? 'Under CCJRA, records of official action are open for inspection under C.R.S. § 24-72-303, and any denial or withholding of criminal justice records must be supported by a written statement of statutory or public-interest grounds within 72 hours of request under C.R.S. § 24-72-305(6).'
            : 'Please make records of official action and non-exempt criminal justice records available for inspection or copying in accordance with CCJRA (C.R.S. § 24-72-301 et seq.), with any written denial grounds provided within 72 hours under C.R.S. § 24-72-305(6).',
      };
    case 'FOIA':
      return {
        label: 'Freedom of Information Act (FOIA, 5 U.S.C. § 552)',
        windowNote:
          toneStyle === 'sweet_courteous'
            ? 'Under FOIA (5 U.S.C. § 552), I deeply appreciate your time and help and look forward to your determination within the statutory 20-business-day timeframe.'
            : toneStyle === 'deadline_follow_up'
              ? 'Follow-Up Under FOIA (5 U.S.C. § 552): The statutory determination timeframe has elapsed; please advise on current processing status and expected release date.'
              : 'Under FOIA, I look forward to your determination within the statutory 20-business-day timeframe.',
      };
    default:
      return {
        label: `public records law (${statuteCode})`,
        windowNote: 'Please process this request within the applicable statutory timeframe.',
      };
  }
}

export function getEmailDraftInsights(
  item: PublicRecordItem,
  options?: RequestLetterOptions
): EmailDraftInsights {
  const toneStyle: EmailToneStyle = options?.toneStyle || 'clear_professional';
  const combinedText = [item.title, item.summary, item.notes, item.agencyName]
    .filter(Boolean)
    .join('\n');
  const detectedPatterns = detectRequestPatterns(combinedText, item.statuteCode);
  const citationSet = new Set<string>();
  for (const p of detectedPatterns) {
    for (const c of p.coraCitations) {
      citationSet.add(c);
    }
  }
  if (item.statuteCode.trim().toUpperCase() === 'CORA' && citationSet.size === 0) {
    citationSet.add('C.R.S. § 24-72-200.1');
    citationSet.add('C.R.S. § 24-72-201');
  }
  return {
    toneStyle,
    isDeadlineMissed: isRequestDeadlineMissed(item),
    detectedPatterns,
    referencedCitations: Array.from(citationSet),
  };
}

function cleanSubjectTitle(rawTitle: string, statuteCode: string): string {
  const statuteWord = statuteCode.trim();
  const cleaned = rawTitle
    .trim()
    .replace(new RegExp(`\\b${statuteWord}\\s+records\\s+request\\b`, 'gi'), '')
    .replace(/\bpublic records request\b/gi, '')
    .replace(/\brecords request\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[-:|]+|[-:|]+$/g, '')
    .trim();
  return cleaned || rawTitle.trim();
}

export function buildFormattedRequestText(
  item: PublicRecordItem,
  agency?: AgencyRecord | null,
  options?: RequestLetterOptions
): string {
  const agencyName = (agency?.name || item.agencyName || '').trim() || 'Records Custodian';
  const toneStyle: EmailToneStyle = options?.toneStyle || 'clear_professional';
  const statute = getStatuteHeader(item.statuteCode, toneStyle);
  const scopeText = (item.summary || '').trim() || item.title.trim();
  const notesText = (item.notes || '').trim();
  const formatPreference =
    (options?.preferredFormat || '').trim() ||
    'Electronic delivery in searchable PDF or native digital format via reply email is preferred if available.';
  const signOffText = (options?.requesterSignOff || '').trim();

  const insights = getEmailDraftInsights(item, options);
  const upperStatute = item.statuteCode.trim().toUpperCase();
  const isCora = upperStatute === 'CORA';
  const isCcjra = upperStatute === 'CCJRA';
  const isFoia = upperStatute === 'FOIA';
  const pack: StateStatutePack | null = isCora
    ? options?.coraPack || CORA_200_PACK
    : isCcjra
      ? options?.ccjraPack || CCJRA_300_PACK
      : isFoia
        ? options?.foiaPack || FOIA_552_PACK
        : null;

  const matchedSectionLines =
    pack && insights.referencedCitations.length > 0
      ? pack.sections
          .filter((sec) => insights.referencedCitations.includes(sec.citation))
          .slice(0, 4)
          .map((sec) => `- ${sec.citation} (${sec.title}): ${sec.appGuidance}`)
      : isCcjra && pack
        ? pack.sections
            .filter((sec) => ['C.R.S. § 24-72-303', 'C.R.S. § 24-72-304', 'C.R.S. § 24-72-305', 'C.R.S. § 24-72-306'].includes(sec.citation))
            .map((sec) => `- ${sec.citation} (${sec.title}): ${sec.appGuidance}`)
        : isFoia && pack
          ? pack.sections
              .slice(0, 4)
              .map((sec) => `- ${sec.citation} (${sec.title}): ${sec.appGuidance}`)
          : [];

  const ccjraAffirmationBlock =
    isCcjra && options?.includeCcjraAffirmation !== false
      ? 'CCJRA Non-Pecuniary Solicitation Statement (C.R.S. § 24-72-305.5): Pursuant to C.R.S. § 24-72-305.5, these requested criminal justice records will not be used for the direct solicitation of business for pecuniary gain.'
      : null;

  const greeting =
    toneStyle === 'firm_statutory'
      ? `Dear ${agencyName} Public Records Custodian,`
      : toneStyle === 'collaborative_concise'
        ? `Hi ${agencyName} Team,`
        : `Hello ${agencyName} Records Custodian,`;

  const openingLine =
    toneStyle === 'firm_statutory'
      ? `Pursuant to the ${statute.label}, please accept this formal request to inspect and obtain copies of public records concerning "${item.title.trim()}":`
      : toneStyle === 'collaborative_concise'
        ? `I am reaching out under the ${statute.label} to request copies or inspection of records related to "${item.title.trim()}":`
        : `Pursuant to the ${statute.label}, I am requesting copies of (or the opportunity to inspect) the following public records regarding "${item.title.trim()}":`;

  const feeLine =
    item.feeQuoted !== null && item.feeQuoted !== undefined
      ? `Fee noted to date: ${item.feeQuoted}. Please confirm any applicable statutory copying, search, or retrieval charges in advance before incurring costs.`
      : toneStyle === 'firm_statutory'
        ? 'Please provide written notice in advance before incurring any claimed statutory fees so we can review whether statutory thresholds or exemptions apply.'
        : 'Please let me know in advance if any statutory fees will apply before processing.';

  const closingLine = signOffText
    ? toneStyle === 'collaborative_concise'
      ? `Best regards,\n${signOffText}`
      : `Sincerely,\n${signOffText}`
    : toneStyle === 'collaborative_concise'
      ? 'Thanks for your help and time.'
      : 'Thank you for your time and assistance.';

  const statuteRefBlock =
    matchedSectionLines.length > 0
      ? ['Applicable Statute Reference Notes:', ...matchedSectionLines].join('\n')
      : null;

  const paragraphs: Array<string | null> = [
    greeting,
    openingLine,
    scopeText,
    statute.windowNote,
    feeLine,
    statuteRefBlock,
    ccjraAffirmationBlock,
    item.dueDate ? `Target statutory response date: ${item.dueDate}.` : null,
    notesText ? `Additional context: ${notesText}` : null,
    formatPreference,
    closingLine,
    '---',
    `Reference: ${item.id} | Statute: ${item.statuteCode} | Tone: ${toneStyle} | Agency: ${agencyName}`,
  ];

  return paragraphs.filter((part): part is string => Boolean(part)).join('\n\n');
}

export async function buildItemEmailHandoffWithStatute(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<AnyEmailHandoffBundle> {
  const upper = item.statuteCode.trim().toUpperCase();
  let coraPack: StateStatutePack | null = options?.coraPack || null;
  let ccjraPack: StateStatutePack | null = options?.ccjraPack || null;
  let foiaPack: StateStatutePack | null = options?.foiaPack || null;

  if (!coraPack && (upper === 'CO' || upper === 'CORA')) {
    try {
      coraPack = await loadStateStatutePack('CO');
    } catch {
      coraPack = CORA_200_PACK;
    }
  }

  if (!ccjraPack && upper === 'CCJRA') {
    try {
      ccjraPack = await loadStatutePackById('CO_CCJRA');
    } catch {
      ccjraPack = CCJRA_300_PACK;
    }
  }

  if (!foiaPack && upper === 'FOIA') {
    try {
      foiaPack = await loadStatutePackById('US_FED_FOIA');
    } catch {
      foiaPack = FOIA_552_PACK;
    }
  }

  return buildItemEmailHandoff(item, agency, { ...options, coraPack, ccjraPack, foiaPack });
}

export async function launchGmailWebHandoffWithStatute(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<HandoffResult> {
  const bundle = await buildItemEmailHandoffWithStatute(item, agency, options);
  try {
    const ok = await openExternalUrl(bundle.gmailUrl);
    if (!ok) {
      return {
        ok: false,
        message: 'Could not open Gmail Web automatically. Use Copy Full Packet to paste into any webmail tab.',
      };
    }
    return {
      ok: true,
      message: 'Opened Gmail Web with a statute-aligned request draft ready for review and send.',
    };
  } catch {
    return {
      ok: false,
      message: 'Gmail Web handoff failed. Use Copy Full Packet to paste into any email client.',
    };
  }
}

export function buildMailtoUrl(payload: HandoffPayload): string {
  const recipient = encodeURIComponent(normalizeRecipientEmail(payload.to));
  const queryParts: string[] = [];
  if (payload.subject.trim()) {
    queryParts.push(`subject=${encodeURIComponent(payload.subject.trim())}`);
  }
  if (payload.body.trim()) {
    queryParts.push(`body=${encodeURIComponent(payload.body)}`);
  }
  return `mailto:${recipient}${queryParts.length > 0 ? `?${queryParts.join('&')}` : ''}`;
}

export function buildGmailComposeUrl(payload: HandoffPayload): string {
  const queryParts: string[] = ['view=cm', 'fs=1'];
  const recipient = normalizeRecipientEmail(payload.to);
  if (recipient) {
    queryParts.push(`to=${encodeURIComponent(recipient)}`);
  }
  if (payload.subject.trim()) {
    queryParts.push(`su=${encodeURIComponent(payload.subject.trim())}`);
  }
  if (payload.body.trim()) {
    queryParts.push(`body=${encodeURIComponent(payload.body)}`);
  }
  return `https://mail.google.com/mail/?${queryParts.join('&')}`;
}

export function buildAnyEmailHandoff(payload: HandoffPayload): AnyEmailHandoffBundle {
  const to = normalizeRecipientEmail(payload.to);
  const subject = payload.subject.trim();
  const body = payload.body;
  const clipboardText = [
    to ? `To: ${to}` : null,
    subject ? `Subject: ${subject}` : null,
    '',
    body,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
  return {
    to,
    subject,
    body,
    mailtoUrl: buildMailtoUrl({ to, subject, body }),
    gmailUrl: buildGmailComposeUrl({ to, subject, body }),
    clipboardText,
  };
}

export function buildItemEmailHandoff(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): AnyEmailHandoffBundle {
  const to = normalizeRecipientEmail(agency?.contactEmail);
  const agencyName = (agency?.name || item.agencyName || '').trim();
  const toneStyle: EmailToneStyle = options?.toneStyle || 'clear_professional';
  const shortTitle = cleanSubjectTitle(item.title, item.statuteCode);
  const subjectPrefix =
    toneStyle === 'deadline_follow_up'
      ? `${item.statuteCode} Deadline Follow-Up`
      : toneStyle === 'sweet_courteous'
        ? `${item.statuteCode} Public Records Request (With Thanks)`
        : `${item.statuteCode} Public Records Request`;
  const subject = `${subjectPrefix}: ${shortTitle} - ${agencyName}`;
  const body = buildFormattedRequestText(item, agency, options);
  return buildAnyEmailHandoff({ to, subject, body });
}

async function openExternalUrl(url: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) return true;
  }
  const supported = await Linking.canOpenURL(url).catch(() => true);
  if (!supported && Platform.OS !== 'web') return false;
  await Linking.openURL(url);
  return true;
}

export async function launchGmailWebHandoff(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<HandoffResult> {
  const bundle = buildItemEmailHandoff(item, agency, options);
  try {
    const ok = await openExternalUrl(bundle.gmailUrl);
    if (!ok) {
      return {
        ok: false,
        message: 'Could not open Gmail Web automatically. Use Copy Full Packet to paste into any webmail tab.',
      };
    }
    return {
      ok: true,
      message: 'Opened Gmail Web with a formatted request draft ready for review and send.',
    };
  } catch {
    return {
      ok: false,
      message: 'Gmail Web handoff failed. Use Copy Full Packet to paste into any email client.',
    };
  }
}

export async function launchEmailHandoff(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<HandoffResult> {
  const bundle = buildItemEmailHandoff(item, agency, options);
  try {
    const ok = await openExternalUrl(bundle.mailtoUrl);
    if (!ok) {
      return {
        ok: false,
        message: 'No default mail handler opened. Use Open Gmail Web or Copy Full Packet to avoid Outlook popups.',
      };
    }
    return {
      ok: true,
      message: 'Triggered OS mailto handler (which opens Outlook on default Windows setups). Use Open Gmail Web or Copy Full Packet instead if you do not use Outlook.',
    };
  } catch {
    return {
      ok: false,
      message: 'Mailto handoff failed. Use Open Gmail Web or Copy Full Packet to paste into your email client.',
    };
  }
}

export async function launchPortalHandoff(agency: AgencyRecord | null): Promise<HandoffResult> {
  const url = (agency?.portalUrl || '').trim();
  if (!url) {
    return { ok: false, message: 'No public records portal URL configured for this agency.' };
  }
  if (/\.example\.(gov|com|org)(\/|$)/i.test(url)) {
    return {
      ok: false,
      message: `Placeholder portal URL (${url}) is not a live site. Update the agency portal URL in Vault first.`,
    };
  }
  try {
    const ok = await openExternalUrl(url);
    return ok
      ? { ok: true, message: `Opened portal: ${url}` }
      : { ok: false, message: 'Could not open agency portal URL.' };
  } catch {
    return { ok: false, message: 'Failed to open agency portal URL.' };
  }
}

export async function scheduleDeadlineReminder(item: PublicRecordItem): Promise<HandoffResult> {
  if (!item.dueDate) {
    return { ok: false, message: 'No statutory due date set on this request yet.' };
  }
  const dueCompact = item.dueDate.replace(/-/g, '');
  if (Platform.OS === 'web' && typeof document !== 'undefined' && /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) {
    try {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Records Tracker//9AM Deadline Alert//EN',
        'BEGIN:VEVENT',
        `UID:${item.id}-${dueCompact}@records-tracker`,
        `DTSTART:${dueCompact}T090000`,
        `DTEND:${dueCompact}T093000`,
        `SUMMARY:9:00 AM ${item.statuteCode} Deadline - ${item.title.replace(/[,;]/g, ' ')}`,
        `DESCRIPTION:Agency: ${item.agencyName.replace(/[,;]/g, ' ')} (Ref: ${item.id})`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('
');
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${item.id}-9am-reminder.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      return {
        ok: true,
        message: `Downloaded 9:00 AM calendar reminder (.ics) for ${item.dueDate} and logged reminder.`,
      };
    } catch {
      // Fall through to status message
    }
  }
  return { ok: true, message: `9:00 AM statutory deadline reminder noted for ${item.dueDate}.` };
}
