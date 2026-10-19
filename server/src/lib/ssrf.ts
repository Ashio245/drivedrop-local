import dns from 'dns/promises';
import net from 'net';

export interface SSRFValidationResult {
  isValid: boolean;
  error?: string;
  resolvedIp?: string;
  normalizedUrl?: string;
}

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or reserved range.
 */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;

  // 192.168.0.0/16 (Private)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (b0 >= 240) return true;

  // Broadcast
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address is in a private, loopback, link-local, or reserved range.
 */
function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.substring(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateOrReservedIPv4(ipv4Part);
    }
  }

  // Unique local addresses (fc00::/7 -> fc00... to fdff...)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local unicast (fe80::/10 -> fe80... to febf...)
  if (/^fe[89ab]/i.test(normalized)) return true;

  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Checks if a direct IP string is private or reserved.
 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateOrReservedIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateOrReservedIPv6(ip);
  }
  return true; // If not a valid IP, consider unsafe
}

/**
 * Validates a download URL against SSRF attacks, protocol violations, and private IP ranges.
 */
export async function validateUrlForSSRF(rawUrl: string): Promise<SSRFValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'URL must be a non-empty string.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, error: 'Malformed URL format.' };
  }

  // 1. Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
    };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { isValid: false, error: 'URL must contain a valid hostname.' };
  }

  // Disallow user credentials embedded in URL (e.g. http://user:pass@evil.com)
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'URLs containing embedded basic authentication credentials are not permitted.',
    };
  }

  // 2. Direct IP check
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return {
        isValid: false,
        error: `Direct connections to private, loopback, or reserved IP "${hostname}" are blocked for security (SSRF prevention).`,
        resolvedIp: hostname,
      };
    }
    return {
      isValid: true,
      resolvedIp: hostname,
      normalizedUrl: parsed.toString(),
    };
  }

  // 3. Reject known localhost aliases and cloud metadata hostnames directly
  const lowerHost = hostname.toLowerCase();
  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost === 'metadata.google.internal' ||
    lowerHost === 'instance-data'
  ) {
    return {
      isValid: false,
      error: `Access to local or cloud metadata domain "${hostname}" is blocked.`,
    };
  }

  // 4. DNS resolution and check all resolved IP addresses
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return {
        isValid: false,
        error: `Could not resolve hostname "${hostname}". Check domain name or internet connection.`,
      };
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return {
          isValid: false,
          error: `Domain "${hostname}" resolved to prohibited private or local IP address ${record.address} (SSRF prevention).`,
          resolvedIp: record.address,
        };
      }
    }

    return {
      isValid: true,
      resolvedIp: addresses[0].address,
      normalizedUrl: parsed.toString(),
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `DNS resolution failed for "${hostname}": ${err.message || 'Host not found'}`,
    };
  }
}
