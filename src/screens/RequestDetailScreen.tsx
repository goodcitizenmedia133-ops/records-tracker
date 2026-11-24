import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import {
  useCallback,
  useEffect,
  useState,
  useMemo} from 'react';
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
  computeEffectiveFilingDate,
  getAgencyLocalDateInfo,
  resolveAgencyTimeZone,
} from '../data/statutes';
import {
    addAuditEntry,
  deleteAuditEntry,
    getAllAgencies,
    getAllItems,
    getAuditEntries,
    deleteItem,
  getItemById,
    upsertItem,
} from '../services/database';
import {
    buildItemEmailHandoff,
    downloadEmailDraftEml,
    getProviderWebmailInfo,
    launchDefaultMailtoHandoff,
    ProviderComposeId,
  detectProviderComposeId,
  launchProviderWebmailHandoff,
  sendDirectSmtpEmail,
    EmailToneStyle,
    getAvailableEmailTones,
    getEmailDraftInsights,
    isRequestDeadlineMissed,
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
  const [auditFilter, setAuditFilter] = useState<'all' | 'sent' | 'pdf' | 'notes'>('all');
  const [confirmDeleteAuditId, setConfirmDeleteAuditId] = useState<string | null>(null);
  const [confirmDeleteRequest, setConfirmDeleteRequest] = useState(false);
  const [handoffAwaitingSend, setHandoffAwaitingSend] = useState(false);
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
  const [pendingSwitchSender, setPendingSwitchSender] = useState<string | null>(null);
  const [pendingSendConfirmation, setPendingSendConfirmation] = useState(false);
  const [showSenderPickerBeforeLaunch, setShowSenderPickerBeforeLaunch] = useState(false);
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerDirty, setComposerDirty] = useState(false);
  const [smtpHostInput, setSmtpHostInput] = useState('');
  const [smtpPortInput, setSmtpPortInput] = useState('587');
  const [smtpPassInput, setSmtpPassInput] = useState('');
  const [smtpCredentialsByEmail, setSmtpCredentialsByEmail] = useState<Record<string, { host?: string; port?: number; pass?: string }>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('gcm_sender_smtp_v1');
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore storage read errors
    }
    return {};
  });
  const [isSendingDirect, setIsSendingDirect] = useState(false);
  const [selectedProviderByEmail, setSelectedProviderByEmail] = useState<Record<string, ProviderComposeId>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('gcm_sender_provider_v1');
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore storage read errors
    }
    return {};
  });
  const [copiedPacketFeedback, setCopiedPacketFeedback] = useState(false);
  const [copiedHeaderFeedback, setCopiedHeaderFeedback] = useState(false);
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
      if (found.senderEmail) {
        setSelectedSenderEmail(found.senderEmail);
      }
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

  const effectiveSignOff = useMemo(() => {
    const base = signOffInput.trim();
    if (!selectedSenderEmail) return base;
    if (base.toLowerCase().includes(selectedSenderEmail.toLowerCase())) return base;
    return base ? `${base} (${selectedSenderEmail})` : selectedSenderEmail;
  }, [signOffInput, selectedSenderEmail]);

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
    item.statuteCode === 'MIFOIA' ||
    item.statuteCode === 'FOIA'
      ? item.statuteCode
      : (agency as any)?.stateCode === 'MI'
        ? 'MIFOIA'
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

  const agencyLocationHint = {
    jurisdiction: agency?.jurisdiction || null,
    agencyName: agency?.name || item.agencyName,
    stateCode: (agency as any)?.stateCode || null,
    statuteCode,
  };
  const agencyTimeZone = resolveAgencyTimeZone(agencyLocationHint);
  const agencyClockNow = getAgencyLocalDateInfo(new Date(), agencyTimeZone);

  const handleStatusChange = async (nextStatus: RecordStatus) => {
    const nowIso = new Date().toISOString();
    const filingClock = computeEffectiveFilingDate(nowIso, agencyLocationHint);
    const nextDue =
      nextStatus === 'sent' && !item.dueDate
        ? addWorkingDays(getTodayCalendarDate(agencyTimeZone), statute.defaultWorkingDays)
        : item.dueDate;

    const updated: PublicRecordItem = {
      ...item,
      status: nextStatus,
      sentAt: nextStatus === 'sent' && !item.sentAt ? nowIso : item.sentAt,
      dueDate: nextDue,
    };
    const activeSender = (selectedSenderEmail || item.senderEmail || '').trim();
    const boundSender = (item.senderEmail || '').trim();
    if (nextStatus === 'sent' && !activeSender) {
      setFeedbackBanner('Select or add a sender account (such as Comcast or Gmail) before marking this request SENT.');
      return;
    }
    if (
      nextStatus === 'sent' &&
      boundSender &&
      activeSender.toLowerCase() !== boundSender.toLowerCase() &&
      !pendingSendConfirmation
    ) {
      setPendingSendConfirmation(true);
      setFeedbackBanner(
        `This request is set to send from ${boundSender}, but ${activeSender} is selected. Tap Mark Sent again to confirm sending from ${activeSender}.`
      );
      return;
    }
    setPendingSendConfirmation(false);
    if (nextStatus === 'sent') setHandoffAwaitingSend(false);
    const senderTag = activeSender ? ` via ${activeSender}` : '';
    const clockNote =
      nextStatus === 'sent'
        ? ` [${getTodayCalendarDate(agencyTimeZone)} ${agencyTimeZone}]`
        : ` [${filingClock.observedDateYmd} ${filingClock.zoneAbbr}]`;
    const updatedWithSender: PublicRecordItem = {
      ...updated,
      senderEmail: activeSender || updated.senderEmail || null,
      senderLabel: activeSender ? (senderAccounts.find((a) => a.email.toLowerCase() === activeSender.toLowerCase())?.label || updated.senderLabel || null) : (updated.senderLabel || null),
    };
    await recordChange(
      updatedWithSender,
      `STATUS_${nextStatus.toUpperCase()}`,
      `Status updated to ${nextStatus.toUpperCase()}${senderTag}${
        nextDue ? ` (due ${nextDue})` : ''
      }.${clockNote}`
    );
    setFeedbackBanner(
      nextStatus === 'sent' && filingClock.rolledNextBusinessDay
        ? `Marked SENT · Receipt rolled to ${getTodayCalendarDate(agencyTimeZone)} (${filingClock.zoneAbbr} cutoff/weekend/holiday) · Due ${nextDue}.`
        : `Status updated to ${nextStatus.toUpperCase()} (${filingClock.zoneAbbr}).`
    );
  };


  const handleApplyExtension = async () => {
    const baseDate = item.dueDate || getTodayCalendarDate(agencyTimeZone);
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
    setFeedbackBanner('Read email fields and hid personal info in preview.');
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
      setRawEmailInput('');
      setParsedEmail(null);
      const log = await getAuditEntries(item.id);
      setAudits(log);
      setFeedbackBanner('Saved reply to the activity log.');
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

  const emailBundle = buildItemEmailHandoff(item, agency, {
    requesterSignOff: effectiveSignOff,
    preferredFormat: preferredFormatInput,
    toneStyle: emailTone,
  });

  const copyTextReliably = async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to textarea fallback
    }
    if (typeof document !== 'undefined') {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) return true;
      } catch {
        // fall through to expo-clipboard
      }
    }
    try {
      await Clipboard.setStringAsync(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleCopyText = async () => {
    const ok = await copyTextReliably(emailBundle.clipboardText);
    if (ok) {
      setCopiedPacketFeedback(true);
      setTimeout(() => setCopiedPacketFeedback(false), 2500);
      setFeedbackBanner('Copied full email (To, Subject & Body) to clipboard.');
    } else {
      setFeedbackBanner('Clipboard blocked by browser—select and copy from the preview box below.');
    }
  };

  const handleDownloadEml = async () => {
    const res = await downloadEmailDraftEml(item, agency, {
      requesterSignOff: effectiveSignOff,
      preferredFormat: preferredFormatInput,
      toneStyle: emailTone,
    });
    if (res.ok) {
      setHandoffAwaitingSend(true);
    }
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
    const parsedPort = Number(smtpPortInput) || 587;
    const nextCreds = {
      ...smtpCredentialsByEmail,
      [cleanEmail.toLowerCase()]: {
        host: smtpHostInput.trim() || undefined,
        port: parsedPort,
        pass: smtpPassInput || smtpCredentialsByEmail[cleanEmail.toLowerCase()]?.pass || undefined,
      },
    };
    const detectedProvider = detectProviderComposeId(cleanEmail);
    const nextProviders: Record<string, ProviderComposeId> = {
      ...selectedProviderByEmail,
      [cleanEmail.toLowerCase()]: detectedProvider,
    };
    setSmtpCredentialsByEmail(nextCreds);
    setSelectedProviderByEmail(nextProviders);
    void persistRequestSender(cleanEmail, cleanLabel);
    setNewSenderLabel('');
    setNewSenderEmail('');
    setSmtpPassInput('');
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gcm_sender_accounts_v1', JSON.stringify(next));
        window.localStorage.setItem('gcm_sender_smtp_v1', JSON.stringify(nextCreds));
        window.localStorage.setItem('gcm_sender_provider_v1', JSON.stringify(nextProviders));
      }
    } catch {
      // ignore storage errors
    }
    setFeedbackBanner(`Sending account set to: ${cleanLabel} (${cleanEmail})`);
  };

    const handleEmail = async () => {
    const activeSender = (selectedSenderEmail || item?.senderEmail || '').trim();
    if (!activeSender) {
      setShowSenderPickerBeforeLaunch(true);
      setFeedbackBanner('Select which email account (such as Comcast or Gmail) you want to send from before launching.');
      return;
    }
    setShowSenderPickerBeforeLaunch(false);
    const res = await launchProviderWebmailHandoff(item!, agency, {
      requesterSignOff: effectiveSignOff,
      preferredFormat: preferredFormatInput,
      toneStyle: emailTone,
      senderEmail: activeSender,
      providerId: selectedProviderByEmail[activeSender.toLowerCase()] || detectProviderComposeId(activeSender),
    });
    setFeedbackBanner(res.message);
  };

  const handleCopySingleField = async (label: 'To' | 'Subject' | 'Body', value: string) => {
    const clean = (value || '').trim();
    if (!clean) {
      setFeedbackBanner(`No ${label} text available to copy yet.`);
      return;
    }
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(clean);
        copied = true;
      }
    } catch {
      // fallback below
    }
    if (!copied && typeof document !== 'undefined' && document.body) {
      try {
        const ta = document.createElement('textarea');
        ta.value = clean;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    setFeedbackBanner(
      copied
        ? `Copied ${label} to clipboard. Paste directly into the ${label} box.`
        : `Could not copy ${label} automatically. Select and copy it manually.`
    );
  };

  const persistRequestSender = async (emailVal: string, labelVal?: string) => {
    setSelectedSenderEmail(emailVal);
    setPendingSwitchSender(null);
    if (!item) return;
    const updated: PublicRecordItem = {
      ...item,
      senderEmail: emailVal || null,
      senderLabel: labelVal || null,
    };
    await upsertItem(updated);
    setItem(updated);
    onUpdated();
  };

  const handlePortal = async () => {
    const res = await launchPortalHandoff(agency);
    setFeedbackBanner(res.message);
  };

  const livePortalUrl = (agency?.portalUrl || '').trim();
  const hasValidPortal =
    /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(livePortalUrl) &&
    !/\.(example|placeholder|test|invalid)\.(gov|com|org|net)(\/|$)/i.test(livePortalUrl);


  const activeSenderEmail = (selectedSenderEmail || item.senderEmail || '').trim();
  const effectiveSubject = composerDirty ? composerSubject : emailBundle.subject;
  const effectiveBody = composerDirty ? composerBody : emailBundle.body;

  const handleDirectSendAndLog = async () => {
    if (!activeSenderEmail) {
      setShowSenderPickerBeforeLaunch(true);
      setFeedbackBanner('Pick or add the sender email account you want to send from first.');
      return;
    }
    const targetTo = (emailBundle.to || agency?.contactEmail || '').trim();
    if (!targetTo) {
      setFeedbackBanner('Enter a custodian recipient email before sending.');
      return;
    }
    setIsSendingDirect(true);
    try {
      const savedSmtp = smtpCredentialsByEmail[activeSenderEmail.toLowerCase()] || {};
      const sendRes = await sendDirectSmtpEmail({
        from: activeSenderEmail,
        to: targetTo,
        subject: effectiveSubject,
        text: effectiveBody,
        smtp: {
          host: smtpHostInput.trim() || savedSmtp.host,
          port: Number(smtpPortInput) || savedSmtp.port || 587,
          user: activeSenderEmail,
          pass: smtpPassInput || savedSmtp.pass,
        },
      });
      if (!sendRes.ok) {
        setFeedbackBanner(sendRes.message);
        return;
      }
      const nowIso = new Date().toISOString();
      const nextDue =
        !item.dueDate
          ? addWorkingDays(getTodayCalendarDate(agencyTimeZone), statute.defaultWorkingDays)
          : item.dueDate;
      const updatedSent: PublicRecordItem = {
        ...item,
        status: 'sent',
        sentAt: item.sentAt || nowIso,
        dueDate: nextDue,
        senderEmail: activeSenderEmail,
        senderLabel:
          senderAccounts.find((a) => a.email.toLowerCase() === activeSenderEmail.toLowerCase())?.label ||
          item.senderLabel ||
          null,
      };
      await recordChange(
        updatedSent,
        'STATUS_SENT',
        `Sent directly from ${activeSenderEmail} to ${targetTo} (Subject: "${effectiveSubject}")${nextDue ? ` · Due ${nextDue}` : ''} [${`Direct SMTP dispatch (${getTodayCalendarDate(agencyTimeZone)} ${agencyTimeZone})`}]`
      );
      setFeedbackBanner(`Sent from ${activeSenderEmail} to ${targetTo} and logged as SENT.${nextDue ? ` Due: ${nextDue}.` : ''}`);
    } finally {
      setIsSendingDirect(false);
    }
  };


  const handleCopyHeaderMeta = async () => {
    const line = [
      emailBundle.to ? `To: ${emailBundle.to}` : null,
      emailBundle.subject ? `Subject: ${emailBundle.subject}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    const ok = await copyTextReliably(line || emailBundle.subject);
    if (ok) {
      setCopiedHeaderFeedback(true);
      setTimeout(() => setCopiedHeaderFeedback(false), 2500);
      setFeedbackBanner('Recipient & subject copied to clipboard.');
    } else {
      setFeedbackBanner('Clipboard blocked by browser—copy To & Subject from the preview box below.');
    }
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


  const handleUploadReplyPdf = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets || picked.assets.length === 0) {
        return;
      }
      const asset = picked.assets[0];
      const filenameDateMatch = /(\d{4}-\d{2}-\d{2})/.exec(asset.name || '');
      const candidateDateRaw =
        noteDateInput.trim() ||
        (parsedEmail?.dateLabel && parsedEmail.dateLabel !== 'Unknown date' ? parsedEmail.dateLabel : '') ||
        (filenameDateMatch ? filenameDateMatch[1] : '') ||
        item.sentAt ||
        '';
      const parsedMs = candidateDateRaw ? Date.parse(candidateDateRaw) : NaN;
      const effectiveCreatedAt = !Number.isNaN(parsedMs) ? new Date(parsedMs).toISOString() : new Date().toISOString();
      const effectiveDateLabel = candidateDateRaw || effectiveCreatedAt.slice(0, 10);
      const sizeKb = typeof asset.size === 'number' ? ` (${Math.max(1, Math.round(asset.size / 1024))} KB)` : '';
      await addAuditEntry({
        id: `aud-${Date.now()}-pdf`,
        itemId: item.id,
        action: 'REPLY_PDF_UPLOADED',
        detail: `Attached agency reply PDF: ${asset.name}${sizeKb} · Email date: ${effectiveDateLabel}${asset.uri ? ` [${asset.uri}]` : ''}`,
        createdAt: effectiveCreatedAt,
      });
      const log = await getAuditEntries(item.id);
      setAudits(log);
      onUpdated();
      setFeedbackBanner(`Logged agency reply PDF: ${asset.name}${sizeKb} under email date ${effectiveDateLabel}.`);
    } catch (err: any) {
      setFeedbackBanner(err?.message || 'Could not pick PDF file.');
    }
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
        <Text style={styles.dueText}>
          Agency Clock: {agencyClockNow.zoneAbbr} ({agencyTimeZone})
        </Text>
        {selectedSenderEmail || item.senderEmail ? (
          <Text style={styles.dueText}>
            Sender: {selectedSenderEmail || item.senderEmail}
          </Text>
        ) : null}
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
        <Text style={styles.sectionTitle}>Send &amp; Open Email</Text>
        <View style={styles.actionGrid}>
          <Pressable onPress={handleEmail} style={[styles.actionBtn, styles.primaryActionBtn]}>
            <Text style={styles.primaryActionBtnText}>
              {(selectedSenderEmail || item.senderEmail)
                ? `Launch ${getProviderWebmailInfo(selectedSenderEmail || item.senderEmail).providerName} (${selectedSenderEmail || item.senderEmail})`
                : 'Choose Sender & Launch'}
            </Text>
          </Pressable>
          <Pressable onPress={handleCopyText} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>
              {copiedPacketFeedback ? 'Copied Email!' : 'Copy Email Packet'}
            </Text>
          </Pressable>
          <Pressable onPress={handleOpenDefaultMail} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Open Default Mail</Text>
          </Pressable>
          <Pressable onPress={handleDownloadEml} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>Download Draft Email File</Text>
          </Pressable>
          {hasValidPortal ? (
            <Pressable onPress={handlePortal} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Open Records Portal</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleCopyHeaderMeta} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>
                {copiedHeaderFeedback ? 'Copied To & Subject!' : 'Copy To & Subject'}
              </Text>
            </Pressable>
          )}
          {item.dueDate && item.status !== 'draft' && item.status !== 'fulfilled' && item.status !== 'denied' ? (
            <Pressable onPress={handleReminder} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>Download Calendar (.ics)</Text>
            </Pressable>
          ) : null}
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

        <Text style={styles.subLabel}>
          Sending From Account (Locked to Request Thread)
        </Text>
        <View style={styles.statusGrid}>
          {senderAccounts.map((acc) => {
            const active = selectedSenderEmail.toLowerCase() === acc.email.toLowerCase();
            const isLockedSent = item.status !== 'draft' && Boolean(selectedSenderEmail) && !active;
            return (
              <Pressable
                key={acc.email}
                onPress={() => {
                  if (active) {
                    if (item.status !== 'draft') {
                      setFeedbackBanner(`Thread is locked to ${acc.email} because this request is already ${item.status.toUpperCase()}.`);
                      return;
                    }
                    void persistRequestSender('', '');
                    setFeedbackBanner('Cleared sender account on draft.');
                    return;
                  }
                  if (isLockedSent && pendingSwitchSender !== acc.email) {
                    setPendingSwitchSender(acc.email);
                    setFeedbackBanner(
                      `Warning: This thread was started with ${selectedSenderEmail}. Tap ${acc.email} again only if you intentionally want to switch accounts.`
                    );
                    return;
                  }
                  void persistRequestSender(acc.email, acc.label);
                  setFeedbackBanner(`Request set to send from: ${acc.label} (${acc.email})`);
                }}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>
                  {active ? 'LOCKED · ' : ''}{acc.label}: {acc.email}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.subLabel}>
          Mail App / Webmail for {(selectedSenderEmail || item.senderEmail || 'Selected Sender')}
        </Text>
        <View style={styles.statusGrid}>
          {(
            [
              ['proton', 'Proton Mail'],
              ['gmail', 'Gmail'],
              ['outlook', 'Outlook'],
              ['office365', 'Office 365'],
              ['yahoo', 'Yahoo'],
              ['mailto', 'System Mail'],
            ] as const satisfies ReadonlyArray<readonly [ProviderComposeId, string]>
          ).map(([pid, plabel]) => {
            const targetEmail = (selectedSenderEmail || item.senderEmail || '').trim().toLowerCase();
            const currentPid: ProviderComposeId = targetEmail
              ? selectedProviderByEmail[targetEmail] || detectProviderComposeId(targetEmail)
              : 'mailto';
            const isSelected = currentPid === pid;
            return (
              <Pressable
                key={pid}
                onPress={() => {
                  if (!targetEmail) {
                    setFeedbackBanner('Select or save a sender email first so its mail provider stays locked.');
                    return;
                  }
                  const updatedMap: Record<string, ProviderComposeId> = {
                    ...selectedProviderByEmail,
                    [targetEmail]: pid,
                  };
                  setSelectedProviderByEmail(updatedMap);
                  try {
                    if (typeof window !== 'undefined' && window.localStorage) {
                      window.localStorage.setItem('gcm_sender_provider_v1', JSON.stringify(updatedMap));
                    }
                  } catch {
                    // ignore storage errors
                  }
                  setFeedbackBanner(`Set ${targetEmail} to open via ${plabel}.`);
                }}
                style={[styles.chipBtn, isSelected && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, isSelected && styles.chipBtnTextActive]}>{plabel}</Text>
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


        <Text style={styles.subLabel}>Direct Mail Server Login for Selected Sender (saved on device)</Text>
        <View style={styles.inlineRow}>
          <TextInput
            value={smtpHostInput}
            onChangeText={setSmtpHostInput}
            placeholder="SMTP host (e.g. smtp.comcast.net)"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            value={smtpPortInput}
            onChangeText={setSmtpPortInput}
            placeholder="587"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            style={[styles.input, { width: 76 }]}
          />
        </View>
        <TextInput
          value={smtpPassInput}
          onChangeText={setSmtpPassInput}
          placeholder="Mail / App Password for selected sender account"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          style={styles.input}
        />

        <Text style={styles.subLabel}>Compose Email Inside App (Exact From &amp; To)</Text>
        <Text style={styles.previewMeta}>
          From: {activeSenderEmail || '(none bound — choose sender above)'}
        </Text>
        <Text style={styles.previewMeta}>
          To: {emailBundle.to || '(enter custodian email on agency/request)'}
        </Text>
        <TextInput
          value={effectiveSubject}
          onChangeText={(val) => {
            setComposerDirty(true);
            setComposerSubject(val);
          }}
          placeholder="Email Subject"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
        />
        <TextInput
          value={effectiveBody}
          onChangeText={(val) => {
            setComposerDirty(true);
            setComposerBody(val);
          }}
          placeholder="Compose request email body..."
          placeholderTextColor="#9CA3AF"
          multiline
          style={[styles.input, { minHeight: 150, textAlignVertical: 'top' }]}
        />
        <Pressable
          onPress={handleDirectSendAndLog}
          disabled={isSendingDirect}
          style={[styles.actionBtn, styles.primaryActionBtn]}
        >
          <Text style={styles.primaryActionBtnText}>
            {isSendingDirect
              ? `Sending from ${activeSenderEmail || 'Sender'}...`
              : `Send Directly from ${activeSenderEmail || 'Bound Account'} & Log SENT`}
          </Text>
        </Pressable>

        <View style={styles.previewBox}>
          <Text style={styles.previewMeta}>
            To: {emailBundle.to || '(enter custodian email on agency/request)'}
          </Text>
          <Text style={styles.previewMeta}>Subject: {emailBundle.subject}</Text>
          <Text style={styles.previewBody}>{emailBundle.body}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status &amp; Response Deadline</Text>
        {(selectedProviderByEmail[(selectedSenderEmail || item.senderEmail || '').toLowerCase()] || detectProviderComposeId(selectedSenderEmail || item.senderEmail)) === 'proton' ? (
          <View style={styles.statusGrid}>
            <Pressable
              onPress={() => void handleCopySingleField('To', agency?.contactEmail || '')}
              style={styles.chipBtn}
            >
              <Text style={styles.chipBtnText}>Copy To</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleCopySingleField('Subject', composerSubject || item.title || '')}
              style={styles.chipBtn}
            >
              <Text style={styles.chipBtnText}>Copy Subject</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleCopySingleField('Body', composerBody || item.summary || '')}
              style={styles.chipBtn}
            >
              <Text style={styles.chipBtnText}>Copy Body</Text>
            </Pressable>
          </View>
        ) : null}
        {handoffAwaitingSend && item.status !== 'sent' ? (
          <Text style={styles.mutedText}>
            After sending in your email client (Proton, webmail, or mail app), tap below so the tracker records SENT and starts the response clock.
          </Text>
        ) : null}
        <Pressable
          onPress={() => void handleStatusChange('sent')}
          style={[styles.actionBtn, styles.primaryActionBtn]}
        >
          <Text style={styles.primaryActionBtnText}>
            {handoffAwaitingSend && item.status !== 'sent' ? 'I Sent This Email — Mark Sent' : 'Mark as sent'}
          </Text>
        </Pressable>
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
        <Text style={styles.sectionTitle}>Replies, Exports &amp; Records</Text>
        <Text style={styles.mutedText}>
          Reply date anchored on PDF upload: {noteDateInput.trim() || (parsedEmail?.dateLabel && parsedEmail.dateLabel !== 'Unknown date' ? parsedEmail.dateLabel : '') || (item.sentAt ? item.sentAt.slice(0, 10) : 'Current date')}
        </Text>
        <View style={styles.statusGrid}>
          {(
            [
              ['partially_fulfilled', 'Mark Partial'],
              ['fulfilled', 'Mark Fulfilled'],
              ['denied', 'Mark Denied'],
            ] as const satisfies ReadonlyArray<readonly [RecordStatus, string]>
          ).map(([st, lbl]) => {
            const active = item.status === st;
            return (
              <Pressable
                key={st}
                onPress={() => void handleStatusChange(st)}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{lbl}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            Hide Personal Info (SSN, phone, email, address) on export
          </Text>
          <Switch
            value={scrubPiiOnExport}
            onValueChange={setScrubPiiOnExport}
          />
        </View>
        <Pressable onPress={() => void handleUploadReplyPdf()} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>Upload Agency Reply (PDF)</Text>
        </Pressable>
        <Pressable onPress={handleExportPdf} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            Export &amp; Share PDF Packet
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const followUpTone = availableTones.find((t) => t.id === 'deadline_follow_up');
            const chosenTone = followUpTone ? followUpTone.id : 'clear_professional';
            setUserPickedTone(true);
            setEmailTone(chosenTone);
            setFeedbackBanner(
              followUpTone
                ? 'Switched letter tone to Deadline Follow-Up.'
                : 'Switched letter tone to Clear & Professional for follow-up.'
            );
          }}
          style={styles.actionBtn}
        >
          <Text style={styles.actionBtnText}>Prepare Follow-Up Draft</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            if (!confirmDeleteRequest) {
              setConfirmDeleteRequest(true);
              setFeedbackBanner('Tap Delete Request again to permanently remove this request and its log entries.');
              return;
            }
            await deleteItem(item.id);
            onUpdated();
            onBack();
          }}
          style={styles.warnBtn}
        >
          <Text style={styles.warnBtnText}>
            {confirmDeleteRequest ? 'Tap Again to Permanently Delete Request' : 'Delete Request'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Activity &amp; Date Log</Text>
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
              <Text style={styles.actionBtnText}>Preview &amp; Hide Info</Text>
            </Pressable>
            <Pressable
              onPress={() => setScrubEmailPii((prev) => !prev)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionBtnText}>
                Hide Personal Info: {scrubEmailPii ? 'ON' : 'OFF'}
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
              <Text style={styles.primaryActionBtnText}>Save Reply to Log</Text>
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

        <View style={styles.statusGrid}>
          {(
            [
              ['all', 'All'],
              ['sent', 'Sent'],
              ['pdf', 'PDFs'],
              ['notes', 'Notes'],
            ] as const
          ).map(([key, label]) => {
            const active = auditFilter === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  setAuditFilter(key);
                  setConfirmDeleteAuditId(null);
                }}
                style={[styles.chipBtn, active && styles.chipBtnActive]}
              >
                <Text style={[styles.chipBtnText, active && styles.chipBtnTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {(() => {
          const filtered = audits.filter((entry) => {
            if (!showArchivedAudits && archivedAuditIds.includes(entry.id)) return false;
            const act = (entry.action || '').toUpperCase();
            if (auditFilter === 'sent') return act.includes('SENT') || act.includes('HANDOFF');
            if (auditFilter === 'pdf') return act.includes('PDF');
            if (auditFilter === 'notes') return !act.includes('SENT') && !act.includes('HANDOFF') && !act.includes('PDF');
            return true;
          });
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
                  : 'No audit entries match the current filter.'}
              </Text>
            );
          }

          return sorted.map((entry) => {
            const isArchived = archivedAuditIds.includes(entry.id);
            const isConfirmingDelete = confirmDeleteAuditId === entry.id;
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
                  <View style={styles.inlineRow}>
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
                    <Pressable
                      onPress={async () => {
                        if (!isConfirmingDelete) {
                          setConfirmDeleteAuditId(entry.id);
                          setFeedbackBanner(`Tap "Confirm Delete" again to permanently remove ${entry.action}.`);
                          return;
                        }
                        setConfirmDeleteAuditId(null);
                        await deleteAuditEntry(itemId, entry.id);
                        const nextArchived = archivedAuditIds.filter((id) => id !== entry.id);
                        setArchivedAuditIds(nextArchived);
                        try {
                          if (typeof window !== 'undefined' && window.localStorage) {
                            window.localStorage.setItem(
                              `gcm_archived_audits_${itemId}`,
                              JSON.stringify(nextArchived)
                            );
                          }
                        } catch {
                          // ignore storage errors
                        }
                        const log = await getAuditEntries(itemId);
                        setAudits(log);
                        onUpdated();
                        setFeedbackBanner(`Deleted audit entry (${entry.action}).`);
                      }}
                      style={styles.archivePillBtn}
                    >
                      <Text style={styles.archivePillText}>
                        {isConfirmingDelete ? 'Confirm Delete' : 'Delete'}
                      </Text>
                    </Pressable>
                  </View>
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
