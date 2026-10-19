# Product Requirements Document (PRD): DriveDrop Local

## 1. Product Overview & Vision
**DriveDrop Local** is a production-grade, local-first utility designed to stream files directly from any public or authenticated direct-download HTTP/HTTPS URL into a user's personal Google Drive without intermediary cloud servers, external storage fees, or excessive local disk consumption.

The system streams data dynamically in memory-safe bounded chunks and directly initiates Google Drive resumable upload sessions. It allows files of arbitrary size—bounded only by Google Drive API constraints (up to 5 TB per file subject to user drive quota and daily upload limits) and source server capabilities—without imposing artificial application-level size limits.

## 2. Target Users & Use Cases
1. **Power Users & Archivists**: Users downloading multi-gigabyte ISOs, media archives, or datasets directly into Drive without filling their local laptop SSD.
2. **Retro Gaming & Preservation Enthusiasts**: Users organizing legally owned backups, homebrew software, and documentation in their personal Google Drive with metadata classification and optional local emulator launching via Google Drive for Desktop.
3. **Bandwidth & Storage Conscious Users**: Users who want direct-to-cloud transfers running quietly on localhost with real-time speed, bytes transferred, pause/resume, and crash-resilient recovery.

## 3. Core Capabilities & Requirements

### 3.1 Google Drive Connection & OAuth 2.0
- Complete local Google OAuth 2.0 flow using official Google APIs (`googleapis`).
- Minimum required scopes: `https://www.googleapis.com/auth/drive.file` (access only to files opened or created by this app) or configurable full drive access (`https://www.googleapis.com/auth/drive`) when folder browsing of existing hierarchies is needed.
- Secure local storage of OAuth refresh & access tokens using encryption at rest. Tokens are never sent to external servers or exposed to the client frontend.
- Disconnect & token revocation endpoints ensuring complete credential cleanup.
- Target folder selection: dedicated download folder and dedicated emulator-library folder.

### 3.2 Streamed, Chunk-Based Transfers (No Size Caps)
- Accept direct HTTP / HTTPS URLs.
- Zero artificial file size limits. Transfer 50 MB, 5 GB, 50 GB, or larger files reliably.
- Piped HTTP response stream to Google Drive Resumable Upload HTTP endpoint with chunked buffer windows (e.g. 8 MB to 16 MB chunks aligned with Google Drive's 256 KB requirement).
- Safe memory footprint: memory consumption remains steady regardless of whether the file is 100 MB or 100 GB.
- Resumable upload recovery: store Google Drive resumable session URIs in local SQLite. On connection drops or pause/resume, probe Google Drive `PUT` offset and continue from byte `N`.
- Support unknown content lengths (chunked transfer encoding): calculate running bytes, transfer speed, elapsed time, and ETA if length is known.
- Handle redirects, Content-Disposition filenames, SSL verification, and custom headers/cookies.

### 3.3 Security, SSRF & URL Validation
- Validate all incoming URLs before initiating requests.
- Block loopback (127.0.0.1, ::1), private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16), link-local, cloud metadata IP (169.254.169.254), and DNS rebinding attacks.
- Enforce strict HTTP/HTTPS protocol checks (no file://, gopher://, etc.).
- Validate redirect hops against the same SSRF policies.
- Surface explicit technical messages when a source requires interactive login, CAPTCHA, Cloudflare bot checks, or session cookies.

### 3.4 Drive File Manager
- Interactive Drive browser: list, search, sort (by name, size, modified date), filter, rename, move, and trash/delete files created in or managed by the app.
- Clear pagination and folder navigation.
- Real-time Drive quota display (total storage, used storage, trash).
- Proper handling of rate limits (HTTP 403 / 429 backoff) and quota errors.

### 3.5 Emulator & Game Backup Library
- Classify legally owned game backups and homebrew files stored in Drive.
- Metadata organization: Title, Platform (e.g., NES, SNES, GBA, PS1, PS2, GameCube, Switch, etc.), Region, Version, Format/Extension, Tags, Notes, Artwork URL/path.
- Strict legal and safety compliance: DriveDrop Local does NOT provide ROM downloads, piracy links, decryption keys, or firmware. Clear legal notice provided to users.
- Drive for Desktop integration: Launch games locally using user-configured emulator executables pointing to the local Google Drive for Desktop mirror directory (e.g., `~/Google Drive/My Drive/Emulation`).

### 3.6 Resilience, Logging & Telemetry
- SQLite durable transfer job queue (Queued, Connecting, Transferring, Paused, Resumed, Completed, Failed, Cancelled).
- Automatic retries on transient network disconnects with exponential backoff.
- Detailed technical transfer logs per job for debugging stream stalls and HTTP errors.

## 4. Success Criteria
- Ability to initiate a download from a remote URL directly to Google Drive with near-zero temporary disk footprint.
- Streaming memory usage stays under 100 MB RSS even on massive transfers.
- Smooth, clean, human-designed interface without AI-generated design clichés or fake dashboards.
- 100% production-ready, typed TypeScript code with passing tests.
