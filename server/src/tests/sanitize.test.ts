import { describe, it, expect } from 'vitest';
import {
  extractFilenameFromContentDisposition,
  sanitizeFilename,
  inferMimeTypeFromFilename,
} from '../lib/sanitize.js';

describe('Sanitization & Filename Extraction', () => {
  it('extracts standard filenames from Content-Disposition', () => {
    const header1 = 'attachment; filename="game_archive.iso"';
    expect(extractFilenameFromContentDisposition(header1)).toBe('game_archive.iso');

    const header2 = 'attachment; filename=rom_v1.2.zip';
    expect(extractFilenameFromContentDisposition(header2)).toBe('rom_v1.2.zip');
  });

  it('extracts RFC 5987 / RFC 6266 UTF-8 encoded filenames', () => {
    const header = "attachment; filename*=UTF-8''Super%20Mario%20World.sfc";
    expect(extractFilenameFromContentDisposition(header)).toBe('Super Mario World.sfc');
  });

  it('sanitizes malicious directory traversal attempts', () => {
    const evil1 = '../../../../etc/passwd';
    expect(sanitizeFilename(evil1)).not.toContain('..');
    expect(sanitizeFilename(evil1)).not.toContain('/');

    const evil2 = '..\\..\\Windows\\System32\\cmd.exe';
    expect(sanitizeFilename(evil2)).not.toContain('..');
    expect(sanitizeFilename(evil2)).not.toContain('\\');
  });

  it('prefixes Windows reserved filenames to prevent OS conflicts', () => {
    expect(sanitizeFilename('CON.iso')).toBe('file_CON.iso');
    expect(sanitizeFilename('prn.txt')).toBe('file_prn.txt');
    expect(sanitizeFilename('AUX.bin')).toBe('file_AUX.bin');
    expect(sanitizeFilename('NUL.zip')).toBe('file_NUL.zip');
    expect(sanitizeFilename('com1.dat')).toBe('file_com1.dat');
  });

  it('falls back to URL basename when filename is omitted', () => {
    const url = 'https://archive.org/download/sample_dataset/dataset_2024.tar.gz?token=xyz';
    expect(sanitizeFilename(null, url)).toBe('dataset_2024.tar.gz');
  });

  it('correctly maps known extensions to MIME types', () => {
    expect(inferMimeTypeFromFilename('game.iso')).toBe('application/x-iso9660-image');
    expect(inferMimeTypeFromFilename('archive.zip')).toBe('application/zip');
    expect(inferMimeTypeFromFilename('video.mp4')).toBe('video/mp4');
    expect(inferMimeTypeFromFilename('unknown.xyz123')).toBe('application/octet-stream');
  });
});
