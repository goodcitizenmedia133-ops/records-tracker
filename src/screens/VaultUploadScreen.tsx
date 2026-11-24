import { useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  computeSha256Hex,
  DEFAULT_VAULT_CONFIG,
  prepareAndStageVaultUpload,
  publishVaultArtifact,
  VaultPublishOutcome,
} from '../services/vaultPublisher';
import {resolveIndexFileForState, saveLocalStagedCatalogEntry} from '../services/vaultCatalog';
import { buildVaultWorkflowSteps } from '../services/wizardEngine';
import { VaultUploadMode } from '../utils/vaultPdfGuard';

interface VaultUploadScreenProps {
  onBack: () => void;
}

export function VaultUploadScreen({ onBack }: VaultUploadScreenProps) {
  const [uploadMode, setUploadMode] = useState<VaultUploadMode>('scrubbed_response');
  const [stateCode, setStateCode] = useState('CO');
  const [countyName, setCountyName] = useState('Huerfano County');
  const [cityName, setCityName] = useState('Walsenburg');
  const [fileName, setFileName] = useState('walsenburg-cora-response.pdf');
  const [releaseAssetUrl, setReleaseAssetUrl] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [hasPrefilledFormValues, setHasPrefilledFormValues] = useState(false);
  const [scrubPiiEnabled, setScrubPiiEnabled] = useState(true);
  const [userReviewedPages, setUserReviewedPages] = useState(false);
  const [outcome, setOutcome] = useState<VaultPublishOutcome | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [computedHash, setComputedHash] = useState('local-preview-sha256');
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSizeBytes = pdfBytes ? pdfBytes.byteLength : Math.max(1024, extractedText.length * 12);
  const targetIndexFile = resolveIndexFileForState(stateCode);
  const workflowSteps = buildVaultWorkflowSteps(
    effectiveSizeBytes,
    DEFAULT_VAULT_CONFIG.githubIndexRepo,
    DEFAULT_VAULT_CONFIG.githubIndexBranch
  );

  const copyIndexJson = async (jsonText: string) => {
    await Clipboard.setStringAsync(jsonText);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handlePickWebFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    const hex = await computeSha256Hex(buf);
    setFileName(file.name);
    setPdfBytes(buf);
    setComputedHash(hex);
  };

  const buildGuardPayload = () => ({
    fileName: fileName.trim() || 'document.pdf',
    fileSizeBytes: effectiveSizeBytes,
    extractedText,
    hasAcroFormFields: uploadMode === 'blank_form',
    hasPrefilledFormValues,
    uploadMode,
    target: {
      stateCode: stateCode.trim() || 'CO',
      countyName: countyName.trim() || 'Huerfano County',
      cityName: cityName.trim() || null,
    },
    sha256Hex: computedHash,
    userReviewedPages,
    scrubPiiEnabled,
  });

  const applyReleaseUrlIfProvided = (res: VaultPublishOutcome): VaultPublishOutcome => {
    const customUrl = releaseAssetUrl.trim();
    if (!customUrl || !res.published) return res;
    const updatedEntry = { ...res.guard.catalogEntry, publicUrl: customUrl };
    return {
      ...res,
      publicUrl: customUrl,
      catalogJsonSnippet: JSON.stringify(updatedEntry, null, 2),
      message: `${res.message} Using GitHub Release / asset URL: ${customUrl}`,
    };
  };

  const handleEvaluate = async () => {
    const res = await prepareAndStageVaultUpload(buildGuardPayload(), DEFAULT_VAULT_CONFIG);
    const finalRes = applyReleaseUrlIfProvided(res);
    setOutcome(finalRes);
    try {
      const parsed = JSON.parse(finalRes.catalogJsonSnippet);
      if (parsed && parsed.id && parsed.title) {
        saveLocalStagedCatalogEntry(parsed);
      }
    } catch {}
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await publishVaultArtifact(buildGuardPayload(), pdfBytes, DEFAULT_VAULT_CONFIG);
      const finalRes = applyReleaseUrlIfProvided(res);
      setOutcome(finalRes);
      try {
        const parsed = JSON.parse(finalRes.catalogJsonSnippet);
        if (parsed && parsed.id && parsed.title) {
          saveLocalStagedCatalogEntry(parsed);
        }
      } catch {}
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.badge}>GitHub Vault Wizard</Text>
      </View>

      <Text style={styles.title}>Vault Upload &amp; Review Gate</Text>
      <Text style={styles.helper}>
        Double-check every page before publishing to a public jurisdiction vault. Automated scrubbing is an aid, not a guarantee.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Guided Vault Steps</Text>
        {workflowSteps.map((step) => (
          <View key={step.stepNumber} style={[styles.stepBox, step.highlightWarning && styles.stepBoxWarn]}>
            <Text style={styles.stepTitle}>
              Step {step.stepNumber}: {step.title}
            </Text>
            <Text style={styles.helper}>{step.detail}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upload Mode</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setUploadMode('scrubbed_response')}
            style={[styles.modeBtn, uploadMode === 'scrubbed_response' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, uploadMode === 'scrubbed_response' && styles.modeTextActive]}>
              Redacted Copy
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setUploadMode('blank_form')}
            style={[styles.modeBtn, uploadMode === 'blank_form' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, uploadMode === 'blank_form' && styles.modeTextActive]}>
              Blank Agency Form
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Target Jurisdiction</Text>
        <TextInput
          value={stateCode}
          onChangeText={setStateCode}
          placeholder="State (e.g. CO)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={countyName}
          onChangeText={setCountyName}
          placeholder="County (e.g. Huerfano County)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={cityName}
          onChangeText={setCityName}
          placeholder="City / Municipality (optional)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PDF File, Release URL &amp; Extracted Text Preview</Text>
        <TextInput
          value={fileName}
          onChangeText={setFileName}
          placeholder="filename.pdf"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        {Platform.OS === 'web' ? (
          <View>
            <input
              ref={fileInputRef as any}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePickWebFile as any}
              style={{ display: 'none' }}
            />
            <Pressable onPress={() => (fileInputRef.current as any)?.click?.()} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                {pdfBytes
                  ? `Selected PDF (${(pdfBytes.byteLength / (1024 * 1024)).toFixed(2)} MB) - Change File`
                  : 'Select PDF File'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput
          value={releaseAssetUrl}
          onChangeText={setReleaseAssetUrl}
          placeholder="Optional GitHub Release asset URL (recommended for large PDFs)"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={extractedText}
          onChangeText={setExtractedText}
          placeholder="Paste extracted PDF text to check state/federal rules, personal info, or blank form status..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={[styles.input, styles.textArea]}
        />
        {uploadMode === 'blank_form' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Prefilled form values detected</Text>
            <Switch value={hasPrefilledFormValues} onValueChange={setHasPrefilledFormValues} />
          </View>
        ) : (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Hide Personal Info (SSN, phone, email, street address, IDs)</Text>
            <Switch value={scrubPiiEnabled} onValueChange={setScrubPiiEnabled} />
          </View>
        )}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Review Gate: I visually checked every page</Text>
          <Switch value={userReviewedPages} onValueChange={setUserReviewedPages} />
        </View>
        <View style={styles.row}>
          <Pressable onPress={() => void handleEvaluate()} style={[styles.primaryBtn, { flex: 1 }]}>
            <Text style={styles.primaryBtnText}>Stage Entry</Text>
          </Pressable>
          <Pressable
            disabled={publishing}
            onPress={() => void handlePublish()}
            style={[styles.copyBtn, { flex: 1, minHeight: 46 }]}
          >
            <Text style={styles.copyBtnText}>{publishing ? 'Publishing...' : 'Publish & Stage Index'}</Text>
          </Pressable>
        </View>
      </View>

      {outcome ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Guard Result: {outcome.guard.decision.toUpperCase()}</Text>
          <Text style={styles.helper}>{outcome.message}</Text>
          {outcome.guard.reasons.length > 0
            ? outcome.guard.reasons.map((reason, idx) => (
                <Text key={idx} style={styles.warnText}>
                  - {reason}
                </Text>
              ))
            : null}
          <Text style={styles.sectionTitle}>Redacted Text Preview</Text>
          <Text style={styles.codeBox}>{outcome.guard.scrubbedText || '(No extracted text)'}</Text>
          <Text style={styles.sectionTitle}>Catalog File: {targetIndexFile}</Text>
          <Text style={styles.helper}>
            Paste this JSON object inside the [ ... ] array in {targetIndexFile} on {DEFAULT_VAULT_CONFIG.githubIndexRepo}.
          </Text>
          <Text style={styles.sectionTitle}>Saved Record Details</Text>
          {outcome.publicUrl ? <Text style={styles.helper}>Index Asset URL: {outcome.publicUrl}</Text> : null}
          <Text style={styles.codeBox}>{outcome.catalogJsonSnippet}</Text>
          <Pressable onPress={() => void copyIndexJson(outcome.catalogJsonSnippet)} style={styles.copyBtn}>
            <Text style={styles.copyBtnText}>{copiedJson ? 'Copied Catalog Entry' : 'Copy Catalog Entry'}</Text>
          </Pressable>
        </View>
      ) : null}
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
  helper: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  stepBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  stepBoxWarn: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  stepTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  modeBtnActive: { backgroundColor: '#111827', borderColor: '#111827' },
  modeText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  modeTextActive: { color: '#FFFFFF' },
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
  textArea: { minHeight: 90, paddingTop: 10, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchLabel: { flex: 1, fontSize: 13, color: '#374151' },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtn: {
    minHeight: 42,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 6,
  },
  secondaryBtnText: { color: '#111827', fontSize: 13, fontWeight: '700' },
  warnText: { fontSize: 12, color: '#92400E', backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8 },
  codeBox: { fontSize: 12, color: '#111827', backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8 },
  copyBtn: {
    minHeight: 40,
    backgroundColor: '#111827',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  copyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
