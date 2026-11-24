export type RecordStatus =
  | 'draft'
  | 'sent'
  | 'extended'
  | 'fee_paused'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'denied'
  | 'overdue';

export type TargetChannel = 'email' | 'portal' | 'other';

export interface EmailProofRecord {
  direction: 'sent' | 'response';
  fileName: string;
  fileSizeBytes: number;
  sha256Hex: string;
  dateHeaderRaw: string | null;
  parsedIsoDate: string | null;
  parsedCalendarDate: string | null;
  confirmedByUser: boolean;
  fromHeader: string | null;
  toHeader: string | null;
  subjectHeader: string | null;
  messageId: string | null;
  receivedHopCount: number;
  attachedAtIso: string;
}
export interface AgencyRecord {
  id: string;
  name: string;
  jurisdiction: string;
  stateCode: string;
  contactEmail: string;
  portalUrl: string;
  defaultStatute: string;
  formPdfRelativePath: string;
  countyName?: string | null;
  municipalityName?: string | null;
  agencyKind?: 'state' | 'county' | 'city' | 'township' | 'village' | 'school' | 'law_enforcement' | 'federal' | null;
  timeZone?: string | null;
}
export interface PublicRecordItem {
  id: string;
  title: string;
  agencyId: string;
  agencyName: string;
  statuteCode: string;
  summary: string;
  status: RecordStatus;
  createdAt: string;
  sentAt: string | null;
  dueDate: string | null;
  feeQuoted: number | null;
  notes: string;
  parentItemId: string | null;
  batchLabel: string | null;
  sentEmailProof?: EmailProofRecord | null;
  responseEmailProof?: EmailProofRecord | null;
  senderEmail?: string | null;
  senderLabel?: string | null;
}
export interface AuditEntry {
  id: string;
  itemId: string;
  action: string;
  detail: string;
  createdAt: string;
}