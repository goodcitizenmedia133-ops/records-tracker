import { evaluateVaultUpload, VaultCatalogEntry, VaultGuardInput, VaultGuardResult } from '../utils/vaultPdfGuard';
import { buildCatalogIndexPath } from './vaultCatalog';

export interface VaultConfig {
  r2PublicBaseUrl: string;
  githubIndexRepo: string;
  githubIndexBranch: string;
  presignedUploadEndpoint: string;
}

export interface VaultPublishOutcome {
  guard: VaultGuardResult;
  published: boolean;
  remoteUploaded: boolean;
  publicUrl: string | null;
  catalogJsonSnippet: string;
  message: string;
}

export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  r2PublicBaseUrl: (process.env.EXPO_PUBLIC_VAULT_R2_BASE_URL || 'https://github.com/goodcitizenmedia133-ops/records-vault-index/releases/download/vault-pdfs').trim(),
  githubIndexRepo: (process.env.EXPO_PUBLIC_VAULT_GITHUB_REPO || 'good-citizen-media/records-vault-index').trim(),
  githubIndexBranch: (process.env.EXPO_PUBLIC_VAULT_GITHUB_BRANCH || 'master').trim(),
  presignedUploadEndpoint: (process.env.EXPO_PUBLIC_VAULT_PRESIGN_ENDPOINT || '/api/vault/publish').trim(),
};

export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildVaultCatalogPayload(entry: VaultCatalogEntry, publicUrl: string | null): string {
  return JSON.stringify({ ...entry, publicUrl }, null, 2);
}

export async function prepareAndStageVaultUpload(
  input: VaultGuardInput,
  config: VaultConfig = DEFAULT_VAULT_CONFIG
): Promise<VaultPublishOutcome> {
  const guard = evaluateVaultUpload(input);
  const catalogJsonSnippet = buildVaultCatalogPayload(guard.catalogEntry, null);

  if (guard.decision === 'reject') {
    return {
      guard,
      published: false,
      remoteUploaded: false,
      publicUrl: null,
      catalogJsonSnippet,
      message: `Blocked upload: ${guard.reasons.join(' ')}`,
    };
  }

  const cleanBase = config.r2PublicBaseUrl.replace(/\/+$/, '');
  const publicUrl = guard.catalogEntry.status === 'verified' ? `${cleanBase}/${guard.r2Key}` : null;
  const statusLabel = guard.catalogEntry.status === 'verified' ? 'READY FOR R2 + GITHUB INDEX' : 'QUARANTINED STAGING';

  return {
    guard,
    published: true,
    remoteUploaded: false,
    publicUrl,
    catalogJsonSnippet: buildVaultCatalogPayload(guard.catalogEntry, publicUrl),
    message: `${statusLabel} (${guard.r2Key}) via ${config.presignedUploadEndpoint} -> ${config.githubIndexRepo}@${config.githubIndexBranch}.`,
  };
}

export async function publishVaultArtifact(
  input: VaultGuardInput,
  pdfBytes?: Uint8Array | null,
  config: VaultConfig = DEFAULT_VAULT_CONFIG
): Promise<VaultPublishOutcome> {
  const staged = await prepareAndStageVaultUpload(input, config);
  if (!staged.published) {
    return staged;
  }

  const indexPath = buildCatalogIndexPath(staged.guard.catalogEntry.jurisdictionPath || undefined);
  const entryWithUrl = { ...staged.guard.catalogEntry, publicUrl: staged.publicUrl };

  try {
    const res = await fetch(config.presignedUploadEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        r2Key: staged.guard.r2Key,
        sha256Hex: input.sha256Hex,
        fileSizeBytes: input.fileSizeBytes,
        contentType: 'application/pdf',
        repo: config.githubIndexRepo,
        branch: config.githubIndexBranch,
        indexPath,
        entry: entryWithUrl,
      }),
    });

    if (!res.ok) {
      return {
        ...staged,
        remoteUploaded: false,
        message: `${staged.message} (Server endpoint returned ${res.status}; use copied index JSON for manual commit.)`,
      };
    }

    const payload = (await res.json().catch(() => ({}))) as {
      uploadUrl?: string;
      publicUrl?: string;
      committed?: boolean;
    };

    let uploadedToR2 = false;
    if (payload.uploadUrl && pdfBytes && pdfBytes.byteLength > 0) {
      const bodyBuf = new Uint8Array(pdfBytes.byteLength);
      bodyBuf.set(pdfBytes);
      const putRes = await fetch(payload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: bodyBuf.buffer,
      });
      uploadedToR2 = putRes.ok;
    }

    const finalPublicUrl = payload.publicUrl || staged.publicUrl;
    return {
      ...staged,
      remoteUploaded: Boolean(payload.committed || uploadedToR2),
      publicUrl: finalPublicUrl,
      catalogJsonSnippet: JSON.stringify({ ...entryWithUrl, publicUrl: finalPublicUrl }, null, 2),
      message: payload.committed
        ? `Published to R2 and committed to ${config.githubIndexRepo} (${indexPath}).`
        : uploadedToR2
          ? `Uploaded PDF to R2 (${staged.guard.r2Key}); index entry ready for ${indexPath}.`
          : `Staged via ${config.presignedUploadEndpoint}; verify server R2/GitHub commit response.`,
    };
  } catch {
    return {
      ...staged,
      remoteUploaded: false,
      message: `${staged.message} (No reachable publish endpoint yet; index JSON is ready to copy/commit.)`,
    };
  }
}
