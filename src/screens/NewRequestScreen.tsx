import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StrategyCardList } from '../components/StrategyCardList';
import { addWorkingDays, getTodayCalendarDate, StatuteCode, STATUTES } from '../data/statutes';
import { addAuditEntry, getAllAgencies, saveAgency, upsertItem } from '../services/database';
import { findVaultPatternHints } from '../services/requestComposer';
import { JurisdictionCode } from '../services/vaultCatalog';
import { buildSplitChildItems, classifyRequestInput } from '../services/wizardEngine';
import { AgencyRecord, PublicRecordItem } from '../types/models';

interface NewRequestScreenProps {
  onBack?: () => void;
  onCancel?: () => void;
  onCreated?: (itemId: string) => void;
  onSaved?: (item: PublicRecordItem) => void;
}

const STATUTE_LIST: StatuteCode[] = ['CORA', 'CCJRA', 'FOIA'];

export function NewRequestScreen({ onBack, onCancel, onCreated, onSaved }: NewRequestScreenProps) {
  const [statuteCode, setStatuteCode] = useState<StatuteCode>('CORA');
  const [statuteManuallyPicked, setStatuteManuallyPicked] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [custodianEmail, setCustodianEmail] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [savedAgencies, setSavedAgencies] = useState<AgencyRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [createdItem, setCreatedItem] = useState<PublicRecordItem | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await getAllAgencies();
        if (active) setSavedAgencies(list);
      } catch {
        // Ignore load failure on initial render
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedAgency = useMemo(() => {
    const q = agencyName.trim().toLowerCase();
    if (!q) return null;
    return savedAgencies.find((a) => a.name.toLowerCase() === q) ?? null;
  }, [agencyName, savedAgencies]);

  const wizardPrompt = [agencyName, title, summary].filter(Boolean).join(' ').trim();
  const classification = useMemo(
    () => classifyRequestInput(wizardPrompt, selectedAgency),
    [wizardPrompt, selectedAgency]
  );

  useEffect(() => {
    if (!statuteManuallyPicked && wizardPrompt.length > 0) {
      setStatuteCode(classification.suggestedStatute);
    }
  }, [classification.suggestedStatute, statuteManuallyPicked, wizardPrompt.length]);

  const jurisdiction: JurisdictionCode = statuteCode === 'FOIA' ? 'US-FED' : 'US-CO';
  const stateCode = statuteCode === 'FOIA' ? 'US' : 'CO';

  const matchingAgencies = useMemo(() => {
    const q = agencyName.trim().toLowerCase();
    const filtered = q
      ? savedAgencies.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.contactEmail || '').toLowerCase().includes(q)
        )
      : savedAgencies;
    return filtered.slice(0, 6);
  }, [agencyName, savedAgencies]);

  const hintQuery = [statuteCode, agencyName, title, summary].join(' ').trim();
  const patternHints = findVaultPatternHints(hintQuery, jurisdiction, undefined, 5).filter(
    (entry) => entry.kind !== 'statute'
  );

  const handleSelectSavedAgency = (agency: AgencyRecord) => {
    setAgencyName(agency.name);
    if (agency.contactEmail) setCustodianEmail(agency.contactEmail);
    const upperStatute = (agency.defaultStatute || '').toUpperCase();
    if (upperStatute === 'CORA' || upperStatute === 'CCJRA' || upperStatute === 'FOIA') {
      setStatuteCode(upperStatute);
      setStatuteManuallyPicked(true);
    }
  };

  const handleApplyHint = (hintTitle: string) => {
    setSummary((prev) =>
      prev.trim()
        ? `${prev.trim()}\nReference pattern: ${hintTitle}`
        : `Reference pattern: ${hintTitle}`
    );
  };

  const handleAppendClause = (clauseText: string) => {
    setSummary((prev) => {
      if (prev.includes(clauseText)) return prev;
      return prev.trim() ? `${prev.trim()}\n\n${clauseText}` : clauseText;
    });
  };

  const handleClose = () => {
    if (onCancel) onCancel();
    else if (onBack) onBack();
  };

  const handleCreateSplitDrafts = async () => {
    const cleanAgency = agencyName.trim();
    if (!cleanAgency || classification.splitSuggestions.length === 0) return;
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const cleanCustodian = custodianEmail.trim();
      const existing = savedAgencies.find(
        (a) => a.name.toLowerCase() === cleanAgency.toLowerCase()
      );
      const agencyRecord: AgencyRecord = {
        id: existing ? existing.id : `ag-${Date.now()}`,
        name: cleanAgency,
        jurisdiction: existing?.jurisdiction || jurisdiction,
        stateCode: existing?.stateCode || stateCode,
        contactEmail: cleanCustodian || existing?.contactEmail || '',
        portalUrl: existing?.portalUrl || '',
        defaultStatute: statuteCode,
        formPdfRelativePath: existing?.formPdfRelativePath || '',
      };
      await saveAgency(agencyRecord);
      setSavedAgencies((prev) => {
        const next = prev.filter((a) => a.id !== agencyRecord.id);
        return [agencyRecord, ...next];
      });

      const dueDate = addWorkingDays(
        getTodayCalendarDate(),
        STATUTES[statuteCode].defaultWorkingDays
      );
      const parentItem: PublicRecordItem = {
        id: `req-${Date.now()}`,
        agencyId: agencyRecord.id,
        agencyName: agencyRecord.name,
        title: title.trim() || classification.suggestedTitle,
        summary: summary.trim(),
        notes: '',
        parentItemId: null,
        batchLabel: title.trim() || classification.suggestedTitle,
        statuteCode,
        status: 'draft',
        sentAt: null,
        dueDate,
        feeQuoted: null,
        sentEmailProof: null,
        responseEmailProof: null,
        createdAt: nowIso,
      };
      const children = buildSplitChildItems(parentItem, classification.splitSuggestions);
      for (const child of children) {
        await upsertItem(child);
        await addAuditEntry({
          id: `aud-${Date.now()}-${child.id}`,
          itemId: child.id,
          action: 'REQUEST_CREATED',
          detail: `Created split ${statuteCode} draft for ${agencyRecord.name}: ${child.title}`,
          createdAt: nowIso,
        });
      }
      if (children[0]) {
        setCreatedItem(children[0]);
        if (onSaved) onSaved(children[0]);
        if (onCreated) onCreated(children[0].id);
      }
      Alert.alert(
        'Split Drafts Created',
        `Created ${children.length} focused ${statuteCode} drafts for ${agencyRecord.name}.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const cleanAgency = agencyName.trim();
    const cleanTitle = title.trim();
    if (!cleanAgency || !cleanTitle) {
      Alert.alert('Missing Fields', 'Enter both an agency name and a request title.');
      return;
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const cleanCustodian = custodianEmail.trim();
      const existing = savedAgencies.find(
        (a) => a.name.toLowerCase() === cleanAgency.toLowerCase()
      );
      const agencyRecord: AgencyRecord = {
        id: existing ? existing.id : `ag-${Date.now()}`,
        name: cleanAgency,
        jurisdiction: existing?.jurisdiction || jurisdiction,
        stateCode: existing?.stateCode || stateCode,
        contactEmail: cleanCustodian || existing?.contactEmail || '',
        portalUrl: existing?.portalUrl || '',
        defaultStatute: statuteCode,
        formPdfRelativePath: existing?.formPdfRelativePath || '',
      };
      await saveAgency(agencyRecord);
      setSavedAgencies((prev) => {
        const next = prev.filter((a) => a.id !== agencyRecord.id);
        return [agencyRecord, ...next];
      });

      const dueDate = addWorkingDays(
        getTodayCalendarDate(),
        STATUTES[statuteCode].defaultWorkingDays
      );
      const newItem: PublicRecordItem = {
        id: `req-${Date.now()}`,
        agencyId: agencyRecord.id,
        agencyName: agencyRecord.name,
        title: cleanTitle,
        summary: summary.trim(),
        notes: '',
        parentItemId: null,
        batchLabel: null,
        statuteCode,
        status: 'draft',
        sentAt: null,
        dueDate,
        feeQuoted: null,
        sentEmailProof: null,
        responseEmailProof: null,
        createdAt: nowIso,
      };
      await upsertItem(newItem);
      await addAuditEntry({
        id: `aud-${Date.now()}`,
        itemId: newItem.id,
        action: 'REQUEST_CREATED',
        detail: `Created ${statuteCode} draft for ${agencyRecord.name}: ${cleanTitle}`,
        createdAt: nowIso,
      });

      setCreatedItem(newItem);
      if (onSaved) onSaved(newItem);
      if (onCreated) onCreated(newItem.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps='handled'
    >
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.badge}>Request Wizard</Text>
      </View>

      <Text style={styles.title}>Build Public Records Request</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Statute (Auto-Suggested: {classification.suggestedStatute} · Vault: {jurisdiction})</Text>
        <View style={styles.row}>
          {STATUTE_LIST.map((code) => (
            <Pressable
              key={code}
              onPress={() => {
                setStatuteCode(code);
                setStatuteManuallyPicked(true);
              }}
              style={[styles.chip, statuteCode === code && styles.chipActive]}
            >
              <Text style={[styles.chipText, statuteCode === code && styles.chipTextActive]}>
                {code}
              </Text>
            </Pressable>
          ))}
        </View>
        {wizardPrompt.length > 0 && statuteManuallyPicked && statuteCode !== classification.suggestedStatute ? (
          <Pressable
            onPress={() => {
              setStatuteCode(classification.suggestedStatute);
              setStatuteManuallyPicked(false);
            }}
          >
            <Text style={styles.autoSuggestLink}>
              Use predictive suggestion: {classification.suggestedStatute}
            </Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>Agency Name</Text>
        <TextInput
          value={agencyName}
          onChangeText={setAgencyName}
          placeholder='e.g. City of Walsenburg or BLM Royal Gorge Field Office'
          placeholderTextColor='#9CA3AF'
          style={styles.input}
        />

        {matchingAgencies.length > 0 ? (
          <View style={styles.agencyBox}>
            <Text style={styles.agencyHeading}>Saved Agencies (tap to auto-fill)</Text>
            <View style={styles.agencyWrap}>
              {matchingAgencies.map((ag) => (
                <Pressable
                  key={ag.id}
                  onPress={() => handleSelectSavedAgency(ag)}
                  style={styles.agencyChip}
                >
                  <Text style={styles.agencyChipName}>{ag.name}</Text>
                  {ag.contactEmail ? (
                    <Text style={styles.agencyChipEmail}>{ag.contactEmail}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Custodian Email (saved with agency for handoff)</Text>
        <TextInput
          value={custodianEmail}
          onChangeText={setCustodianEmail}
          placeholder='records@agency.gov'
          placeholderTextColor='#9CA3AF'
          keyboardType='email-address'
          autoCapitalize='none'
          style={styles.input}
        />

        <Text style={styles.label}>Request Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder='e.g. Police dispatch log or municipal contract records'
          placeholderTextColor='#9CA3AF'
          style={styles.input}
        />

        <Text style={styles.label}>Scope of Requested Records</Text>
        <TextInput
          value={summary}
          onChangeText={setSummary}
          placeholder='Describe dates, departments, and specific records requested...'
          placeholderTextColor='#9CA3AF'
          multiline
          style={[styles.input, styles.textArea]}
        />

        {wizardPrompt.length > 0 ? (
          <StrategyCardList
            cards={classification.strategyCards}
            onInsertClause={handleAppendClause}
            splitSuggestions={classification.splitSuggestions}
            onApplySplit={() => void handleCreateSplitDrafts()}
          />
        ) : null}

        {patternHints.length > 0 ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintHeading}>Vault Form & Record Hints ({jurisdiction})</Text>
            {patternHints.map((hint) => (
              <Pressable
                key={hint.id}
                onPress={() => handleApplyHint(hint.title)}
                style={styles.hintChip}
              >
                <Text style={styles.hintChipTitle}>{hint.title}</Text>
                <Text style={styles.hintChipMeta}>{hint.kind.toUpperCase()} · Tap to add</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? 'Saving...' : 'Create Request & Open Handoff'}
          </Text>
        </Pressable>

        {createdItem ? (
          <View style={styles.savedBanner}>
            <Text style={styles.savedTitle}>
              Saved "{createdItem.title}" for {createdItem.agencyName} ({createdItem.id})
            </Text>
            <View style={styles.savedActions}>
              {onCreated ? (
                <Pressable
                  onPress={() => onCreated(createdItem.id)}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Open Request Handoff</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={handleClose} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Back to Tracker</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { minHeight: 40, justifyContent: 'center', paddingRight: 10 },
  backBtnText: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  title: { fontSize: 21, fontWeight: '800', color: '#111827' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  autoSuggestLink: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },
  input: {
    minHeight: 42,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
  },
  textArea: { minHeight: 96, paddingTop: 10, textAlignVertical: 'top' },
  agencyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  agencyHeading: { fontSize: 11, fontWeight: '700', color: '#475569' },
  agencyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  agencyChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  agencyChipName: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  agencyChipEmail: { fontSize: 11, color: '#475569' },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  hintBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hintHeading: { fontSize: 12, fontWeight: '700', color: '#374151' },
  hintChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  hintChipTitle: { fontSize: 12, fontWeight: '700', color: '#111827', flex: 1 },
  hintChipMeta: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  savedBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  savedTitle: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  savedActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
});
