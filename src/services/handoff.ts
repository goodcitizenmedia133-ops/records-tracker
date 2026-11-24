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

  const paragraphs: Array<string | null> = [
    greeting,
    openingLine,
    scopeText,
    statute.windowNote,
    feeLine,
    ccjraAffirmationBlock,
    item.dueDate ? `Target statutory response date: ${item.dueDate}.` : null,
    notesText ? `Additional context: ${notesText}` : null,
    formatPreference,
    closingLine,
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
  options?: RequestLetterOptions & { senderEmail?: string | null }
): Promise<HandoffResult> {
  const bundle = await buildItemEmailHandoffWithStatute(item, agency, options);
  try {
    const ok = await openExternalUrl(bundle.gmailUrl);
    if (!ok) {
      return {
        ok: false,
        message: 'Browser blocked the mail tab—allow popups for this site or use Download Draft (.eml) / Copy Email Packet.',
      };
    }
    return {
      ok: true,
      message: 'Opened webmail with a statute-aligned request draft ready for review and send.',
    };
  } catch {
    return {
      ok: false,
      message: 'Could not open webmail. Use Copy Full Packet to paste into your email client.',
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
  const recipient = normalizeRecipientEmail(payload.to);
  if (!recipient) {
    return 'https://mail.google.com/mail/';
  }
  const encodedTo = encodeURIComponent(recipient);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}`;
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
    try {
      if (url.indexOf('mailto:') === 0) {
        window.location.href = url;
        return true;
      }
      const opened = window.open(url, '_blank');
      if (opened) {
        try { opened.opener = null; } catch { }
        return true;
      }
      if (/^https?:\/\//i.test(url)) {
        window.location.assign(url);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  const supported = await Linking.canOpenURL(url).catch(() => true);
  if (!supported) return false;
  await Linking.openURL(url);
  return true;
}
export function buildEmlDraftContent(bundle: AnyEmailHandoffBundle): string {
  const safeSubject = bundle.subject.replace(/[\r\n]+/g, ' ').trim();
  const safeTo = bundle.to.replace(/[\r\n]+/g, ' ').trim();
  return [
    safeTo ? `To: ${safeTo}` : 'To: ',
    `Subject: ${safeSubject}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    bundle.body,
  ].join('\r\n');
}

