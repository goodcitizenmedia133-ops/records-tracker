import { RecordStatus } from '../types/models';

export type StatuteCode = 'CORA' | 'CCJRA' | 'MIFOIA' | 'FOIA';

export interface StatuteDefinition {
  code: StatuteCode;
  name: string;
  citation: string;
  defaultWorkingDays: number;
  maxExtensionWorkingDays: number;
  requiresNonPecuniaryAffirmation: boolean;
  summary: string;
}

export const STATUTES: Record<StatuteCode, StatuteDefinition> = {
  CORA: {
    code: 'CORA',
    name: 'Colorado Open Records Act',
    citation: 'C.R.S. § 24-72-201 et seq.',
    defaultWorkingDays: 3,
    maxExtensionWorkingDays: 7,
    requiresNonPecuniaryAffirmation: false,
    summary:
      'Presumes inspection within 3 working days, extendable up to 7 additional working days upon written notice of extenuating circumstances.',
  },
  CCJRA: {
    code: 'CCJRA',
    name: 'Colorado Criminal Justice Records Act',
    citation: 'C.R.S. § 24-72-301 et seq.',
    defaultWorkingDays: 3,
    maxExtensionWorkingDays: 7,
    requiresNonPecuniaryAffirmation: true,
    summary:
      'Governs criminal justice and internal affairs records; requires a signed affirmation that records will not be used for direct solicitation of business for pecuniary gain.',
  },
  MIFOIA: {
    code: 'MIFOIA',
    name: 'Michigan Freedom of Information Act',
    citation: 'MCL 15.231 et seq. (PA 442 of 1976)',
    defaultWorkingDays: 5,
    maxExtensionWorkingDays: 10,
    requiresNonPecuniaryAffirmation: false,
    summary:
      'Public body must respond within 5 business days of receipt (electronic requests deemed received 1 business day after transmission), with at most one written extension of up to 10 additional business days.',
  },
  FOIA: {
    code: 'FOIA',
    name: 'Freedom of Information Act',
    citation: '5 U.S.C. § 552',
    defaultWorkingDays: 20,
    maxExtensionWorkingDays: 10,
    requiresNonPecuniaryAffirmation: false,
    summary:
      'Federal agencies must determine within 20 working days whether to comply with a request.',
  },
};

export const STATUTORY_CLAUSES = {
  nativeElectronicFormat:
    'Pursuant to C.R.S. § 24-72-203(3.5), please produce responsive records that are maintained electronically in a native, searchable digital format rather than printed and rescanned.',
  coraPersonnelCarveOut: [
    'Current salary, pay rate, and compensation schedules',
    'Employment contracts and official job descriptions',
    'Dates of hire, separation, resignation, or termination',
    'Colorado POST certification status and peace officer discipline/misconduct findings open to public inspection',
  ],
  ccjraNonPecuniaryAffirmation:
    'Pursuant to C.R.S. § 24-72-305.5, I affirm that the requested criminal justice records shall not be used for the direct solicitation of business for pecuniary gain.',
  mifoiaElectronicReceiptAndFormat:
    'Pursuant to the Michigan Freedom of Information Act, MCL 15.231 et seq. (including MCL 15.235), please treat this electronic transmission as received on the next business day and provide responsive public records electronically where maintained in digital form.',
  mifoiaFeeItemizationAndReductionNotice:
    'Pursuant to MCL 15.234, please provide a detailed fee itemization before assessing charges, apply any statutory fee waivers or 5%-per-day (up to 50%) late-response labor fee reductions under MCL 15.234(9) where applicable, and state your response or single 10-business-day extension under MCL 15.235(2).',
  mifoiaAppealsAndPenalties:
    'Pursuant to MCL 15.236, MCL 15.240, MCL 15.240a, and MCL 15.240b, please direct this request to the designated FOIA Coordinator and provide written notice of any statutory exemptions, appeal rights (180-day civil action / internal appeal window, or 45-day fee challenge window), and any applicable fee or deposit itemization.',
  michiganCompanionNotes: {
    openMeetingsMinutes: 'Open Meetings Act (MCL 15.269): proposed minutes within 8 business days; approved minutes within 5 business days after approval.',
    courtRecordsCarveOut: 'Michigan courts are excluded from MI FOIA under MCL 15.232(h)(iv); court case records are governed by MCR 8.119 rather than MI FOIA.',
  },
};

