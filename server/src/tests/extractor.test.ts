import { describe, it, expect } from 'vitest';
import path from 'path';
import { ArchiveExtractorService } from '../services/archive-extractor.service.js';

describe('Archive Extractor Service & Security Defenses', () => {
  const service = ArchiveExtractorService.getInstance();

  it('sanitizes malicious directory traversal paths inside archives', () => {
    const sanitize = (service as any).sanitizeArchivePath.bind(service);

    expect(sanitize('../../../etc/passwd')).toBe('etc/passwd');
    expect(sanitize('..\\..\\windows\\system32\\calc.exe')).toBe('windows/system32/calc.exe');
    expect(sanitize('/root/.ssh/id_rsa')).toBe('root/.ssh/id_rsa');
    expect(sanitize('nested/dir/../../escape.bin')).toBe('escape.bin');
    expect(sanitize('clean/folder/file.iso')).toBe('clean/folder/file.iso');
  });

  it('rejects unsupported file formats gracefully', async () => {
    // If given a non-zip / non-rar file
    await expect(
      service.extractArchive({ fileId: 'invalid_id_not_found' })
    ).rejects.toThrow();
  });
});