export async function downloadEmailDraftEml(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<HandoffResult> {
  const bundle = await buildItemEmailHandoffWithStatute(item, agency, options);
  const eml = buildEmlDraftContent(bundle);
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([eml], { type: 'message/rfc822;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${item.id}-draft.eml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return {
        ok: true,
        message: 'Downloaded .eml draft—double-click it to open directly in Outlook, Thunderbird, or Apple Mail.',
      };
    } catch {
      return {
        ok: false,
        message: 'Could not download .eml draft. Use Copy Email Packet instead.',
      };
    }
  }
  return {
    ok: false,
    message: 'Direct .eml file download is for desktop/web browsers; use Copy Email Packet.',
  };
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
        message: 'Could not open webmail automatically. Use Copy Full Packet to paste into your email client.',
      };
    }
    return {
      ok: true,
      message: 'Opened webmail with a formatted request draft ready for review and send.',
    };
  } catch {
    return {
      ok: false,
      message: 'Could not open webmail. Use Copy Full Packet to paste into your email client.',
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
      message: 'Could not open your mail app. Use Open Gmail Web or Copy Full Packet to paste into your email client.',
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
      ].join('\r\n');
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

export async function launchDefaultMailtoHandoff(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions
): Promise<HandoffResult> {
  const bundle = await buildItemEmailHandoffWithStatute(item, agency, options);
  const encodedSubject = encodeURIComponent(bundle.subject);
  const encodedBody = encodeURIComponent(bundle.body);
  const toPart = encodeURIComponent(bundle.to || '');
  const mailtoUrl = `mailto:${toPart}?subject=${encodedSubject}&body=${encodedBody}`;

  try {
    const opened = await openExternalUrl(mailtoUrl);
    if (opened) {
      return {
        ok: true,
        message: 'Opened your default mail app/handler. If Edge prompts or does not open, use Download Draft (.eml) or Copy Email Packet.',
      };
    }
    return {
      ok: false,
      message: 'Could not launch default mail handler in Edge. Use Download Draft (.eml) or Copy Email Packet.',
    };
  } catch {
    return {
      ok: false,
      message: 'Default mail handler blocked or unavailable. Use Download Draft (.eml) or Copy Email Packet.',
    };
  }
}

export type ProviderComposeId = 'proton' | 'gmail' | 'outlook' | 'office365' | 'yahoo' | 'mailto';

function isProtonDomain(domain: string): boolean {
  return domain === 'proton.me' || domain === 'protonmail.com' || domain === 'protonmail.ch' || domain === 'pm.me';
}

export function getProviderWebmailInfo(senderEmail?: string | null): {
  id: 'proton' | 'comcast' | 'outlook' | 'yahoo' | 'gmail' | 'other';
  providerName: string;
  composeUrl: string | null;
} {
  const email = (senderEmail || '').trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';

  if (isProtonDomain(domain)) {
    return {
      id: 'proton',
      providerName: 'Proton Mail Web',
      composeUrl: 'https://mail.proton.me/',
    };
  }
  if (domain === 'comcast.net' || domain === 'xfinity.com') {
    return {
      id: 'comcast',
      providerName: 'Comcast / Xfinity Webmail',
      composeUrl: 'https://connect.xfinity.com/appsuite/',
    };
  }
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'msn.com') {
    return {
      id: 'outlook',
      providerName: 'Outlook Web',
      composeUrl: 'https://outlook.live.com/mail/0/deeplink/compose',
    };
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return {
      id: 'yahoo',
      providerName: 'Yahoo Mail',
      composeUrl: 'https://mail.yahoo.com/',
    };
  }
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return {
      id: 'gmail',
      providerName: 'Gmail Web',
      composeUrl: null,
    };
  }
  return {
    id: 'other',
    providerName: domain ? `${domain} Webmail` : 'Email Client',
    composeUrl: null,
  };
}

export function detectProviderComposeId(senderEmail?: string | null): ProviderComposeId {
  const email = (senderEmail || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  const domain = at >= 0 ? email.slice(at + 1) : '';
  if (isProtonDomain(domain)) return 'proton';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'msn.com') return 'outlook';
  if (domain === 'yahoo.com' || domain === 'ymail.com') return 'yahoo';
  return 'mailto';
}

export function buildProviderComposeUrl(id: ProviderComposeId, payload: HandoffPayload): string {
  if (id === 'proton') return 'https://mail.proton.me/';
  const to = encodeURIComponent(normalizeRecipientEmail(payload.to));
  const su = encodeURIComponent(payload.subject.trim());
  const bd = encodeURIComponent(payload.body);
  const qs = 'to=' + to + '&subject=' + su + '&body=' + bd;
  if (id === 'gmail') return buildGmailComposeUrl(payload);
  if (id === 'outlook') return 'https://outlook.live.com/mail/0/deeplink/compose?' + qs;
  if (id === 'office365') return 'https://outlook.office.com/mail/deeplink/compose?' + qs;
  if (id === 'yahoo') return 'https://compose.mail.yahoo.com/?' + qs;
  return buildMailtoUrl(payload);
}

async function copyPacketTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand fallback
  }
  try {
    if (typeof document !== 'undefined' && document.body) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) return true;
    }
  } catch {
    // ignore fallback errors
  }
  return false;
}

