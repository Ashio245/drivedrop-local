import { describe, it, expect } from 'vitest';
import { isPrivateIp, validateUrlForSSRF } from '../lib/ssrf.js';

describe('SSRF Protection Guardrails', () => {
  it('correctly identifies private and reserved IPv4 addresses', () => {
    // Loopback
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
    
    // RFC1918 Private subnets
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.254.12.3')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.254')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('192.168.100.50')).toBe(true);

    // Cloud metadata & Link-local
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);

    // Current network & broadcast
    expect(isPrivateIp('0.0.0.0')).toBe(true);
    expect(isPrivateIp('255.255.255.255')).toBe(true);

    // Public IPv4 addresses should not be private
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('142.250.190.46')).toBe(false);
  });

  it('correctly identifies private and reserved IPv6 addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
  });

  it('rejects forbidden protocols like file://, ftp://, gopher://', async () => {
    const fileRes = await validateUrlForSSRF('file:///etc/passwd');
    expect(fileRes.isValid).toBe(false);
    expect(fileRes.error).toContain('Unsupported protocol');

    const ftpRes = await validateUrlForSSRF('ftp://speedtest.tele2.net/1MB.zip');
    expect(ftpRes.isValid).toBe(false);

    const gopherRes = await validateUrlForSSRF('gopher://example.com');
    expect(gopherRes.isValid).toBe(false);
  });

  it('blocks direct access to private IPs via HTTP URL', async () => {
    const res1 = await validateUrlForSSRF('http://127.0.0.1:8080/secret');
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('private, loopback, or reserved IP');

    const res2 = await validateUrlForSSRF('http://192.168.1.254/router');
    expect(res2.isValid).toBe(false);

    const res3 = await validateUrlForSSRF('http://169.254.169.254/latest/meta-data/');
    expect(res3.isValid).toBe(false);
  });

  it('blocks localhost aliases and cloud metadata hostnames', async () => {
    const res1 = await validateUrlForSSRF('http://localhost:3000/api');
    expect(res1.isValid).toBe(false);

    const res2 = await validateUrlForSSRF('http://sub.localhost:8080');
    expect(res2.isValid).toBe(false);

    const res3 = await validateUrlForSSRF('http://metadata.google.internal/computeMetadata/v1/');
    expect(res3.isValid).toBe(false);
  });

  it('rejects URLs containing embedded user credentials', async () => {
    const res = await validateUrlForSSRF('https://admin:pass@example.com/file.zip');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('embedded basic authentication');
  });

  it('accepts legitimate public HTTPS download URLs', async () => {
    const res = await validateUrlForSSRF('https://www.google.com/robots.txt');
    expect(res.isValid).toBe(true);
    expect(res.resolvedIp).toBeDefined();
    expect(isPrivateIp(res.resolvedIp!)).toBe(false);
  });
});
