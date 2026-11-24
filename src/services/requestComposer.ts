import { BUNDLED_CATALOG, JurisdictionCode, VaultCatalogEntry } from './vaultCatalog';

export interface VaultPatternHint {
  id: string;
  kind: 'form' | 'record';
  jurisdiction: JurisdictionCode;
  title: string;
  agencyName?: string;
  r2Key?: string;
  score: number;
}

export function getCatalogStatutesByJurisdiction(jurisdiction: JurisdictionCode, entries: VaultCatalogEntry[] = BUNDLED_CATALOG): VaultCatalogEntry[] {
  return entries.filter((item) => item.kind === 'statute' && item.jurisdiction.toUpperCase() === jurisdiction.toUpperCase());
}

export function findVaultPatternHints(query: string, jurisdiction?: JurisdictionCode, entries: VaultCatalogEntry[] = BUNDLED_CATALOG, limit = 5): VaultCatalogEntry[] {
  const tokens = query.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t.length >= 2);
  const candidates = entries.filter((item) => {
    if (item.kind === 'statute') return false;
    if (jurisdiction && item.jurisdiction.toUpperCase() !== jurisdiction.toUpperCase()) return false;
    return true;
  });
  if (!tokens.length) return candidates.slice(0, limit);
  return candidates.map((item) => {
    const haystack = [item.id, item.kind, item.jurisdiction, item.title, item.code || '', item.citation || '', item.agencyName || '', item.r2Key || '', ...(item.tags || [])].join(' ').toLowerCase();
    let score = 0;
    for (const token of tokens) { if (haystack.includes(token)) score += 1; }
    return { item, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)).slice(0, limit).map((row) => row.item);
}
export function composeStructuredRequest(params: { jurisdiction: JurisdictionCode; agencyName: string; subject: string; statutoryBasis?: string; entries?: VaultCatalogEntry[] }) {
  const statutes = getCatalogStatutesByJurisdiction(params.jurisdiction, params.entries || BUNDLED_CATALOG);
  const basis = params.statutoryBasis || statutes[0]?.citation || statutes[0]?.code || params.jurisdiction;
  return { jurisdiction: params.jurisdiction, agencyName: params.agencyName.trim(), statutoryBasis: basis, statutes, body: `Pursuant to ${basis}, please provide records relating to: ${params.subject.trim()}.` };
}
