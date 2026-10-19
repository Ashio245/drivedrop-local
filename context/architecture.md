# Architecture Specification: DriveDrop Local

## 1. System Topology & Component Layout

DriveDrop Local is structured as a robust local-first desktop/web architecture consisting of a Fastify backend (Node.js/TypeScript), a Vite React frontend (TypeScript/Tailwind CSS), and an embedded SQLite database managed via Prisma ORM.

```
+-------------------------------------------------------------------------+
|                           CLIENT TIER (Vite + React)                    |
|  - Modern, responsive SPA with Tailwind CSS                             |
|  - Lucide icons, native component hierarchy, zero fake charts           |
|  - Server-Sent Events (SSE) or polling for real-time transfer telemetry|
|  - Router: Dashboard, New Transfer, Active Jobs, History, Drive Browser |
|            Emulator Library, Settings, Security/Privacy, Help/Docs      |
+------------------------------------+------------------------------------+
                                     | HTTP REST & SSE (localhost:3001)
                                     v
+------------------------------------+------------------------------------+
|                      LOCAL BACKEND SERVICE (Fastify)                    |
|                                                                         |
|  [API Routes]                                                           |
|   ├── /api/auth/*        (Google OAuth2 initiate, callback, status, revoke)|
|   ├── /api/transfers/*   (create, list, pause, resume, cancel, logs)    |
|   ├── /api/drive/*       (folders, file list, rename, delete, quota)    |
|   ├── /api/library/*     (emulator entries, platforms, artwork, launch) |
|   ├── /api/settings/*    (folders, paths, chunk size, concurrency)     |
|   └── /api/system/*      (health, disk space, network check, version)   |
|                                                                         |
|  [Core Services]                                                        |
|   ├── StreamManager      (Direct HTTP -> Google Drive Resumable Pipe)   |
|   ├── SSRFValidator      (DNS resolution check, private IP blocklist)   |
|   ├── DriveClientService (googleapis wrapper, rate limiting, retry)     |
|   ├── EmulatorLauncher   (Sanitized local process invocation)           |
|   └── TokenStorage       (Local encrypted database & safe key storage)  |
+-------------------+--------------------------------+--------------------+
                    |                                |
                    v                                v
+-------------------+------------------+  +----------+--------------------+
|       LOCAL DATABASE (SQLite)        |  |     GOOGLE DRIVE REST API     |
|  - Prisma ORM                        |  |  - Resumable Upload Protocol  |
|  - Transfers, Jobs, Logs             |  |  - Drive v3 Files API         |
|  - Library Items, Platforms          |  |  - About API (Quota)          |
|  - App Settings, Encrypted Tokens    |  |  - Direct Stream via HTTPS    |
+--------------------------------------+  +-------------------------------+
```

## 2. Streaming & Resumable Upload Architecture

### 2.1 Direct-to-Drive Zero-Disk Pipeline
Traditional download managers write incoming files to a local temp folder (`/tmp/file.iso`), wait for completion, and then upload to Google Drive. This doubles disk I/O, risks filling smaller SSDs, and fails for files larger than available local storage.

DriveDrop Local employs Google Drive's **Resumable Upload Protocol** directly:
1. **Metadata Handshake**: Backend requests an upload URI from `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable` specifying target folder, MIME type, and expected total byte length (or omitted if unknown).
2. **Resumable URI Preservation**: The unique upload URI returned in `Location` header is persisted to SQLite with the transfer record.
3. **Chunked Stream Pump**:
   - Remote URL is fetched using `fetch` or `got`/`undici` with streaming enabled.
   - Incoming stream chunks are gathered into an optimal Google Drive chunk buffer (multiples of 256 KiB, default: 8 MiB or 16 MiB).
   - Each chunk is transmitted via `PUT` with `Content-Range: bytes START-END/TOTAL`.
   - On completion of each chunk, progress and byte offsets are updated in SQLite and broadcast to the frontend via SSE.
4. **Pause, Resume & Recovery**:
   - If network drops or the user pauses, the stream is aborted.
   - On resume, the backend issues an empty `PUT` to the resumable session URI with `Content-Range: bytes */TOTAL`.
   - Google Drive responds with `308 Resume Incomplete` and the `Range: bytes=0-LAST_BYTE` header.
   - The backend issues a ranged HTTP request to the remote source (`Range: bytes=(LAST_BYTE+1)-`) and streams the remaining content seamlessly.

### 2.2 Memory Safety
- High-water-mark backpressure ensures that if Google Drive upload is slower than source download, the incoming network socket is paused.
- Memory never exceeds chunk buffer capacity (~16-32 MB), guaranteeing reliable operation even on 100 GB+ transfers.

## 3. Security & Isolation Architecture

1. **Local-Only Service**: Server binds strictly to `127.0.0.1` (or user-chosen host). No external port exposure.
2. **Strict SSRF Guard**:
   - Hostnames in URLs are resolved via `dns.lookup()`.
   - Target IPv4/IPv6 are checked against RFC1918, RFC4193, loopback, multicast, link-local, and AWS/GCP metadata addresses (e.g. `169.254.169.254`).
   - Any redirection (HTTP 301, 302, 307, 308) is intercepted and re-validated through the SSRF engine before following.
3. **Credential Security**:
   - Google OAuth tokens are stored locally in the SQLite database encrypted with a local machine key or environment key.
   - Frontend never receives OAuth tokens or secret keys.
4. **Emulator Launcher Isolation**:
   - Emulators are launched only with user-configured, validated paths.
   - Arguments are array-escaped (using `child_process.spawn`) without shell interpolation (`shell: false`).

## 4. Frontend Architecture

- **React 18 / 19** with TypeScript and Vite.
- **Tailwind CSS v3 / v4** for clean, bespoke, minimalist utility aesthetics.
- **Client State**:
  - React Query / SWR / custom SSE store for optimistic updates, transfer progress bars, speed gauges, and real-time event subscriptions.
- **No Third-Party Cloud Bloat**: All state and operations communicate strictly with `http://127.0.0.1:3001`.