// 2026–2030 US Federal & Colorado State Holidays (YYYY-MM-DD)
export const HOLIDAYS_2026_2030 = new Set<string>([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-07-04', '2026-09-07', '2026-10-05', '2026-10-12',
  '2026-11-11', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-18',
  '2027-06-19', '2027-07-05', '2027-09-06', '2027-10-04', '2027-10-11',
  '2027-11-11', '2027-11-25', '2027-12-24', '2027-12-25',
  // 2028
  '2028-01-01', '2028-01-17', '2028-02-21', '2028-05-29', '2028-06-19',
  '2028-07-04', '2028-09-04', '2028-10-02', '2028-10-09', '2028-11-10',
  '2028-11-11', '2028-11-23', '2028-12-25',
  // 2029
  '2029-01-01', '2029-01-15', '2029-02-19', '2029-05-28', '2029-06-19',
  '2029-07-04', '2029-09-03', '2029-10-01', '2029-10-08', '2029-11-11',
  '2029-11-12', '2029-11-22', '2029-12-25',
  // 2030
  '2030-01-01', '2030-01-21', '2030-02-18', '2030-05-27', '2030-06-19',
  '2030-07-04', '2030-09-02', '2030-10-07', '2030-10-14', '2030-11-11',
  '2030-11-28', '2030-12-25',
]);

