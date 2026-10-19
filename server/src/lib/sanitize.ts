import path from 'path';

/**
 * Parses Content-Disposition header and extracts the filename.
 * Supports standard RFC 2616 and RFC 5987 / RFC 6266 (filename*=UTF-8''...)
 */
export function extractFilenameFromContentDisposition(headerValue?: string | null): string | null {
  if (!headerValue) return null;

  // 1. Try RFC 5987 encoded filename*=UTF-8''...
  const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // If decoding fails, fall through
    }
  }

  // 2. Try standard quoted or unquoted filename="..."
  const standardMatch = headerValue.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i);
  if (standardMatch) {
    const raw = standardMatch[1] || standardMatch[2];
    if (raw) return raw.trim();
  }

  return null;
}

/**
 * Derives a sanitized filename from a URL path, Content-Disposition, or default.
 */
export function sanitizeFilename(rawFilename?: string | null, fallbackUrl?: string | null): string {
  let candidate = rawFilename?.trim() || '';

  // If no filename provided, attempt to derive from URL
  if (!candidate && fallbackUrl) {
    try {
      const parsed = new URL(fallbackUrl);
      const pathname = parsed.pathname;
      const base = path.basename(pathname);
      if (base && base !== '/' && base !== '.') {
        candidate = decodeURIComponent(base);
      }
    } catch {
      // Ignore URL parse error
    }
  }

  if (!candidate) {
    candidate = `download_${Date.now()}.bin`;
  }

  // Strip path traversal sequences, slashes, null bytes, and non-printable chars
  let cleaned = candidate
    .replace(/[\/\\]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Remove leading dots or hyphens
  cleaned = cleaned.replace(/^[.\-_]+/, '');

  if (!cleaned) {
    cleaned = `download_${Date.now()}.bin`;
  }

  // Check for reserved Windows filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const baseWithoutExt = cleaned.replace(/\.[^/.]+$/, '');
  const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reservedRegex.test(baseWithoutExt)) {
    cleaned = `file_${cleaned}`;
  }

  // Enforce max length of 255 chars preserving extension
  if (cleaned.length > 255) {
    const ext = path.extname(cleaned);
    const nameWithoutExt = path.basename(cleaned, ext);
    cleaned = nameWithoutExt.substring(0, 255 - ext.length) + ext;
  }

  return cleaned;
}

/**
 * Basic MIME type deduction based on common file extensions
 */
export function inferMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.iso': 'application/x-iso9660-image',
    '.chd': 'application/octet-stream',
    '.rvz': 'application/octet-stream',
    '.bin': 'application/octet-stream',
    '.cue': 'text/plain',
    '.zip': 'application/zip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/x-rar-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.nes': 'application/octet-stream',
    '.sfc': 'application/octet-stream',
    '.smc': 'application/octet-stream',
    '.gba': 'application/octet-stream',
    '.nds': 'application/octet-stream',
    '.n64': 'application/octet-stream',
    '.z64': 'application/octet-stream',
    '.nsp': 'application/octet-stream',
    '.xci': 'application/octet-stream',
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };

  return mimeMap[ext] || 'application/octet-stream';
}
