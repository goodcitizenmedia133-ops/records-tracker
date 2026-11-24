import { seedAgencies, seedItems } from '../data/seedData';
import { AgencyRecord, AuditEntry, PublicRecordItem, RecordStatus } from '../types/models';

const STORAGE_KEY = 'records_tracker_web_v1';

interface StoreShape {
  items: PublicRecordItem[];
  agencies: AgencyRecord[];
  audits: AuditEntry[];
}

const memoryStore: StoreShape & { initialized: boolean } = {
  initialized: false,
  items: [],
  agencies: [],
  audits: [],
};

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function loadFromStorage(): StoreShape | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (
      !Array.isArray(parsed.items) ||
      !Array.isArray(parsed.agencies) ||
      !Array.isArray(parsed.audits)
    ) {
      return null;
    }
    return {
      items: parsed.items,
      agencies: parsed.agencies,
      audits: parsed.audits,
    };
  } catch {
    return null;
  }
}

function persist(): void {
  if (!hasLocalStorage()) return;
  try {
    const payload: StoreShape = {
      items: memoryStore.items,
      agencies: memoryStore.agencies,
      audits: memoryStore.audits,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or blocked (for example, some private windows).
    // The app keeps working in memory for this session.
  }
}

export async function initDatabase(): Promise<void> {
  if (memoryStore.initialized) return;

  const saved = loadFromStorage();
  if (saved) {
    memoryStore.agencies = saved.agencies;
    memoryStore.items = saved.items;
    memoryStore.audits = saved.audits;
  } else {
    memoryStore.agencies = [...seedAgencies];
    memoryStore.items = [...seedItems];
    memoryStore.audits = [];
    persist();
  }
  memoryStore.initialized = true;
}

export async function getAllAgencies(): Promise<AgencyRecord[]> {
  await initDatabase();
  return [...memoryStore.agencies].sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveAgency(agency: AgencyRecord): Promise<void> {
  await initDatabase();
  const idx = memoryStore.agencies.findIndex((a) => a.id === agency.id);
  if (idx >= 0) memoryStore.agencies[idx] = agency;
  else memoryStore.agencies.push(agency);
  persist();
}

export async function getAllItems(): Promise<PublicRecordItem[]> {
  await initDatabase();
  return [...memoryStore.items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function getItemById(id: string): Promise<PublicRecordItem | null> {
  await initDatabase();
  return memoryStore.items.find((i) => i.id === id) ?? null;
}

export async function upsertItem(item: PublicRecordItem): Promise<void> {
  await initDatabase();
  const idx = memoryStore.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) memoryStore.items[idx] = item;
  else memoryStore.items.unshift(item);
  persist();
}

export async function searchItems(
  query: string,
  statusFilter: RecordStatus | 'all' = 'all'
): Promise<PublicRecordItem[]> {
  const all = await getAllItems();
  const q = query.trim().toLowerCase();

  return all.filter((item) => {
    const matchesStatus =
      statusFilter === 'all' ? true : item.status === statusFilter;
    if (!matchesStatus) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.agencyName.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.statuteCode.toLowerCase().includes(q)
    );
  });
}

export async function findRecentDuplicates(
  agencyId: string,
  withinDays = 30
): Promise<PublicRecordItem[]> {
  const all = await getAllItems();
  const cutoffMs = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return all.filter((item) => {
    if (item.agencyId !== agencyId) return false;
    const createdMs = Date.parse(item.createdAt);
    return !Number.isNaN(createdMs) && createdMs >= cutoffMs;
  });
}

export async function addAuditEntry(entry: AuditEntry): Promise<void> {
  await initDatabase();
  const idx = memoryStore.audits.findIndex((a) => a.id === entry.id);
  if (idx >= 0) memoryStore.audits[idx] = entry;
  else memoryStore.audits.unshift(entry);
  persist();
}

export async function deleteAuditEntry(itemId: string, entryId: string): Promise<void> {
  await initDatabase();
  memoryStore.audits = memoryStore.audits.filter(
    (a) => !(a.itemId === itemId && a.id === entryId)
  );
  persist();
}

export async function getAuditEntries(itemId: string): Promise<AuditEntry[]> {
  await initDatabase();
  return memoryStore.audits
    .filter((a) => a.itemId === itemId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function exportVaultJson(): Promise<string> {
  await initDatabase();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      agencies: memoryStore.agencies,
      items: memoryStore.items,
      audits: memoryStore.audits,
    },
    null,
    2
  );
}

export async function importVaultJson(jsonString: string): Promise<number> {
  await initDatabase();
  const parsed = JSON.parse(jsonString) as {
    agencies?: AgencyRecord[];
    items?: PublicRecordItem[];
    audits?: AuditEntry[];
  };

  let importedCount = 0;

  if (Array.isArray(parsed.agencies)) {
    for (const agency of parsed.agencies) {
      await saveAgency(agency);
    }
  }

  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      await upsertItem(item);
      importedCount += 1;
    }
  }

  if (Array.isArray(parsed.audits)) {
    for (const audit of parsed.audits) {
      await addAuditEntry(audit);
    }
  }

  return importedCount;
}