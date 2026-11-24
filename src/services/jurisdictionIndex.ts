import { STATUTES, StatuteCode } from '../data/statutes';
import { AgencyRecord } from '../types/models';

export interface JurisdictionProfile {
  stateCode: string;
  stateName: string;
  countyName: string | null;
  municipalityName: string | null;
  timeZone: string;
  primaryStatute: StatuteCode;
  statuteLabel: string;
  statuteCitation: string;
  initialResponseBusinessDays: number;
  maxSingleExtensionBusinessDays: number;
  electronicReceiptBusinessDayOffset: number;
  supportsNonPecuniaryAffirmation: boolean;
  coordinatorRoleTitle: string;
}

export const STATE_JURISDICTION_RULES: Record<
  string,
  Omit<JurisdictionProfile, 'countyName' | 'municipalityName'>
> = {
  MI: {
    stateCode: 'MI',
    stateName: 'Michigan',
    timeZone: 'America/Detroit',
    primaryStatute: 'MIFOIA',
    statuteLabel: 'MI FOIA',
    statuteCitation: STATUTES.MIFOIA.citation,
    initialResponseBusinessDays: 5,
    maxSingleExtensionBusinessDays: 10,
    electronicReceiptBusinessDayOffset: 1,
    supportsNonPecuniaryAffirmation: false,
    coordinatorRoleTitle: 'FOIA Coordinator',
  },
  CO: {
    stateCode: 'CO',
    stateName: 'Colorado',
    timeZone: 'America/Denver',
    primaryStatute: 'CORA',
    statuteLabel: 'CORA / CCJRA',
    statuteCitation: STATUTES.CORA.citation,
    initialResponseBusinessDays: 3,
    maxSingleExtensionBusinessDays: 7,
    electronicReceiptBusinessDayOffset: 0,
    supportsNonPecuniaryAffirmation: true,
    coordinatorRoleTitle: 'Records Custodian',
  },
  US: {
    stateCode: 'US',
    stateName: 'United States (Federal)',
    timeZone: 'America/New_York',
    primaryStatute: 'FOIA',
    statuteLabel: 'Federal FOIA',
    statuteCitation: STATUTES.FOIA.citation,
    initialResponseBusinessDays: 20,
    maxSingleExtensionBusinessDays: 10,
    electronicReceiptBusinessDayOffset: 0,
    supportsNonPecuniaryAffirmation: false,
    coordinatorRoleTitle: 'FOIA Liaison / Officer',
  },
};

export function resolveJurisdictionProfile(
  agency?: Pick<AgencyRecord, 'stateCode' | 'countyName' | 'municipalityName' | 'timeZone' | 'defaultStatute'> | null,
  fallbackStateCode?: string | null
): JurisdictionProfile {
  const rawCode = (agency?.stateCode || fallbackStateCode || 'CO').trim().toUpperCase();
  const base = STATE_JURISDICTION_RULES[rawCode] || STATE_JURISDICTION_RULES.CO;
  const rawStatute = (agency?.defaultStatute || '').trim().toUpperCase();
  const isValidStatute = (v: string): v is StatuteCode =>
    v === 'CORA' || v === 'CCJRA' || v === 'MIFOIA' || v === 'FOIA';
  const statuteCode: StatuteCode = isValidStatute(rawStatute) ? rawStatute : base.primaryStatute;
  const def = STATUTES[statuteCode];

  return {
    ...base,
    stateCode: rawCode,
    countyName: agency?.countyName?.trim() || null,
    municipalityName: agency?.municipalityName?.trim() || null,
    timeZone: agency?.timeZone?.trim() || base.timeZone,
    primaryStatute: statuteCode,
    statuteLabel: statuteCode === 'MIFOIA' ? 'MI FOIA' : statuteCode,
    statuteCitation: def.citation,
    initialResponseBusinessDays: def.defaultWorkingDays,
    maxSingleExtensionBusinessDays: def.maxExtensionWorkingDays,
    supportsNonPecuniaryAffirmation: def.requiresNonPecuniaryAffirmation,
  };
}

export function formatJurisdictionPath(
  agency?: Pick<AgencyRecord, 'stateCode' | 'countyName' | 'municipalityName' | 'jurisdiction'> | null
): string {
  const parts = [
    agency?.municipalityName?.trim(),
    agency?.countyName?.trim() ? `${agency.countyName.trim()} County` : null,
    agency?.stateCode?.trim(),
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' > ');
  return (agency?.jurisdiction || 'Unassigned Jurisdiction').trim();
}
