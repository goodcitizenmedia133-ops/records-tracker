import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { StatusBadge } from '../components/StatusBadge';
import {
    addWorkingDays,
    getTodayCalendarDate,
    StatuteCode,
    STATUTES,
} from '../data/statutes';
import {
    addAuditEntry,
    getAllAgencies,
    getAllItems,
    getAuditEntries,
    getItemById,
    upsertItem,
} from '../services/database';
import {
    buildItemEmailHandoff,
    downloadEmailDraftEml,
    launchDefaultMailtoHandoff,
    EmailToneStyle,
    getAvailableEmailTones,
    getEmailDraftInsights,
    isRequestDeadlineMissed,
    launchGmailWebHandoffWithStatute,
    launchPortalHandoff,
    scheduleDeadlineReminder,
} from '../services/handoff';
import { exportAndSharePacketPdf } from '../services/packetBuilder';
import {
    AgencyRecord,
    AuditEntry,
    PublicRecordItem,
    RecordStatus,
} from '../types/models';
import {
    buildCorrespondenceAuditNote,
    formatSuggestedStatusLabel,
    ParsedEmailImport,
    parseRawEmailText,
} from '../utils/emailImportHelper';

interface RequestDetailScreenProps {
  itemId: string;
  onBack: () => void;
  onUpdated: () => void;
  onSelectSiblingItem?: (siblingId: string) => void;
}

const STATUS_ACTIONS: { label: string; status: RecordStatus }[] = [
  { label: 'Mark Sent', status: 'sent' },
  { label: 'Partial', status: 'partially_fulfilled' },
  { label: 'Fulfilled', status: 'fulfilled' },
  { label: 'Denied', status: 'denied' },
];

