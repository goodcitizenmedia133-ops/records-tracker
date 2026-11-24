export interface ParsedEmlProof {
  fileName: string;
  fileSizeBytes: number;
  sha256Hex: string;
  dateHeaderRaw: string | null;
  parsedIsoDate: string | null;
  parsedCalendarDate: string | null;
  fromHeader: string | null;
  toHeader: string | null;
  subjectHeader: string | null;
  messageId: string | null;
  receivedHops: string[];
  parsedAtIso: string;
}
function unfoldHeaders(rawHeaderBlock: string): string[] {
  const lines = rawHeaderBlock.replace(/\r\n/g, '\n').split('\n');
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ' ' + line.trim();
    } else {
      unfolded.push(line);
    }
  }
  return unfolded;
}
function extractHeaderValues(headerLines: string[], headerName: string): string[] {
  const prefix = `:`;
  const matches: string[] = [];
  for (const line of headerLines) {
    if (line.toLowerCase().startsWith(prefix)) {
      matches.push(line.slice(prefix.length).trim());
    }
  }
  return matches;
}
function toLocalCalendarDate(dateObj: Date): string {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `--`;
}
async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const bytes = new Uint8Array(digest);
    return Array.from(bytes).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  return 'sha256-unavailable-in-runtime';
}
export async function parseEmlFile(file: File): Promise<ParsedEmlProof> {
  const buffer = await file.arrayBuffer();
  const sha256Hex = await computeSha256Hex(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(buffer);
  const splitMatch = text.match(/\r?\n\r?\n/);
  const headerBlock = splitMatch ? text.slice(0, splitMatch.index) : text;
  const headerLines = unfoldHeaders(headerBlock);
  const dateValues = extractHeaderValues(headerLines, 'Date');
  const fromValues = extractHeaderValues(headerLines, 'From');
  const toValues = extractHeaderValues(headerLines, 'To');
  const subjectValues = extractHeaderValues(headerLines, 'Subject');
  const messageIdValues = extractHeaderValues(headerLines, 'Message-ID');
  const receivedHops = extractHeaderValues(headerLines, 'Received');
  const dateHeaderRaw = dateValues[0] ?? null;
  let parsedIsoDate: string | null = null;
  let parsedCalendarDate: string | null = null;
  if (dateHeaderRaw) {
    const dt = new Date(dateHeaderRaw);
    if (!Number.isNaN(dt.getTime())) {
      parsedIsoDate = dt.toISOString();
      parsedCalendarDate = toLocalCalendarDate(dt);
    }
  }
  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    sha256Hex,
    dateHeaderRaw,
    parsedIsoDate,
    parsedCalendarDate,
    fromHeader: fromValues[0] ?? null,
    toHeader: toValues[0] ?? null,
    subjectHeader: subjectValues[0] ?? null,
    messageId: messageIdValues[0] ?? null,
    receivedHops,
    parsedAtIso: new Date().toISOString(),
  };
}