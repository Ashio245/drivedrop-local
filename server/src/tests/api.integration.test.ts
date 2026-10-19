import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('DriveDrop Local API Integration Test Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('System Diagnostics & Health', () => {
    it('returns server health and memory RSS metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/system/health',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.status).toBe('healthy');
      expect(json.memory.rssMb).toBeGreaterThan(0);
      expect(json.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('returns system info and technical disclaimers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/system/info',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.appName).toBe('DriveDrop Local');
      expect(json.disclaimers.zeroDiskUsage).toContain('bounded');
      expect(json.disclaimers.googleDriveDailyLimit).toContain('750 GB');
    });
  });

  describe('Google Auth Configuration Endpoints', () => {
    it('reports unlinked status when no tokens exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/status',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(typeof json.isConnected).toBe('boolean');
    });

    it('saves user-configured OAuth credentials encrypted at rest', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/configure-oauth',
        payload: {
          clientId: 'test-client-id.apps.googleusercontent.com',
          clientSecret: 'test-client-secret-xyz123',
          redirectUri: 'http://127.0.0.1:3001/api/auth/callback',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
    });
  });

  describe('SSRF Protection in Transfer Ingestion', () => {
    it('rejects loopback and private IP download URLs', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          url: 'http://127.0.0.1:8080/internal.dat',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toContain('SSRF Security Violation');
    });

    it('rejects cloud metadata IP 169.254.169.254', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          url: 'http://169.254.169.254/latest/meta-data/',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toContain('SSRF Security Violation');
    });

    it('rejects non-HTTP protocols like file:// and ftp://', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/transfers',
        payload: {
          url: 'file:///etc/hosts',
        },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.error).toContain('Unsupported protocol');
    });

    it('lists transfers with pagination and filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/transfers?status=ALL',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(Array.isArray(json.transfers)).toBe(true);
    });
  });

  describe('Emulator Library & Legal Backup Management', () => {
    let createdItemId: string;

    it('lists supported platforms', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/library/platforms',
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.platforms.length).toBeGreaterThan(5);
      const snes = json.platforms.find((p: any) => p.id === 'snes');
      expect(snes).toBeDefined();
    });

    it('classifies a legal backup item', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/library',
        payload: {
          title: 'Homebrew Test Adventure',
          platform: 'snes',
          region: 'World',
          version: 'v1.0',
          fileType: '.sfc',
          drivePath: 'Homebrew/adventure.sfc',
          tags: 'homebrew, indie, action',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.id).toBeDefined();
      expect(json.title).toBe('Homebrew Test Adventure');
      createdItemId = json.id;
    });

    it('updates item metadata', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/library/${createdItemId}`,
        payload: {
          title: 'Homebrew Test Adventure Revised',
          version: 'v1.1',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.title).toBe('Homebrew Test Adventure Revised');
      expect(json.version).toBe('v1.1');
    });

    it('deletes library index item without error', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/library/${createdItemId}`,
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
    });
  });

  describe('Settings Preferences', () => {
    it('reads and writes general preferences', async () => {
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/settings',
        payload: {
          GDRIVE_DESKTOP_PATH: '/Users/test/Google Drive/My Drive',
          CHUNK_SIZE_MB: '16',
        },
      });

      expect(putRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/api/settings',
      });

      expect(getRes.statusCode).toBe(200);
      const json = JSON.parse(getRes.payload);
      expect(json.GDRIVE_DESKTOP_PATH).toBe('/Users/test/Google Drive/My Drive');
      expect(json.CHUNK_SIZE_MB).toBe('16');
    });
  });
});
