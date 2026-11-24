export interface ParsedEmailImport {
  sender: string;
  subject: string;
  dateLabel: string;
  bodyText: string;
  suggestedStatus?: 'responsive_records_received' | 'fee_estimate_issued' | 'denied_or_exempt' | 'clarification_requested';
  detectedFeeDollars?: string;
}

function scrubBasicPii(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
}

export function parseRawEmailText(rawText: string, options?: { scrubPii?: boolean }): ParsedEmailImport {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');

  let sender = '';
  let subject = '';
  let dateLabel = '';
  const bodyLines: string[] = [];
  let inHeaders = true;

  for (const line of lines) {
    if (inHeaders && line.trim() === '') {
      inHeaders = false;
      continue;
    }

    if (inHeaders) {
      const fromMatch = line.match(/^From:\s*(.+)$/i);
      const subjMatch = line.match(/^Subject:\s*(.+)$/i);
      const dateMatch = line.match(/^Date:\s*(.+)$/i);
      const toMatch = line.match(/^(To|Cc):\s*(.+)$/i);

      if (fromMatch) {
        sender = fromMatch[1].trim();
        continue;
      }
      if (subjMatch) {
        subject = subjMatch[1].trim();
        continue;
      }
      if (dateMatch) {
        dateLabel = dateMatch[1].trim();
        continue;
      }
      if (toMatch) {
        continue;
      }
      inHeaders = false;
    }

    if (!/^>/.test(line.trim())) {
      bodyLines.push(line);
    }
  }

  let bodyText = bodyLines.join('\n').trim();
  if (!bodyText) {
    bodyText = normalized;
  }

  if (options?.scrubPii !== false) {
    bodyText = scrubBasicPii(bodyText);
    sender = scrubBasicPii(sender);
  }

  const combinedLower = `${subject}\n${bodyText}`.toLowerCase();
  let suggestedStatus: ParsedEmailImport['suggestedStatus'];
  if (/\b(denied|denial|exempt|exemption|withheld|no responsive records)\b/.test(combinedLower)) {
    suggestedStatus = 'denied_or_exempt';
  } else if (/\b(fee|invoice|deposit|estimate|cost|charge)\b/.test(combinedLower)) {
    suggestedStatus = 'fee_estimate_issued';
  } else if (/\b(clarif|narrow|scope|more specific)\b/.test(combinedLower)) {
    suggestedStatus = 'clarification_requested';
  } else if (/\b(attached|enclosed|released|responsive records|grant)\b/.test(combinedLower)) {
    suggestedStatus = 'responsive_records_received';
  }

  const feeMatch = bodyText.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const detectedFeeDollars = feeMatch ? feeMatch[1] : undefined;

  return {
    sender: sender || 'Custodian / External Sender',
    subject: subject || 'Imported Email Correspondence',
    dateLabel: dateLabel || new Date().toLocaleDateString(),
    bodyText,
    suggestedStatus,
    detectedFeeDollars,
  };
}

export function formatSuggestedStatusLabel(status?: ParsedEmailImport['suggestedStatus']): string {
  switch (status) {
    case 'fee_estimate_issued':
      return 'Fee Estimate Mentioned';
    case 'responsive_records_received':
      return 'Records / Release Mentioned';
    case 'denied_or_exempt':
      return 'Denial / Exemption Mentioned';
    case 'clarification_requested':
      return 'Clarification Requested';
    default:
      return '';
  }
}

export function buildCorrespondenceAuditNote(parsed: ParsedEmailImport): string {
  const statusLabel = formatSuggestedStatusLabel(parsed.suggestedStatus);
  const plainSummary = [
    `Email from ${parsed.sender} on ${parsed.dateLabel} regarding "${parsed.subject}".`,
    parsed.detectedFeeDollars ? `Fee mentioned: ${parsed.detectedFeeDollars}.` : '',
    statusLabel ? `Topic clue: ${statusLabel}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cleanBody = parsed.bodyText.replace(/s+/g, ' ').trim().slice(0, 1000);
  const indexTags = [
    '[EMAIL_IMPORT]',
    parsed.suggestedStatus ? `status_hint=${parsed.suggestedStatus}` : '',
    parsed.detectedFeeDollars ? `fee_usd=${parsed.detectedFeeDollars}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `${plainSummary}
Message: ${cleanBody}
${indexTags}`;
}
