import { DEFAULT_VAULT_CONFIG } from './vaultPublisher';
export type CatalogKind = 'statute' | 'form' | 'record';

export type JurisdictionCode = 'US-CO' | 'US-FED' | string;

export interface VaultCatalogEntry {
  id: string;
  kind: CatalogKind;
  jurisdiction: JurisdictionCode;
  title: string;
  code?: string;
  citation?: string;
  agencyName?: string;
  responseWindowNote?: string;
  tags?: string[];
  r2Key?: string;
}

const LOCAL_STAGED_CATALOG_KEY = 'gcm_vault_staged_entries_v1';

export const BUNDLED_CATALOG: VaultCatalogEntry[] = [
  { id: 'statute-co-cora', kind: 'statute', jurisdiction: 'US-CO', code: 'CORA', title: 'Colorado Open Records Act', citation: 'C.R.S. ?? 24-72-200.1?206', responseWindowNote: '3 working days (up to +7 working days under C.R.S. ? 24-72-203(3)(b))', tags: ['cora','colorado','public-records'] },
  { id: 'statute-co-ccjra', kind: 'statute', jurisdiction: 'US-CO', code: 'CCJRA', title: 'Colorado Criminal Justice Records Act', citation: 'C.R.S. ?? 24-72-301?309', responseWindowNote: 'Prompt inspection/production per C.R.S. ? 24-72-301 et seq.', tags: ['ccjra','colorado','criminal-justice','dispatch','incident'] },
  { id: 'statute-fed-foia', kind: 'statute', jurisdiction: 'US-FED', code: 'FOIA', title: 'Freedom of Information Act', citation: '5 U.S.C. ? 552', responseWindowNote: '20 business days (up to +10 business days under 5 U.S.C. ? 552(a)(6)(B))', tags: ['foia','federal'] },
];

export function readLocalStagedCatalogEntries(): VaultCatalogEntry[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LOCAL_STAGED_CATALOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupeCatalogEntries(parsed) : [];
  } catch {
    return [];
  }
}

export function clearLocalStagedCatalogEntries(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LOCAL_STAGED_CATALOG_KEY);
    }
  } catch {}
}

export function saveLocalStagedCatalogEntry(entry: VaultCatalogEntry): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const existing = readLocalStagedCatalogEntries();
    const merged = dedupeCatalogEntries([entry, ...existing]);
    window.localStorage.setItem(LOCAL_STAGED_CATALOG_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

export function buildCatalogIndexPath(jurisdiction?: JurisdictionCode): string {
  return jurisdiction ? `index/${jurisdiction}.json` : 'index/catalog.json';
}

export function formatCatalogCommitPayload(entry: VaultCatalogEntry, jurisdiction?: JurisdictionCode) {
  return { path: buildCatalogIndexPath(jurisdiction || entry.jurisdiction), entry };
}

export async function loadVaultCatalog(jurisdiction?: JurisdictionCode): Promise<VaultCatalogEntry[]> {
  const repo = (process.env.EXPO_PUBLIC_VAULT_GITHUB_REPO || DEFAULT_VAULT_CONFIG.githubIndexRepo).trim();
  const branch = (process.env.EXPO_PUBLIC_VAULT_GITHUB_BRANCH || 'main');
  const localStaged = readLocalStagedCatalogEntries();
  const filterByJurisdiction = (items: VaultCatalogEntry[]) =>
    jurisdiction ? items.filter((item) => item.jurisdiction === jurisdiction) : items;

  if (!repo) {
    return dedupeCatalogEntries(filterByJurisdiction([...localStaged, ...BUNDLED_CATALOG]));
  }
  try {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${buildCatalogIndexPath(jurisdiction)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return dedupeCatalogEntries(filterByJurisdiction([...localStaged, ...BUNDLED_CATALOG]));
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : BUNDLED_CATALOG;
    return dedupeCatalogEntries(filterByJurisdiction([...localStaged, ...list, ...BUNDLED_CATALOG]));
  } catch {
    return dedupeCatalogEntries(filterByJurisdiction([...localStaged, ...BUNDLED_CATALOG]));
  }
}

export function resolveIndexFileForState(stateCode: string): string {
  const clean = stateCode.trim().toUpperCase();
  if (clean === 'CO' || clean === 'COLORADO' || clean === 'US-CO') return 'index/US-CO.json';
  if (clean === 'FED' || clean === 'FEDERAL' || clean === 'US-FED') return 'index/US-FED.json';
  return 'index/catalog.json';
}

export function dedupeCatalogEntries(items: VaultCatalogEntry[]): VaultCatalogEntry[] {
  const seen = new Set<string>();
  const out: VaultCatalogEntry[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const key = String(item.id || '').trim() || String((item as any).sha256Hex || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
