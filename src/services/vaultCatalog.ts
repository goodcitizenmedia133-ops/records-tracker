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
  { id: 'statute-co-cora', kind: 'statute', jurisdiction: 'US-CO', code: 'CORA', title: 'Colorado Open Records Act', citation: 'C.R.S. §§ 24-72-200.1–206', responseWindowNote: '3 working days (up to +7 working days under C.R.S. § 24-72-203(3)(b))', tags: ['cora','colorado','public-records'] },
  { id: 'statute-co-ccjra', kind: 'statute', jurisdiction: 'US-CO', code: 'CCJRA', title: 'Colorado Criminal Justice Records Act', citation: 'C.R.S. §§ 24-72-301–309', responseWindowNote: 'Prompt inspection/production per C.R.S. § 24-72-301 et seq.', tags: ['ccjra','colorado','criminal-justice','dispatch','incident'] },
  { id: 'statute-fed-foia', kind: 'statute', jurisdiction: 'US-FED', code: 'FOIA', title: 'Freedom of Information Act', citation: '5 U.S.C. § 552', responseWindowNote: '20 business days (up to +10 business days under 5 U.S.C. § 552(a)(6)(B))', tags: ['foia','federal'] },
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

export type VaultCatalogSource = 'remote' | 'local';

export interface VaultCatalogLoadResult {
  entries: VaultCatalogEntry[];
  source: VaultCatalogSource;
  error?: string;
}

const CATALOG_NL = String.fromCharCode(10);

function catalogTrimEndSlashes(s: string): string {
  let e = s.length;
  while (e > 0 && s.charAt(e - 1) === '/') e -= 1;
  return s.slice(0, e);
}

export function normalizeJurisdictionCode(input: string): JurisdictionCode {
  const c = input.trim().toUpperCase();
  if (c === 'FED' || c === 'FEDERAL' || c === 'US-FED') return 'US-FED';
  if (c === 'COLORADO') return 'US-CO';
  if (c.length === 2) return 'US-' + c;
  return c;
}

export function buildCatalogRemoteUrl(jurisdiction?: JurisdictionCode): string {
  const path = buildCatalogIndexPath(jurisdiction);
  const override = catalogTrimEndSlashes((process.env.EXPO_PUBLIC_VAULT_CATALOG_BASE_URL || '').trim());
  if (override) return override + '/' + path;
  const repo = (process.env.EXPO_PUBLIC_VAULT_GITHUB_REPO || DEFAULT_VAULT_CONFIG.githubIndexRepo).trim();
  const branch = (process.env.EXPO_PUBLIC_VAULT_GITHUB_BRANCH || DEFAULT_VAULT_CONFIG.githubIndexBranch || 'master').trim();
  if (!repo) return '';
  return 'https://raw.githubusercontent.com/' + repo + '/' + branch + '/' + path;
}

function catalogMergeAndFilter(lists: VaultCatalogEntry[][], jurisdiction?: JurisdictionCode): VaultCatalogEntry[] {
  const all: VaultCatalogEntry[] = [];
  lists.forEach((l) => { l.forEach((i) => all.push(i)); });
  return dedupeCatalogEntries(jurisdiction ? all.filter((i) => i && i.jurisdiction === jurisdiction) : all);
}

export async function loadVaultCatalogWithSource(jurisdiction?: JurisdictionCode, timeoutMs: number = 8000): Promise<VaultCatalogLoadResult> {
  const staged = readLocalStagedCatalogEntries();
  const local = (): VaultCatalogEntry[] => catalogMergeAndFilter([staged, BUNDLED_CATALOG], jurisdiction);
  const url = buildCatalogRemoteUrl(jurisdiction);
  if (!url) return { entries: local(), source: 'local', error: 'No remote catalog configured' };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return { entries: local(), source: 'local', error: 'Catalog HTTP ' + res.status };
    const data = await res.json();
    const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : null;
    if (!list) return { entries: local(), source: 'local', error: 'Catalog JSON has no entries array' };
    const remote: VaultCatalogEntry[] = list.filter((x: unknown) => !!x && typeof x === 'object');
    return { entries: catalogMergeAndFilter([staged, remote, BUNDLED_CATALOG], jurisdiction), source: 'remote' };
  } catch (err) {
    return { entries: local(), source: 'local', error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadVaultCatalog(jurisdiction?: JurisdictionCode): Promise<VaultCatalogEntry[]> {
  const result = await loadVaultCatalogWithSource(jurisdiction);
  return result.entries;
}

export function formatCatalogEntryJson(entry: VaultCatalogEntry): string {
  return JSON.stringify(entry, null, 2) + CATALOG_NL;
}

export function formatCatalogIndexJson(entries: VaultCatalogEntry[], jurisdiction?: JurisdictionCode, generatedAt?: string): string {
  const scoped = dedupeCatalogEntries(jurisdiction ? entries.filter((e) => e && e.jurisdiction === jurisdiction) : entries);
  const sorted = scoped.slice().sort((x, y) => String(x.jurisdiction || '').localeCompare(String(y.jurisdiction || '')) || String(x.kind || '').localeCompare(String(y.kind || '')) || String(x.id || '').localeCompare(String(y.id || '')));
  return JSON.stringify({ version: 1, generatedAt: generatedAt || new Date().toISOString(), jurisdiction: jurisdiction || null, entries: sorted }, null, 2) + CATALOG_NL;
}

export function buildGithubIndexFiles(entries: VaultCatalogEntry[], generatedAt?: string): Array<{ path: string; content: string }> {
  const stamp = generatedAt || new Date().toISOString();
  const files: Array<{ path: string; content: string }> = [{ path: buildCatalogIndexPath(), content: formatCatalogIndexJson(entries, undefined, stamp) }];
  const seen: string[] = [];
  entries.forEach((e) => { if (e && e.jurisdiction && seen.indexOf(e.jurisdiction) < 0) seen.push(e.jurisdiction); });
  seen.sort().forEach((j) => { files.push({ path: buildCatalogIndexPath(j), content: formatCatalogIndexJson(entries, j, stamp) }); });
  return files;
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