export function RequestDetailScreen({
  itemId,
  onBack,
  onUpdated,
  onSelectSiblingItem,
}: RequestDetailScreenProps) {
  const [item, setItem] = useState<PublicRecordItem | null>(null);
  const [siblingItems, setSiblingItems] = useState<PublicRecordItem[]>([]);
  const [agency, setAgency] = useState<AgencyRecord | null>(null);
  const [audits, setAudits] = useState<AuditEntry[]>([]);
  const [auditSortOrder, setAuditSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showArchivedAudits, setShowArchivedAudits] = useState(false);
  const [archivedAuditIds, setArchivedAuditIds] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`gcm_archived_audits_${itemId}`);
        return raw ? (JSON.parse(raw) as string[]) : [];
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [feeInput, setFeeInput] = useState('');
  const [noteCategory, setNoteCategory] = useState<'Call' | 'Email Reply' | 'Delivery' | 'Note'>('Call');
  const [noteDateInput, setNoteDateInput] = useState('');
  const [senderAccounts, setSenderAccounts] = useState<{ label: string; email: string }[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('gcm_sender_accounts_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch {
      // ignore storage read errors
    }
    return [];
  });
  const [selectedSenderEmail, setSelectedSenderEmail] = useState('');
  const [newSenderLabel, setNewSenderLabel] = useState('');
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [rawEmailInput, setRawEmailInput] = useState('');
  const [scrubEmailPii, setScrubEmailPii] = useState(true);
  const [parsedEmail, setParsedEmail] = useState<ParsedEmailImport | null>(null);
  const [signOffInput, setSignOffInput] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('gcm_requester_signoff') || ''
        : '';
    } catch {
      return '';
    }
  });
  const [emailTone, setEmailTone] = useState<EmailToneStyle>('clear_professional');
  const [userPickedTone, setUserPickedTone] = useState(false);
  const [preferredFormatInput, setPreferredFormatInput] = useState(() => {
    try {
      const saved =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('gcm_preferred_format')
          : null;
      return (
        saved ||
        'Electronic delivery in searchable PDF/digital format via reply email is preferred if available.'
      );
    } catch {
      return 'Electronic delivery in searchable PDF/digital format via reply email is preferred if available.';
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gcm_requester_signoff', signOffInput);
      }
    } catch {}
  }, [signOffInput]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gcm_preferred_format', preferredFormatInput);
      }
    } catch {}
  }, [preferredFormatInput]);
  const [scrubPiiOnExport, setScrubPiiOnExport] = useState(true);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    const found = await getItemById(itemId);
    setItem(found);
    if (found) {
      setFeeInput(found.feeQuoted !== null ? String(found.feeQuoted) : '');
      const agencies = await getAllAgencies();
      setAgency(agencies.find((a) => a.id === found.agencyId) ?? null);
      const log = await getAuditEntries(found.id);
      setAudits(log);
      if (found.batchLabel || found.parentItemId) {
        const all = await getAllItems();
        const siblings = all.filter(
          (other) =>
            other.id !== found.id &&
            ((found.batchLabel && other.batchLabel === found.batchLabel) ||
              (found.parentItemId && other.parentItemId === found.parentItemId))
        );
        setSiblingItems(siblings);
      } else {
        setSiblingItems([]);
      }
    }
  }, [itemId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const deadlineMissed = isRequestDeadlineMissed(item);
  useEffect(() => {
    if (!item || userPickedTone) return;
    if (deadlineMissed && emailTone !== 'deadline_follow_up') {
      setEmailTone('deadline_follow_up');
    } else if (!deadlineMissed && emailTone === 'deadline_follow_up') {
      setEmailTone('sweet_courteous');
    }
  }, [item, deadlineMissed, emailTone, userPickedTone]);

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Request not found.</Text>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back to Dashboard</Text>
        </Pressable>
      </View>
    );
  }

  const statuteCode = (
    item.statuteCode === 'CORA' ||
    item.statuteCode === 'CCJRA' ||
    item.statuteCode === 'FOIA'
      ? item.statuteCode
      : 'CORA'
  ) as StatuteCode;
  const statute = STATUTES[statuteCode];

  const recordChange = async (
    updated: PublicRecordItem,
    action: string,
    detail: string
  ) => {
    await upsertItem(updated);
    await addAuditEntry({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemId: updated.id,
      action,
      detail,
      createdAt: new Date().toISOString(),
    });
    setItem(updated);
    const log = await getAuditEntries(updated.id);
    setAudits(log);
    onUpdated();
  };

  const handleStatusChange = async (nextStatus: RecordStatus) => {
    const nowIso = new Date().toISOString();
    const today = getTodayCalendarDate();
    const nextDue =
      nextStatus === 'sent' && !item.dueDate
        ? addWorkingDays(today, statute.defaultWorkingDays)
        : item.dueDate;

    const updated: PublicRecordItem = {
      ...item,
      status: nextStatus,
      sentAt: nextStatus === 'sent' && !item.sentAt ? nowIso : item.sentAt,
      dueDate: nextDue,
    };
    await recordChange(
      updated,
      `STATUS_${nextStatus.toUpperCase()}`,
      `Status updated to ${nextStatus.toUpperCase()}${
        nextDue ? ` (due ${nextDue})` : ''
      }.`
    );
    setFeedbackBanner(`Status updated to ${nextStatus.toUpperCase()}.`);
  };

  const handleApplyExtension = async () => {
    const baseDate = item.dueDate || getTodayCalendarDate();
    const extendedDue = addWorkingDays(
      baseDate,
      statute.maxExtensionWorkingDays
    );
    const updated: PublicRecordItem = {
      ...item,
      status: 'extended',
      dueDate: extendedDue,
    };
    await recordChange(
      updated,
      'STATUTORY_EXTENSION',
      `Applied +${statute.maxExtensionWorkingDays} working days extension under ${statute.citation}. New due date: ${extendedDue}.`
    );
    setFeedbackBanner(`Extended +${statute.maxExtensionWorkingDays} working days to ${extendedDue}.`);
  };

  const handleSaveFee = async () => {
    const trimmed = feeInput.trim();
    if (!trimmed) {
      const updated: PublicRecordItem = {
        ...item,
        feeQuoted: null,
        status: item.status === 'fee_paused' ? 'sent' : item.status,
      };
      await recordChange(updated, 'FEE_CLEARED', 'Cleared quoted fee.');
      setFeedbackBanner('Fee quote cleared.');
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0) {
      Alert.alert('Invalid Fee', 'Enter a valid dollar amount (e.g. 25.00).');
      return;
    }

    const updated: PublicRecordItem = {
      ...item,
      feeQuoted: parsed,
      status: parsed > 0 ? 'fee_paused' : item.status,
    };
    await recordChange(
      updated,
      'FEE_QUOTED',
      `Recorded fee quote of $${parsed.toFixed(2)}${
        parsed > 0 ? ' (clock paused pending fee response)' : ''
      }.`
    );
    setFeedbackBanner(`Saved fee quote: $${parsed.toFixed(2)}.`);
  };

  const handleParseEmailText = () => {
    const cleanRaw = rawEmailInput.trim();
    if (!cleanRaw) {
      setFeedbackBanner('Paste email text or choose a .eml / .txt file first.');
      return;
    }
    const parsed = parseRawEmailText(cleanRaw, { scrubPii: scrubEmailPii });
    setParsedEmail(parsed);
    setFeedbackBanner('Parsed email fields and scrubbed PII preview.');
  };

  const handleApplyEmailToInputs = async (saveImmediately: boolean) => {
    const sourceText = rawEmailInput.trim();
    if (!sourceText && !parsedEmail) {
      setFeedbackBanner('Paste email text first.');
      return;
    }
    const parsed = parsedEmail || parseRawEmailText(sourceText, { scrubPii: scrubEmailPii });
    setParsedEmail(parsed);

    const formattedNote = buildCorrespondenceAuditNote(parsed);
    setNoteInput(formattedNote);

    if (parsed.detectedFeeDollars) {
      setFeeInput(parsed.detectedFeeDollars);
    }

    if (saveImmediately) {
      if (!item) return;
      await addAuditEntry({
        id: `aud-${Date.now()}-email`,
        itemId: item.id,
        action: 'LOG_NOTE',
        detail: formattedNote,
        createdAt: new Date().toISOString(),
      });
      setNoteInput('');
      const log = await getAuditEntries(item.id);
      setAudits(log);
      setFeedbackBanner('Imported email correspondence into the audit log.');
    } else {
      setFeedbackBanner('Populated Note and Fee fields from email. Review and save.');
    }
  };

  const handlePickEmailFile = (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setRawEmailInput(content);
      const parsed = parseRawEmailText(content, { scrubPii: scrubEmailPii });
      setParsedEmail(parsed);
      setFeedbackBanner(`Loaded ${file.name} into Email Import Helper.`);
    };
    reader.readAsText(file);
  };

  const handleAddAuditNote = async () => {
    const clean = noteInput.trim();
    if (!clean) return;
    const datePrefix = noteDateInput.trim() ? `[${noteDateInput.trim()}] ` : '';
    const formattedDetail = `${noteCategory}: ${datePrefix}${clean}`;
    await addAuditEntry({
      id: `aud-${Date.now()}`,
      itemId: item.id,
      action: noteCategory === 'Note' ? 'LOG_NOTE' : `LOG_${noteCategory.toUpperCase().replace(/\s+/g, '_')}`,
      detail: formattedDetail,
      createdAt: new Date().toISOString(),
    });
    setNoteInput('');
    setNoteDateInput('');
    const log = await getAuditEntries(item.id);
    setAudits(log);
    setFeedbackBanner(`Logged ${noteCategory.toLowerCase()} to chronological audit log.`);
  };

  const availableTones = getAvailableEmailTones(item);
  const draftInsights = getEmailDraftInsights(item, {
    requesterSignOff: signOffInput,
    preferredFormat: preferredFormatInput,
    toneStyle: emailTone,
  });

  const effectiveSignOff = useMemo(() => {
    const base = signOffInput.trim();
    if (!selectedSenderEmail) return base;
    if (base.toLowerCase().includes(selectedSenderEmail.toLowerCase())) return base;
    return base ? `${base} (${selectedSenderEmail})` : selectedSenderEmail;
  }, [signOffInput, selectedSenderEmail]);

  const emailBundle = buildItemEmailHandoff(item, agency, {
    requesterSignOff: effectiveSignOff,
    preferredFormat: preferredFormatInput,
    toneStyle: emailTone,
  });

  const handleCopyText = async () => {
    await Clipboard.setStringAsync(emailBundle.clipboardText);
    setFeedbackBanner('Formatted request email & metadata copied to clipboard.');
  };

  const handleDownloadEml = async () => {
    const res = await downloadEmailDraftEml(item, agency, {
      requesterSignOff: effectiveSignOff,
      preferredFormat: preferredFormatInput,
      toneStyle: emailTone,
    });
    setFeedbackBanner(res.message);
  };

  const handleOpenDefaultMail = async () => {
    const res = await launchDefaultMailtoHandoff(item, agency, {
      requesterSignOff: effectiveSignOff,
      preferredFormat: preferredFormatInput,
      toneStyle: emailTone,
    });
    setFeedbackBanner(res.message);
  };

  const handleAddSenderAccount = () => {
    const cleanEmail = newSenderEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedbackBanner('Enter a valid sender email (e.g. name@comcast.net or name@gmail.com).');
      return;
    }
    const cleanLabel = newSenderLabel.trim() || cleanEmail.split('@')[1] || 'Account';
    const next = [
      ...senderAccounts.filter((a) => a.email.toLowerCase() !== cleanEmail.toLowerCase()),
      { label: cleanLabel, email: cleanEmail },
    ];
    setSenderAccounts(next);
    setSelectedSenderEmail(cleanEmail);
    setNewSenderLabel('');
    setNewSenderEmail('');
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gcm_sender_accounts_v1', JSON.stringify(next));
      }
    } catch {
      // ignore storage errors
    }
    setFeedbackBanner(`Saved sender account: ${cleanEmail}`);
  };

  const handleEmail = async () => {
    const res = await launchGmailWebHandoffWithStatute(item, agency, {
      requesterSignOff: signOffInput,
      preferredFormat: preferredFormatInput,
      toneStyle: emailTone,
    });
    setFeedbackBanner(res.message);
  };

  const handlePortal = async () => {
    const res = await launchPortalHandoff(agency);
    setFeedbackBanner(res.message);
  };

  const livePortalUrl = (agency?.portalUrl || '').trim();
  const hasValidPortal =
    /^https?:\/\//i.test(livePortalUrl) && !/\.example\.(gov|com|org)(\/|$)/i.test(livePortalUrl);

  const handleCopyHeaderMeta = async () => {
    const line = [
      emailBundle.to ? `To: ${emailBundle.to}` : null,
      emailBundle.subject ? `Subject: ${emailBundle.subject}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    await Clipboard.setStringAsync(line || emailBundle.subject);
    setFeedbackBanner('Recipient & subject copied to clipboard.');
  };

  const handleReminder = async () => {
    const res = await scheduleDeadlineReminder(item);
    if (res.ok && item.dueDate) {
      await addAuditEntry({
        id: `aud-${Date.now()}-rem`,
        itemId: item.id,
        action: 'REMINDER_9AM',
        detail: `Set 9:00 AM reminder for statutory due date ${item.dueDate}.`,
        createdAt: new Date().toISOString(),
      });
      const log = await getAuditEntries(item.id);
      setAudits(log);
    }
    setFeedbackBanner(res.message);
  };

  const handleExportPdf = async () => {
    const res = await exportAndSharePacketPdf(item, audits, agency, {
      scrubPersonalInfo: scrubPiiOnExport,
    });
    setFeedbackBanner(res.message);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Text style={styles.statuteBadge}>
          {statute.code} · {statute.citation}
        </Text>
      </View>

      {feedbackBanner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{feedbackBanner}</Text>
        </View>
      ) : null}

      <Text style={styles.agency}>{item.agencyName}</Text>
      <Text style={styles.title}>{item.title}</Text>

      <View style={styles.statusRow}>
        <StatusBadge status={item.status} dueDate={item.dueDate} />
        {item.dueDate ? (
          <Text style={styles.dueText}>Target: {item.dueDate}</Text>
        ) : null}
      </View>

      {item.batchLabel ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Split Request Batch: {item.batchLabel}</Text>
          <Text style={styles.mutedText}>
            Tracked as an independent request so each email thread, clock, and reply stays separate.
          </Text>
          {siblingItems.map((sib) => (
            <Pressable
              key={sib.id}
              onPress={() => {
                if (onSelectSiblingItem) {
                  onSelectSiblingItem(sib.id);
                } else {
                  setFeedbackBanner(`Related split draft: "${sib.title}" (${sib.status.toUpperCase()}). Open it from Dashboard.`);
                }
              }}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>
                Sibling: {sib.title} ({sib.status.toUpperCase()})
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Request Scope</Text>
        <Text style={styles.bodyText}>
          {item.summary || 'No scope description provided.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Send &amp; Handoff Actions</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={handleEmail} style={[styles.actionBtn, styles.primaryActionBtn]}>
            <Text style={styles.primaryActionBtnText}>Open Gmail Web</Text>
          </Pressable>
          <Pressable onPress={handleCopyText} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Copy Email Packet</Text>
          </Pressable>
          {hasValidPortal ? (
            <Pressable onPress={handlePortal} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Open Portal</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleCopyHeaderMeta} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Copy To &amp; Subject</Text>
            </Pressable>
          )}
          <Pressable onPress={handleOpenDefaultMail} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Open Default Mail</Text>
          </Pressable>
          <Pressable onPress={handleDownloadEml} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Download Draft (.eml)</Text>
          </Pressable>
          <Pressable onPress={handleReminder} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Set 9 AM Alert</Text>
          </Pressable>
        </View>

        <Text style={styles.subLabel}>Email Tone & Style (4 Active Modes)</Text>
        <View style={styles.actionGrid}>
          {availableTones.map((toneOption) => {
            const selected = emailTone === toneOption.id;
            return (
              <Pressable
                key={toneOption.id}
                onPress={() => {
                  setUserPickedTone(true);
                  setEmailTone(toneOption.id);
                  setFeedbackBanner(`Tone set to ${toneOption.label}.`);
                }}
                style={[styles.actionBtn, selected && styles.activeChipBtn]}
              >
                <Text style={[styles.actionBtnText, selected && styles.activeChipText]}>
                  {toneOption.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.metaText}>
          {(availableTones.find((t) => t.id === emailTone) || availableTones[0]).outcomeSummary}
        </Text>
        <Text style={styles.metaText}>
          Detected: {draftInsights.detectedPatterns.map((p) => p.label).join(' · ')}
          {draftInsights.referencedCitations.length > 0
            ? ` | ${statuteCode} Sections: ${draftInsights.referencedCitations.join(', ')}`
            : ''}
        </Text>

        <Text style={styles.subLabel}>Sending From Account (Multi-Provider / Multi-Email)</Text>
        <View style={styles.statusGrid}>
          {senderAccounts.map((acc) => {
            const active = selectedSenderEmail.toLowerCase() === acc.email.toLowerCase();
            return (
              <Pressable
                key={acc.email}
                onPress={() => {
                  const nextVal = active ? '' : acc.email;
                  setSelectedSenderEmail(nextVal);
                  setFeedbackBanner(nextVal ? `Active sender: ${nextVal}` : 'Cleared active sender account.');
                }}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                  {acc.label}: {acc.email}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.inlineRow}>
          <TextInput
            value={newSenderLabel}
            onChangeText={setNewSenderLabel}
            placeholder="Label (e.g. Comcast)"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { width: 135 }]}
          />
          <TextInput
            value={newSenderEmail}
            onChangeText={setNewSenderEmail}
            placeholder="you@comcast.net"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={handleAddSenderAccount} style={styles.inlineSaveBtn}>
            <Text style={styles.inlineSaveText}>Save</Text>
          </Pressable>
        </View>

        <Text style={styles.subLabel}>Requester Sign-Off (optional)</Text>
        <TextInput
          value={signOffInput}
          onChangeText={setSignOffInput}
          placeholder="Your name or contact line for the signature block"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <Text style={styles.subLabel}>Delivery Format Note</Text>
        <TextInput
          value={preferredFormatInput}
          onChangeText={setPreferredFormatInput}
          placeholder="Preferred delivery format..."
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />

        <View style={styles.previewBox}>
          <Text style={styles.previewMeta}>
            To: {emailBundle.to || '(enter custodian email on agency/request)'}
          </Text>
          <Text style={styles.previewMeta}>Subject: {emailBundle.subject}</Text>
          <Text style={styles.previewBody}>{emailBundle.body}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status &amp; Statutory Clock</Text>
        <View style={styles.statusGrid}>
          {STATUS_ACTIONS.map((act) => {
            const active = item.status === act.status;
            return (
              <Pressable
                key={act.status}
                onPress={() => handleStatusChange(act.status)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text
                  style={[
                    styles.chipBtnText,
                    active && styles.chipBtnTextActive,
                  ]}
                >
                  {act.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={handleApplyExtension} style={styles.warnBtn}>
          <Text style={styles.warnBtnText}>
            Log Statutory Extension (+{statute.maxExtensionWorkingDays} Working
            Days)
          </Text>
        </Pressable>

        <Text style={styles.subLabel}>Fee Estimate / Quote ($)</Text>
        <View style={styles.inlineRow}>
          <TextInput
            value={feeInput}
            onChangeText={setFeeInput}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={handleSaveFee} style={styles.inlineSaveBtn}>
            <Text style={styles.inlineSaveText}>Save Fee</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Compliance &amp; Audit Packet</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            Scrub PII (SSN, phone, email, address) on export
          </Text>
          <Switch
            value={scrubPiiOnExport}
            onValueChange={setScrubPiiOnExport}
          />
        </View>
        <Pressable onPress={handleExportPdf} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            Export &amp; Share PDF Packet
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chronological Audit Trail</Text>
        <View style={styles.emailHelperBox}>
          <Text style={styles.subLabel}>Import Email Reply / Correspondence</Text>
          {typeof document !== 'undefined' ? (
            <input
              type="file"
              accept=".eml,.txt,text/plain,message/rfc822"
              onChange={handlePickEmailFile}
              style={{ marginBottom: 8, fontSize: 12 }}
            />
          ) : null}
          <TextInput
            value={rawEmailInput}
            onChangeText={setRawEmailInput}
            placeholder="Paste From / Subject / Date / email body here..."
            placeholderTextColor="#9CA3AF"
            multiline
            style={[styles.input, { minHeight: 84, textAlignVertical: 'top' }]}
          />
          <View style={styles.actionGrid}>
            <Pressable onPress={handleParseEmailText} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Preview &amp; Scrub</Text>
            </Pressable>
            <Pressable
              onPress={() => setScrubEmailPii((prev) => !prev)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>
                PII Scrub: {scrubEmailPii ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleApplyEmailToInputs(false)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>Fill Note &amp; Fee</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleApplyEmailToInputs(true)}
              style={[styles.actionBtn, styles.primaryActionBtn]}
            >
              <Text style={styles.primaryActionBtnText}>Save Audit Note</Text>
            </Pressable>
          </View>

          {parsedEmail ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewMeta}>From: {parsedEmail.sender}</Text>
              <Text style={styles.previewMeta}>Subject: {parsedEmail.subject}</Text>
              <Text style={styles.previewMeta}>
                Date: {parsedEmail.dateLabel}
                {parsedEmail.detectedFeeDollars
                  ? ` · Fee Found: ${parsedEmail.detectedFeeDollars}`
                  : ''}
              </Text>
              {parsedEmail.suggestedStatus ? (
                <Text style={styles.previewMeta}>
                  Plain Clue: {formatSuggestedStatusLabel(parsedEmail.suggestedStatus)} ({parsedEmail.suggestedStatus})
                </Text>
              ) : null}
              <Text style={styles.previewBody}>{parsedEmail.bodyText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statusGrid}>
          {(['Call', 'Email Reply', 'Delivery', 'Note'] as const).map((cat) => {
            const active = noteCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setNoteCategory(cat)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.inlineRow}>
          <TextInput
            value={noteDateInput}
            onChangeText={setNoteDateInput}
            placeholder="Date (e.g. 2026-11-23)"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { width: 145 }]}
          />
          <TextInput
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="e.g. Called clerk; they said records are under review..."
            placeholderTextColor="#9CA3AF"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable onPress={handleAddAuditNote} style={styles.inlineSaveBtn}>
            <Text style={styles.inlineSaveText}>Add</Text>
          </Pressable>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            onPress={() =>
              setAuditSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
            }
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>
              Sort: {auditSortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowArchivedAudits((prev) => !prev)}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>
              {showArchivedAudits ? 'Hide Archived' : `Show Archived (${archivedAuditIds.length})`}
            </Text>
          </Pressable>
        </View>

        {(() => {
          const filtered = audits.filter((entry) =>
            showArchivedAudits ? true : !archivedAuditIds.includes(entry.id)
          );
          const sorted = [...filtered].sort((a, b) => {
            const diff =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return auditSortOrder === 'newest' ? -diff : diff;
          });

          if (sorted.length === 0) {
            return (
              <Text style={styles.mutedText}>
                {audits.length === 0
                  ? 'No audit entries recorded yet.'
                  : 'No active audit entries shown. Toggle Show Archived to view archived items.'}
              </Text>
            );
          }

          return sorted.map((entry) => {
            const isArchived = archivedAuditIds.includes(entry.id);
            return (
              <View
                key={entry.id}
                style={[styles.auditRow, isArchived && styles.auditRowArchived]}
              >
                <View style={styles.auditHeaderRow}>
                  <Text style={styles.auditMeta}>
                    {entry.action} · {entry.createdAt.slice(0, 16).replace('T', ' ')}
                    {isArchived ? ' · ARCHIVED' : ''}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const nextIds = isArchived
                        ? archivedAuditIds.filter((id) => id !== entry.id)
                        : [...archivedAuditIds, entry.id];
                      setArchivedAuditIds(nextIds);
                      try {
                        if (typeof window !== 'undefined' && window.localStorage) {
                          window.localStorage.setItem(
                            `gcm_archived_audits_${itemId}`,
                            JSON.stringify(nextIds)
                          );
                        }
                      } catch {
                        // ignore storage errors
                      }
                    }}
                    style={styles.archivePillBtn}
                  >
                    <Text style={styles.archivePillText}>
                      {isArchived ? 'Unarchive' : 'Archive'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.auditDetail}>{entry.detail}</Text>
              </View>
            );
          });
        })()}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  activeChipBtn: {
    backgroundColor: '#0C4A6E',
    borderColor: '#38BDF8',
  },
  activeChipText: {
    color: '#E0F2FE',
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  auditRowArchived: {
    opacity: 0.55,
  },
  auditHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  archivePillBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.4,
  },
  container: {
    flex: 1,
    backgroundColor: '#070B12',
  },
  content: {
    padding: 16,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#070B12',
  },
  emptyText: {
    fontSize: 16,
    color: '#CBD5E1',
    marginBottom: 14,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  statuteBadge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#7DD3FC',
    backgroundColor: '#0C2D48',
    borderWidth: 1,
    borderColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  banner: {
    backgroundColor: '#052E2B',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A7F3D0',
  },
  agency: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#38BDF8',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  dueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: '#F1F5F9',
  },
  bodyText: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 21,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    width: '48%',
    minHeight: 44,
    backgroundColor: '#162033',
    borderWidth: 1,
    borderColor: '#293548',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  primaryActionBtn: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewBox: {
    backgroundColor: '#090E17',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  previewMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93C5FD',
    fontVariant: ['tabular-nums'],
  },
  previewBody: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
  },
  emailHelperBox: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#293548',
    backgroundColor: '#162033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  chipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
  },
  warnBtn: {
    minHeight: 44,
    backgroundColor: '#2A1D05',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  warnBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FCD34D',
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#94A3B8',
    marginTop: 4,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    minHeight: 44,
    backgroundColor: '#090E17',
    borderWidth: 1,
    borderColor: '#293548',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#F8FAFC',
  },
  inlineSaveBtn: {
    minHeight: 44,
    backgroundColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
  },
  primaryBtn: {
    minHeight: 46,
    backgroundColor: '#0284C7',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mutedText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  auditRow: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
    gap: 4,
  },
  auditMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    fontVariant: ['tabular-nums'],
  },
  auditDetail: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 19,
  },
});