function normalizeCalendarDate(isoOrDate: string): string {
  const match = isoOrDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseUtcCalendar(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function formatUtcCalendar(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isWorkingDay(ymd: string): boolean {
  const normalized = normalizeCalendarDate(ymd);
  const dt = parseUtcCalendar(normalized);
  const day = dt.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !HOLIDAYS_2026_2030.has(normalized);
}

export function addWorkingDays(startIsoDate: string, workingDays: number): string {
  const startYmd = normalizeCalendarDate(startIsoDate);
  const cursor = parseUtcCalendar(startYmd);
  const step = workingDays >= 0 ? 1 : -1;
  let remaining = Math.abs(Math.trunc(workingDays));

  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    const candidate = formatUtcCalendar(cursor);
    if (isWorkingDay(candidate)) {
      remaining -= 1;
    }
  }
  return formatUtcCalendar(cursor);
}

export function getTodayCalendarDate(timeZone?: string): string {
  if (timeZone) {
    return getAgencyLocalDateInfo(new Date(), timeZone).dateYmd;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWorkingDaysRemaining(
  dueIsoDate: string,
  todayIsoDate: string = getTodayCalendarDate()
): number {
  const dueYmd = normalizeCalendarDate(dueIsoDate);
  const todayYmd = normalizeCalendarDate(todayIsoDate);
  if (dueYmd === todayYmd) return 0;

  const forward = dueYmd > todayYmd;
  const cursor = parseUtcCalendar(todayYmd);
  const target = parseUtcCalendar(dueYmd);
  let count = 0;

  while (forward ? cursor < target : cursor > target) {
    cursor.setUTCDate(cursor.getUTCDate() + (forward ? 1 : -1));
    if (isWorkingDay(formatUtcCalendar(cursor))) {
      count += forward ? 1 : -1;
    }
  }
  return count;
}

const CLOSED_OR_PAUSED_STATUSES = new Set<RecordStatus>([
  'draft',
  'fee_paused',
  'fulfilled',
  'denied',
]);

export function isOverdue(
  status: RecordStatus,
  dueIsoDate: string | null,
  todayIsoDate: string = getTodayCalendarDate()
): boolean {
  if (!dueIsoDate || CLOSED_OR_PAUSED_STATUSES.has(status)) return false;
  if (status === 'overdue') return true;
  const dueYmd = normalizeCalendarDate(dueIsoDate);
  const todayYmd = normalizeCalendarDate(todayIsoDate);
  return todayYmd > dueYmd;
}

export interface AgencyLocationHint {
  jurisdiction?: string | null;
  agencyName?: string | null;
  stateCode?: string | null;
  statuteCode?: string | null;
}

export interface AgencyLocalClockInfo {
  timeZone: string;
  dateYmd: string;
  hour24: number;
  weekday: number;
  zoneAbbr: string;
  isAfterHours: boolean;
  isNonWorkingDay: boolean;
}

const STATE_DEFAULT_TZ: Record<string, string> = {
  AL: 'America/Chicago',
  AK: 'America/Anchorage',
  AZ: 'America/Phoenix',
  AR: 'America/Chicago',
  CA: 'America/Los_Angeles',
  CO: 'America/Denver',
  CT: 'America/New_York',
  DE: 'America/New_York',
  DC: 'America/New_York',
  FL: 'America/New_York',
  GA: 'America/New_York',
  HI: 'Pacific/Honolulu',
  ID: 'America/Boise',
  IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago',
  KS: 'America/Chicago',
  KY: 'America/New_York',
  LA: 'America/Chicago',
  ME: 'America/New_York',
  MD: 'America/New_York',
  MA: 'America/New_York',
  MI: 'America/Detroit',
  MN: 'America/Chicago',
  MS: 'America/Chicago',
  MO: 'America/Chicago',
  MT: 'America/Denver',
  NE: 'America/Chicago',
  NV: 'America/Los_Angeles',
  NH: 'America/New_York',
  NJ: 'America/New_York',
  NM: 'America/Denver',
  NY: 'America/New_York',
  NC: 'America/New_York',
  ND: 'America/Chicago',
  OH: 'America/New_York',
  OK: 'America/Chicago',
  OR: 'America/Los_Angeles',
  PA: 'America/New_York',
  RI: 'America/New_York',
  SC: 'America/New_York',
  SD: 'America/Chicago',
  TN: 'America/Chicago',
  TX: 'America/Chicago',
  UT: 'America/Denver',
  VT: 'America/New_York',
  VA: 'America/New_York',
  WA: 'America/Los_Angeles',
  WV: 'America/New_York',
  WI: 'America/Chicago',
  WY: 'America/Denver',
};

export function resolveAgencyTimeZone(hint?: AgencyLocationHint | null): string {
  const combined = `${hint?.jurisdiction || ''} ${hint?.agencyName || ''}`.toLowerCase();
  const rawState = (hint?.stateCode || '').trim().toUpperCase();
  const statute = (hint?.statuteCode || '').trim().toUpperCase();

  // Multi-zone city / region overrides using jurisdiction & agency name
  if (/\bel paso\b|\bhudspeth\b|\bmountain time\b|\bmst\b|\bmdt\b/.test(combined)) {
    return 'America/Denver';
  }
  if (/\bontario\b|\bmalheur\b/.test(combined) && /oregon|\bor\b/.test(combined)) {
    return 'America/Boise';
  }
  if (/\bpanhandle\b|\bpensacola\b|\bdestin\b|\bfort walton\b/.test(combined) && /florida|\bfl\b/.test(combined)) {
    return 'America/Chicago';
  }
  if (/\bwestern north dakota\b|\bwilliston\b|\bdickinson\b|\bmandans?\b|\bbismarck\b/.test(combined)) {
    return 'America/Denver';
  }
  if (/\bwestern south dakota\b|\brapid city\b|\bpennington\b/.test(combined)) {
    return 'America/Denver';
  }
  if (/\bwestern nebraska\b|\bscottsbluff\b|\bnorth platte\b/.test(combined)) {
    return 'America/Denver';
  }
  if (/\bwestern kansas\b|\bgoodland\b|\bdodge city\b|\bgarden city\b/.test(combined)) {
    return 'America/Denver';
  }
  if (/\beastern tennessee\b|\bknoxville\b|\bchattanooga\b/.test(combined)) {
    return 'America/New_York';
  }
  if (/\bwestern kentucky\b|\bpaducah\b|\bowensboro\b/.test(combined)) {
    return 'America/Chicago';
  }
  if (/\bnorthwest indiana\b|\bgary\b|\bhammond\b/.test(combined) && /indiana|\bin\b/.test(combined)) {
    return 'America/Chicago';
  }

  if (rawState && STATE_DEFAULT_TZ[rawState]) {
    return STATE_DEFAULT_TZ[rawState];
  }

  if (statute === 'CORA' || statute === 'CCJRA') {
    return 'America/Denver';
  }
  if (statute === 'FOIA' || rawState === 'US' || /federal|washington,?\s*d\.?c\.?/.test(combined)) {
    return 'America/New_York';
  }

  return 'America/Denver';
}

export function getAgencyLocalDateInfo(
  dateInput: Date | string = new Date(),
  timeZone: string = 'America/Denver'
): AgencyLocalClockInfo {
  const dt = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const safeDate = Number.isNaN(dt.getTime()) ? new Date() : dt;

  let dateYmd = '';
  let hour24 = 0;
  let zoneAbbr = '';

  try {
    const partsFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    const parts = partsFormatter.formatToParts(safeDate);
    const y = parts.find((p) => p.type === 'year')?.value || '1970';
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const d = parts.find((p) => p.type === 'day')?.value || '01';
    const hRaw = parts.find((p) => p.type === 'hour')?.value || '00';
    dateYmd = `${y}-${m}-${d}`;
    hour24 = hRaw === '24' ? 0 : Number(hRaw);
    zoneAbbr = parts.find((p) => p.type === 'timeZoneName')?.value || timeZone;
  } catch {
    dateYmd = normalizeCalendarDate(safeDate.toISOString());
    hour24 = safeDate.getHours();
    zoneAbbr = timeZone;
  }

  const weekday = parseUtcCalendar(dateYmd).getUTCDay();
  const isNonWorkingDay = !isWorkingDay(dateYmd);
  const isAfterHours = hour24 >= 17;

  return {
    timeZone,
    dateYmd,
    hour24,
    weekday,
    zoneAbbr,
    isAfterHours,
    isNonWorkingDay,
  };
}

export function computeEffectiveFilingDate(
  timestampInput: Date | string,
  hint?: AgencyLocationHint | null,
  businessCutoffHour: number = 17
): {
  timeZone: string;
  zoneAbbr: string;
  observedDateYmd: string;
  effectiveReceiptDateYmd: string;
  rolledNextBusinessDay: boolean;
  reason: string;
} {
  const timeZone = resolveAgencyTimeZone(hint);
  const info = getAgencyLocalDateInfo(timestampInput, timeZone);
  const afterCutoff = info.hour24 >= businessCutoffHour;
  const rolled = info.isNonWorkingDay || afterCutoff;

  const effectiveReceiptDateYmd = rolled
    ? addWorkingDays(info.dateYmd, 1)
    : info.dateYmd;

  let reason = `Logged on ${info.dateYmd} (${info.zoneAbbr}) within business hours; clock starts ${effectiveReceiptDateYmd}.`;
  if (info.isNonWorkingDay && afterCutoff) {
    reason = `Logged on non-working day after ${businessCutoffHour}:00 ${info.zoneAbbr}; statutory receipt rolls to ${effectiveReceiptDateYmd}.`;
  } else if (info.isNonWorkingDay) {
    reason = `Logged on weekend/holiday (${info.dateYmd} ${info.zoneAbbr}); statutory receipt rolls to next business day ${effectiveReceiptDateYmd}.`;
  } else if (afterCutoff) {
    reason = `Logged after ${businessCutoffHour}:00 ${info.zoneAbbr} business cutoff; statutory receipt rolls to ${effectiveReceiptDateYmd}.`;
  }

  return {
    timeZone,
    zoneAbbr: info.zoneAbbr,
    observedDateYmd: info.dateYmd,
    effectiveReceiptDateYmd,
    rolledNextBusinessDay: rolled,
    reason,
  };
}
