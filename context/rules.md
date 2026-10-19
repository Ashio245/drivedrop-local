# Engineering Rules & Guardrails: DriveDrop Local

## 1. Absolute Non-Negotiables

### 1.1 Zero Arbitrary File Size Limits
- Never enforce an artificial cap on download size (e.g. "max 2GB", "max 10GB").
- Support streaming files of any technically acceptable size (from 1 KB to 5 TB).
- Never buffer the entire file in RAM or on disk.
- Memory consumption during active transfer must remain bounded (constant buffer windows <= 32 MB).

### 1.2 No Intermediary Cloud or Persistent Temp Storage
- Stream directly from remote HTTP socket to Google Drive resumable upload endpoint.
- Do not store uploaded files on local disks or upload them to intermediary cloud buckets (AWS S3, Supabase, Cloudflare R2, etc.).
- The user's Google Drive is the sole final destination.

### 1.3 Strict Legal & Anti-Piracy Guardrails
- The emulator library module is exclusively for metadata classification and management of files legally owned or created by the user (homebrew, public domain, self-dumped backups).
- DriveDrop Local must NEVER include ROM downloads, piracy repositories, torrent indexers, BIOS files, firmware links, decryption keys, or copyright circumvention tools.
- Conspicuous legal disclaimers must be embedded in the UI and documentation.

## 2. Security Guardrails

### 2.1 SSRF (Server-Side Request Forgery) Defense
- All URLs must be parsed and strictly validated before issuing any network call.
- Block private subnets:
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - `127.0.0.0/8` and `::1` (Loopback)
  - `169.254.0.0/16` (Link-local & Cloud Metadata endpoint `169.254.169.254`)
  - `fc00::/7`, `fe80::/10` (IPv6 Unique Local and Link-Local)
- DNS Resolution Verification: Hostname must be resolved prior to connection; if resolved IP matches blocklist, abort immediately.
- Redirect Traversal Defense: Every HTTP redirect (301, 302, 303, 307, 308) must be re-evaluated through the SSRF validator.
- Protocol Lockdown: Strictly reject non-HTTP(S) schemes (`file://`, `ftp://`, `gopher://`, `data:`, `javascript:`).

### 2.2 Credential Protection & Privacy
- OAuth client secrets, refresh tokens, and access tokens must never be sent to the frontend browser or logged in plaintext.
- Never output authorization headers, bearer tokens, or query strings containing keys in application log files or error traces.
- All Google API calls are mediated server-side by Fastify.
- Local SQLite database stores sensitive credentials with AES-256-GCM encryption using a local secret key.
- Provide a 1-click "Revoke & Disconnect" feature that invalidates the Google OAuth token with Google and purges local credentials.

### 2.3 Input Sanitization & Path Traversal Prevention
- Cleanse filenames extracted from `Content-Disposition` headers or URL paths:
  - Strip directory traversal sequences (`../`, `..\\`).
  - Strip reserved system characters (`/`, `\`, null bytes, control characters).
  - Truncate excessively long filenames (Google Drive allows up to 255 chars).
- Local emulator executable launch paths must be verified to exist and executed with `child_process.spawn(executable, args, { shell: false })` to eliminate shell injection vulnerabilities.

## 3. Reliability & Error Recovery Rules

- **Resumable Recovery**: When a transfer is interrupted or paused, the backend must query Google Drive's resumable session (`Range` header) and resume the download stream using HTTP `Range: bytes=N-`.
- **Stream Stalls & Timeout**: Apply socket timeouts and keep-alive handling. If a stream freezes, gracefully fail or retry after backoff rather than hanging indefinite threads.
- **Drive Rate Limiting**: Honor HTTP 403 / 429 quota errors using exponential backoff with jitter.
- **Graceful Shutdown**: On process SIGINT / SIGTERM, gracefully abort active chunk uploads and save exact byte offsets to SQLite so transfers can be resumed upon app restart.

## 4. Code Quality & Standards

- Strict TypeScript with `noImplicitAny: true`.
- Fastify schema validation for all endpoints using TypeBox, Zod, or JSON Schema.
- Comprehensive automated test suite covering:
  - SSRF URL validation and private IP blocking
  - Stream chunking and resumable offset calculation
  - Content-Disposition filename extraction and sanitization
  - Transfer job lifecycle state machine
  - OAuth flow and token encryption/decryption
