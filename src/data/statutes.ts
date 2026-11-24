import { RecordStatus } from '../types/models';

export type StatuteCode = 'CORA' | 'CCJRA' | 'FOIA';

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

export function getTodayCalendarDate(): string {
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