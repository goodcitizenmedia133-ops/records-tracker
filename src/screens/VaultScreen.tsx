import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { StatuteCode } from '../data/statutes';
import {
    exportVaultJson,
    getAllAgencies,
    importVaultJson,
    saveAgency,
} from '../services/database';
import { scrubPii } from '../services/piiScrubber';
import {
    BUNDLED_CATALOG,
    clearLocalStagedCatalogEntries,
  loadVaultCatalog,
    VaultCatalogEntry,
} from '../services/vaultCatalog';
import { AgencyRecord } from '../types/models';

interface VaultScreenProps {
  onDataChanged: () => void;
  onOpenUpload?: () => void;
}

const STATUTE_CHOICES: StatuteCode[] = ['CORA', 'CCJRA', 'MIFOIA', 'FOIA'];

export function VaultScreen({ onDataChanged, onOpenUpload }: VaultScreenProps) {
  const [agencies, setAgencies] = useState<AgencyRecord[]>([]);
  const [agencyName, setAgencyName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [defaultStatute, setDefaultStatute] = useState<StatuteCode>('CORA');

  const [catalogEntries, setCatalogEntries] = useState<VaultCatalogEntry[]>(BUNDLED_CATALOG);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [agencySearch, setAgencySearch] = useState('');
  const [agencyStatuteFilter, setAgencyStatuteFilter] = useState<'ALL' | StatuteCode>('ALL');

  const [piiInput, setPiiInput] = useState('');
  const [piiOutput, setPiiOutput] = useState('');
  const [piiCount, setPiiCount] = useState<number | null>(null);

  const [backupJson, setBackupJson] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadAgencies = useCallback(async () => {
    const list = await getAllAgencies();
    setAgencies(list);
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const entries = await loadVaultCatalog();
      const next = entries.length > 0 ? entries : BUNDLED_CATALOG;
      setCatalogEntries(next);
      setStatusBanner(`Catalog refreshed (${next.length} entries available).`);
    } catch {
      setCatalogEntries(BUNDLED_CATALOG);
      setStatusBanner(`Using bundled catalog (${BUNDLED_CATALOG.length} entries).`);
    }
  }, []);

  useEffect(() => {
    void loadAgencies();
    void refreshCatalog();
  }, [loadAgencies, refreshCatalog]);

  const handleAddAgency = async () => {
    const cleanName = agencyName.trim();
    if (!cleanName) {
      Alert.alert('Agency Name Required', 'Enter an agency name first.');
      return;
    }

    const record: AgencyRecord = {
      id: `agency-${Date.now()}`,
      name: cleanName,
      jurisdiction: jurisdiction.trim() || 'Colorado',
      stateCode: defaultStatute === 'FOIA' ? 'US' : defaultStatute === 'MIFOIA' ? 'MI' : 'CO',
      contactEmail: contactEmail.trim(),
      portalUrl: portalUrl.trim(),
      defaultStatute,
      formPdfRelativePath: '',
    };

    await saveAgency(record);
    setAgencyName('');
    setJurisdiction('');
    setContactEmail('');
    setPortalUrl('');
    await loadAgencies();
    onDataChanged();
    setStatusBanner(`Saved agency: ${record.name}`);
  };

  const handleRunScrubber = () => {
    const res = scrubPii(piiInput);
    setPiiOutput(res.scrubbedText);
    setPiiCount(res.totalRedactions);
  };

  const handleCopyScrubbed = async () => {
    if (!piiOutput) return;
    await Clipboard.setStringAsync(piiOutput);
    setStatusBanner('Redacted text copied to clipboard.');
  };

  const handleExportBackup = async () => {
    const json = await exportVaultJson();
    setBackupJson(json);
    await Clipboard.setStringAsync(json);
    setStatusBanner('Full JSON vault exported below and copied to clipboard.');
  };

  const handleImportBackup = async () => {
    const raw = backupJson.trim();
    if (!raw) {
      Alert.alert('No JSON Provided', 'Paste a vault backup JSON first.');
      return;
    }
    try {
      const count = await importVaultJson(raw);
      await loadAgencies();
      onDataChanged();
      setStatusBanner(`Imported ${count} record items from JSON backup.`);
    } catch {
      Alert.alert(
        'Invalid Backup JSON',
        'Could not parse that backup JSON. Make sure you pasted the full export.'
      );
    }
  };

  const filteredCatalog = catalogEntries.filter((entry) => {
    const q = catalogFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.title.toLowerCase().includes(q) ||
      entry.jurisdiction.toLowerCase().includes(q) ||
      entry.kind.toLowerCase().includes(q) ||
      entry.id.toLowerCase().includes(q)
    );
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Agencies, Personal Info Redactor &amp; Vault</Text>
      <Text style={styles.sub}>
        100% local SQLite storage ? zero cloud sync
      </Text>

      {statusBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{statusBanner}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Vault Catalog &amp; Upload Wizard</Text>
        <Text style={styles.muted}>
          Browse indexed forms and reference records ({catalogEntries.length} available) or stage a new PDF/index entry.
        </Text>
        <View style={styles.rowBtns}>
          {onOpenUpload ? (
            <Pressable onPress={onOpenUpload} style={[styles.primaryBtn, { flex: 1 }]}>
              <Text style={styles.primaryBtnText}>Open Upload Wizard</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void refreshCatalog()}
            style={[styles.secondaryBtn, { flex: 1 }]}
          >
            <Text style={styles.secondaryBtnText}>Refresh Catalog</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearLocalStagedCatalogEntries();
              void refreshCatalog();
              setStatusBanner('Cleared locally staged catalog test entries.');
            }}
            style={[styles.secondaryBtn, { flex: 1 }]}
          >
            <Text style={styles.secondaryBtnText}>Clear Staged</Text>
          </Pressable>
        </View>
        <TextInput
          value={catalogFilter}
          onChangeText={setCatalogFilter}
          placeholder="Filter catalog by agency, title, jurisdiction, or kind..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        {filteredCatalog.slice(0, 8).map((entry) => (
          <View key={entry.id} style={styles.agencyRow}>
            <Text style={styles.agencyName}>{entry.title}</Text>
            <Text style={styles.agencyMeta}>
              {entry.jurisdiction} ? {entry.kind} ? {entry.id}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add Custodian / Agency</Text>
        <TextInput
          value={agencyName}
          onChangeText={setAgencyName}
          placeholder="Agency name (e.g. City Clerk)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={jurisdiction}
          onChangeText={setJurisdiction}
          placeholder="Jurisdiction (e.g. Huerfano County, CO)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="Records custodian email"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={portalUrl}
          onChangeText={setPortalUrl}
          placeholder="Online records portal URL (optional)"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          style={styles.input}
        />

        <View style={styles.statuteRow}>
          {STATUTE_CHOICES.map((code) => {
            const active = defaultStatute === code;
            return (
              <Pressable
                key={code}
                onPress={() => setDefaultStatute(code)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text
                  style={[
                    styles.chipBtnText,
                    active && styles.chipBtnTextActive,
                  ]}
                >
                  {code}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => void handleAddAgency()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Save Agency</Text>
        </Pressable>

        <Text style={styles.listHeader}>
          Saved Agencies ({agencies.length})
        </Text>
        <TextInput
          value={agencySearch}
          onChangeText={setAgencySearch}
          placeholder="Search agencies by name, jurisdiction, or email..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <View style={styles.statuteRow}>
          {(['ALL', ...STATUTE_CHOICES] as const).map((code) => {
            const active = agencyStatuteFilter === code;
            return (
              <Pressable
                key={code}
                onPress={() => setAgencyStatuteFilter(code)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                  {code}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {agencies
          .filter((a) => {
            const matchesStatute =
              agencyStatuteFilter === 'ALL' ||
              (a.defaultStatute || '').toUpperCase() === agencyStatuteFilter;
            if (!matchesStatute) return false;
            const q = agencySearch.trim().toLowerCase();
            if (!q) return true;
            return (
              a.name.toLowerCase().includes(q) ||
              a.jurisdiction.toLowerCase().includes(q) ||
              (a.contactEmail || '').toLowerCase().includes(q) ||
              (a.defaultStatute || '').toLowerCase().includes(q)
            );
          })
          .map((a) => (
          <View key={a.id} style={styles.agencyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.agencyName}>{a.name}</Text>
              <Text style={styles.agencyMeta}>
                {a.jurisdiction} ? {a.defaultStatute}
                {a.contactEmail ? ` ? ${a.contactEmail}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Hide Personal Info (Local)</Text>
        <Text style={styles.muted}>
          Strips SSNs, phone numbers, emails, street addresses, and case/ID
          numbers locally before sharing.
        </Text>
        <TextInput
          value={piiInput}
          onChangeText={setPiiInput}
          placeholder="Paste text containing personal details to redact..."
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />
        <Pressable onPress={handleRunScrubber} style={styles.darkBtn}>
          <Text style={styles.darkBtnText}>Hide Personal Info</Text>
        </Pressable>

        {piiCount !== null ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultCount}>
              Redacted {piiCount} {piiCount === 1 ? 'item' : 'items'}:
            </Text>
            <Text style={styles.resultText}>{piiOutput}</Text>
            <Pressable onPress={() => void handleCopyScrubbed()} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Copy Redacted Text</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Local JSON Vault Backup</Text>
        <View style={styles.rowBtns}>
          <Pressable
            onPress={() => void handleExportBackup()}
            style={[styles.primaryBtn, { flex: 1 }]}
          >
            <Text style={styles.primaryBtnText}>Export &amp; Copy</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleImportBackup()}
            style={[styles.secondaryBtn, { flex: 1 }]}
          >
            <Text style={styles.secondaryBtnText}>Restore JSON</Text>
          </Pressable>
        </View>
        <TextInput
          value={backupJson}
          onChangeText={setBackupJson}
          placeholder="Exported vault JSON appears here ? or paste JSON to restore..."
          placeholderTextColor="#9CA3AF"
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  sub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 14,
  },
  banner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  muted: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  input: {
    minHeight: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 96,
  },
  statuteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
  },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  darkBtn: {
    minHeight: 46,
    backgroundColor: '#111827',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  darkBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  listHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  agencyRow: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
  },
  agencyName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  agencyMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  resultBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  resultText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
  },
});