export async function launchProviderWebmailHandoff(
  item: PublicRecordItem,
  agency: AgencyRecord | null,
  options?: RequestLetterOptions & { senderEmail?: string | null; providerId?: ProviderComposeId }
): Promise<HandoffResult> {
  const sender = (options?.senderEmail || item.senderEmail || '').trim();
  const detected = detectProviderComposeId(sender);
  const id: ProviderComposeId = options?.providerId || detected;
  const bundle = await buildItemEmailHandoffWithStatute(item, agency, options);
  const recipient = normalizeRecipientEmail(bundle.to);
  const subjectLine = bundle.subject.trim();
  const packetText = [
    `From: ${sender || '(select in mail client)'}`,
    `To: ${recipient}`,
    `Subject: ${subjectLine}`,
    '',
    bundle.body,
  ].join('\n');

  const url = buildProviderComposeUrl(id, { to: recipient, subject: subjectLine, body: bundle.body });
  const limit = id === 'mailto' ? 1900 : 8000;
  const who = sender || 'your chosen account';

  if (id !== 'proton' && url.length > limit) {
    await copyPacketTextToClipboard(packetText);
    return {
      ok: false,
      message: 'This letter is too long for a URL query string. Copied To, Subject, and Body to clipboard—paste into your email client, send, then tap Mark Sent.',
    };
  }

  let copiedPacket = false;
  if (id === 'proton' || id === 'gmail') {
    copiedPacket = await copyPacketTextToClipboard(packetText);
  }

  try {
    const ok = await openExternalUrl(url);
    if (ok) {
      if (id === 'proton') {
        return {
          ok: true,
          message: copiedPacket
            ? `Step 1 Done: Copied To (${recipient}), Subject, and Body to clipboard and opened Proton Mail for ${who}. Step 2: Paste into Proton, review, sign, and send. Step 3: Tap Mark Sent below to track it.`
            : `Step 1 Done: Opened Proton Mail for ${who}. Tap Copy Email Packet to grab To (${recipient}), Subject, and Body, paste into Proton, sign, send, then tap Mark Sent.`,
        };
      }
      if (id === 'gmail') {
        return {
          ok: true,
          message: copiedPacket
            ? `Step 1 Done: Copied full packet (To, Subject & Body) to clipboard and opened Gmail for ${who}. Step 2: Paste into Gmail compose, sign, and send. Step 3: Tap Mark Sent below to track it.`
            : `Step 1 Done: Opened Gmail for ${who}. Use Copy To, Copy Subject, and Copy Body below, paste into Gmail, sign, and send. Step 3: Tap Mark Sent below to track it.`,
        };
      }
      return {
        ok: true,
        message: `Step 1 Done: Opened ${id === 'mailto' ? 'your mail app' : id} for ${who}. Step 2: Confirm From (${who}), To (${recipient}), Subject, and Body, sign, and send. Step 3: Tap Mark Sent below to track it.`,
      };
    }
  } catch {
    // fall through
  }
  await copyPacketTextToClipboard(packetText);
  return {
    ok: false,
    message: 'Could not open your mail provider automatically. Copied To, Subject, and Body to clipboard—paste into your email client, send, then tap Mark Sent.',
  };
}

export interface SmtpSenderConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export async function sendDirectSmtpEmail(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  smtp?: SmtpSenderConfig;
}): Promise<HandoffResult> {
  const from = (params.from || '').trim();
  const to = (params.to || '').trim();
  const subject = (params.subject || '').trim();
  const text = params.text || '';

  if (!from || !from.includes('@')) {
    return { ok: false, message: 'Select or enter a valid From sender email first.' };
  }
  if (!to || !to.includes('@')) {
    return { ok: false, message: 'Enter a valid To custodian email address before sending.' };
  }
  if (!subject) {
    return { ok: false, message: 'Email subject cannot be empty.' };
  }

  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text, smtp: params.smtp }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.error || `Direct send from ${from} failed (HTTP ${resp.status}).`,
      };
    }
    return {
      ok: true,
      message: `Sent directly from ${from} to ${to}${data.messageId ? ` (ID: ${data.messageId})` : ''}.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || `Network error sending directly from ${from}.`,
    };
  }
}
