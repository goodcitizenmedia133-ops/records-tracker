import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { STATUTES, StatuteCode } from '../data/statutes';
import { AgencyRecord, AuditEntry, PublicRecordItem } from '../types/models';
import { scrubPii } from './piiScrubber';

export interface PacketBuildOptions {
  scrubPersonalInfo?: boolean;
  customRedactTerms?: string[];
}

export interface PacketBuildResult {
  ok: boolean;
  message: string;
  uri?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPacketHtml(
  item: PublicRecordItem,
  audits: AuditEntry[],
  agency?: AgencyRecord | null,
  options?: PacketBuildOptions
): string {
  const applyScrub = Boolean(options?.scrubPersonalInfo);
  const cleanText = (val: string): string => {
    if (!applyScrub) return val;
    return scrubPii(val, { customTerms: options?.customRedactTerms }).scrubbedText;
  };

  const statuteCode = (
    item.statuteCode === 'CORA' ||
    item.statuteCode === 'CCJRA' ||
    item.statuteCode === 'FOIA'
      ? item.statuteCode
      : 'CORA'
  ) as StatuteCode;
  const statute = STATUTES[statuteCode];

  const auditRowsHtml =
    audits.length === 0
      ? '<tr><td colspan="3">No audit entries recorded yet.</td></tr>'
      : audits
          .map(
            (entry) => `
        <tr>
          <td>${escapeHtml(entry.createdAt)}</td>
          <td><strong>${escapeHtml(entry.action)}</strong></td>
          <td>${escapeHtml(cleanText(entry.detail))}</td>
        </tr>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Records Request Compliance Packet</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #111827;
      padding: 28px;
      line-height: 1.45;
      font-size: 13px;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 4px 0;
      border-bottom: 2px solid #111827;
      padding-bottom: 8px;
    }
    .meta {
      color: #4B5563;
      margin-bottom: 18px;
      font-size: 12px;
    }
    .card {
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
    }
    .grid {
      width: 100%;
      border-collapse: collapse;
    }
    .grid td {
      padding: 5px 8px;
      vertical-align: top;
      border-bottom: 1px solid #E5E7EB;
    }
    .grid td.label {
      width: 170px;
      font-weight: 600;
      color: #374151;
    }
    table.log {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.log th, table.log td {
      border: 1px solid #D1D5DB;
      padding: 6px 8px;
      text-align: left;
      font-size: 12px;
    }
    table.log th {
      background-color: #F3F4F6;
    }
  </style>
</head>
<body>
  <h1>Public Records Compliance &amp; Audit Packet</h1>
  <div class="meta">
    Generated locally on ${escapeHtml(new Date().toISOString())}
    ${applyScrub ? ' &bull; PII Redaction Applied' : ''}
  </div>

  <div class="card">
    <table class="grid">
      <tr><td class="label">Request Title</td><td>${escapeHtml(cleanText(item.title))}</td></tr>
      <tr><td class="label">Request ID</td><td>${escapeHtml(item.id)}</td></tr>
      <tr><td class="label">Agency</td><td>${escapeHtml(item.agencyName)}</td></tr>
      <tr><td class="label">Agency Contact</td><td>${escapeHtml(cleanText(agency?.contactEmail || 'Not set'))}</td></tr>
      <tr><td class="label">Statute</td><td>${escapeHtml(statute.name)} (${escapeHtml(statute.citation)})</td></tr>
      <tr><td class="label">Current Status</td><td>${escapeHtml(item.status.toUpperCase())}</td></tr>
      <tr><td class="label">Created At</td><td>${escapeHtml(item.createdAt)}</td></tr>
      <tr><td class="label">Sent At</td><td>${escapeHtml(item.sentAt || 'Not sent yet')}</td></tr>
      <tr><td class="label">Statutory Due Date</td><td>${escapeHtml(item.dueDate || 'Not set')}</td></tr>
      <tr><td class="label">Fee Quoted</td><td>${item.feeQuoted !== null ? '$' + item.feeQuoted.toFixed(2) : 'None'}</td></tr>
    </table>
  </div>

  <div class="card">
    <strong>Request Scope / Summary</strong>
    <p>${escapeHtml(cleanText(item.summary || 'No summary provided.'))}</p>
    <strong>Notes</strong>
    <p>${escapeHtml(cleanText(item.notes || 'None.'))}</p>
  </div>

  <div class="card">
    <strong>Chronological Audit Trail</strong>
    <table class="log">
      <thead>
        <tr>
          <th style="width: 170px;">Timestamp</th>
          <th style="width: 150px;">Action</th>
          <th>Detail</th>
        </tr>
      </thead>
      <tbody>
        ${auditRowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export async function exportAndSharePacketPdf(
  item: PublicRecordItem,
  audits: AuditEntry[],
  agency?: AgencyRecord | null,
  options?: PacketBuildOptions
): Promise<PacketBuildResult> {
  try {
    const html = buildPacketHtml(item, audits, agency, options);
    const { uri } = await Print.printToFileAsync({ html });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Packet — ${item.title}`,
      });
      return {
        ok: true,
        message: 'PDF compliance packet generated and opened in share sheet.',
        uri,
      };
    }

    return {
      ok: true,
      message: `PDF packet saved locally at: ${uri}`,
      uri,
    };
  } catch {
    return {
      ok: false,
      message:
        'PDF file generation is not supported in this preview environment. Try running on iOS or Android.',
    };
  }
}