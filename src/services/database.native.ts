import * as SQLite from 'expo-sqlite';
import { seedAgencies, seedItems } from '../data/seedData';
import { AgencyRecord, AuditEntry, PublicRecordItem, RecordStatus } from '../types/models';

const DB_NAME = 'records_tracker.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let useMemoryFallback = false;

const memoryStore: {
  initialized: boolean;
  items: PublicRecordItem[];
  agencies: AgencyRecord[];
  audits: AuditEntry[];
} = {
  initialized: false,
  items: [],
  agencies: [],
  audits: [],
};

async function getDb(): Promise<SQLite.SQLiteDatabase | null> {
  if (useMemoryFallback) return null;
  if (dbInstance) return dbInstance;

  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    dbInstance = db;
    return db;
  } catch {
    useMemoryFallback = true;
    return null;
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDb();

  if (!db) {
    if (!memoryStore.initialized) {
      memoryStore.agencies = [...seedAgencies];
      memoryStore.items = [...seedItems];
      memoryStore.audits = [];
      memoryStore.initialized = true;
    }
    return;
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      stateCode TEXT NOT NULL,
      contactEmail TEXT NOT NULL,
      portalUrl TEXT NOT NULL,
      defaultStatute TEXT NOT NULL,
      formPdfRelativePath TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS record_items (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      agencyId TEXT NOT NULL,
      agencyName TEXT NOT NULL,
      statuteCode TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      sentAt TEXT,
      dueDate TEXT,
      feeQuoted REAL,
      notes TEXT NOT NULL,
      parentItemId TEXT,
      batchLabel TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_entries (
      id TEXT PRIMARY KEY NOT NULL,
      itemId TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  const agencyCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM agencies'
  );
  if ((agencyCountRow?.count ?? 0) === 0) {
    for (const agency of seedAgencies) {
      await saveAgency(agency);
    }
  }

  const itemCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM record_items'
  );
  if ((itemCountRow?.count ?? 0) === 0) {
    for (const item of seedItems) {
      await upsertItem(item);
    }
  }
}

export async function getAllAgencies(): Promise<AgencyRecord[]> {
  await initDatabase();
  const db = await getDb();
  if (!db) {
    return [...memoryStore.agencies].sort((a, b) => a.name.localeCompare(b.name));
  }
  return await db.getAllAsync<AgencyRecord>(
    'SELECT * FROM agencies ORDER BY name ASC'
  );
}

export async function saveAgency(agency: AgencyRecord): Promise<void> {
  const db = await getDb();
  if (!db) {
    const idx = memoryStore.agencies.findIndex((a) => a.id === agency.id);
    if (idx >= 0) memoryStore.agencies[idx] = agency;
    else memoryStore.agencies.push(agency);
    return;
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO agencies
      (id, name, jurisdiction, stateCode, contactEmail, portalUrl, defaultStatute, formPdfRelativePath)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agency.id,
      agency.name,
      agency.jurisdiction,
      agency.stateCode,
      agency.contactEmail,
      agency.portalUrl,
      agency.defaultStatute,
      agency.formPdfRelativePath,
    ]
  );
}

export async function getAllItems(): Promise<PublicRecordItem[]> {
  await initDatabase();
  const db = await getDb();
  if (!db) {
    return [...memoryStore.items].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }
  return await db.getAllAsync<PublicRecordItem>(
    'SELECT * FROM record_items ORDER BY createdAt DESC'
  );
}

export async function getItemById(id: string): Promise<PublicRecordItem | null> {
  await initDatabase();
  const db = await getDb();
  if (!db) {
    return memoryStore.items.find((i) => i.id === id) ?? null;
  }
  const row = await db.getFirstAsync<PublicRecordItem>(
    'SELECT * FROM record_items WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function upsertItem(item: PublicRecordItem): Promise<void> {
  const db = await getDb();
  if (!db) {
    const idx = memoryStore.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) memoryStore.items[idx] = item;
    else memoryStore.items.unshift(item);
    return;
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO record_items
      (id, title, agencyId, agencyName, statuteCode, summary, status, createdAt, sentAt, dueDate, feeQuoted, notes, parentItemId, batchLabel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.title,
      item.agencyId,
      item.agencyName,
      item.statuteCode,
      item.summary,
      item.status,
      item.createdAt,
      item.sentAt,
      item.dueDate,
      item.feeQuoted,
      item.notes,
      item.parentItemId,
      item.batchLabel,
    ]
  );
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
  const db = await getDb();
  if (!db) {
    memoryStore.audits.unshift(entry);
    return;
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO audit_entries (id, itemId, action, detail, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [entry.id, entry.itemId, entry.action, entry.detail, entry.createdAt]
  );
}

export async function deleteAuditEntry(itemId: string, entryId: string): Promise<void> {
  await initDatabase();
  const db = await getDb();
  memoryStore.audits = memoryStore.audits.filter(
    (a) => !(a.itemId === itemId && a.id === entryId)
  );
  if (db) {
    await db.runAsync('DELETE FROM audit_entries WHERE id = ? AND itemId = ?', [entryId, itemId]);
  }
}

export async function getAuditEntries(itemId: string): Promise<AuditEntry[]> {
  await initDatabase();
  const db = await getDb();
  if (!db) {
    return memoryStore.audits
      .filter((a) => a.itemId === itemId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return await db.getAllAsync<AuditEntry>(
    'SELECT * FROM audit_entries WHERE itemId = ? ORDER BY createdAt DESC',
    [itemId]
  );
}

export async function exportVaultJson(): Promise<string> {
  await initDatabase();
  const db = await getDb();
  if (!db) {
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

  const agencies = await db.getAllAsync<AgencyRecord>('SELECT * FROM agencies');
  const items = await db.getAllAsync<PublicRecordItem>('SELECT * FROM record_items');
  const audits = await db.getAllAsync<AuditEntry>('SELECT * FROM audit_entries');

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      agencies,
      items,
      audits,
    },
    null,
    2
  );
}

export async function importVaultJson(jsonString: string): Promise<number> {
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