# DriveDrop Local 🚀

**Production-Grade, Local-First Direct-to-Drive Transfer Manager & Preservation Library**

DriveDrop Local streams files directly from any HTTP/HTTPS direct-download link straight into your personal Google Drive using Google Drive Resumable Uploads. It does not buffer the full file on local disk, does not store files on intermediary servers, and imposes **zero artificial application-level file size caps**.

> 📖 **Detailed Step-by-Step Walkthrough:**  
> Read the [Complete Local User Guide (`HOW_TO_USE_LOCALLY.md`)](./HOW_TO_USE_LOCALLY.md) for Google Cloud OAuth configuration, transfer controls, and emulator setup.

---

## 🌟 Key Features

1. **Zero-Disk Direct Streaming**
   - Direct socket-to-resumable-upload pipeline.
   - Files of 50 GB, 500 GB, or larger are streamed in bounded chunk windows (8 MB – 32 MB) with memory usage staying safely under 100 MB RSS.
   - No temporary files written to local SSD.
2. **Resumable Uploads & Automatic Recovery**
   - Uses Google Drive's native Resumable Upload protocol.
   - Pause and resume transfers on demand.
   - Crash resilience: persists Google Drive upload session URIs to local SQLite; resumes from byte `N` upon restart.
   - Full support for chunked transfer encoding (unknown content length) with real-time indeterminate pulse bars and dynamic byte counters.
3. **Strict SSRF & Intranet Defense Engine**
   - Hostname pre-resolution and DNS rebinding verification.
   - Blocks private subnets (RFC1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.1`, `::1`), link-local, and cloud metadata endpoints (`169.254.169.254`).
   - Evaluates every HTTP redirect hop against the SSRF policy engine before connecting.
4. **Interactive Google Drive File Explorer**
   - Browse, search, create folders, rename, move, and trash/delete files directly in your Drive.
   - Live Drive quota gauge (used vs total storage limit).
5. **Emulator & Legal Backup Library**
   - Classify legally owned game backups, homebrew software, and public domain archives stored in your Drive.
   - Filter by platform (NES, SNES, N64, GBA, NDS, 3DS, GameCube, Wii, Switch, PS1, PS2, PSP, Genesis, Dreamcast).
   - Direct local emulator launch integration pointing to your Google Drive for Desktop sync path with array-escaped parameters (`shell: false`).
6. **Encrypted Credential Storage**
   - Google OAuth access and refresh tokens are encrypted at rest in local SQLite with **AES-256-GCM**.
   - Frontend never receives tokens. One-click token revocation and local data wipe.

---

## 🏗️ System Architecture & Context

All system specifications and contracts are maintained in `/context`:
- [`/context/prd.md`](./context/prd.md): Product goals, scope, and success criteria.
- [`/context/architecture.md`](./context/architecture.md): Streaming topology, backpressure, and component structure.
- [`/context/design.md`](./context/design.md): Typography, color palette, component specs, zero SaaS-cliché rules.
- [`/context/rules.md`](./context/rules.md): Non-negotiables, SSRF policies, anti-piracy guardrails.
- [`/context/schema.md`](./context/schema.md): Database schema and REST/SSE contracts.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js v22+, TypeScript, Fastify 5, Undici (Streaming HTTP Client)
- **Database**: SQLite with Prisma ORM
- **Authentication**: Official Google OAuth 2.0 (`googleapis`)
- **Storage Destination**: Google Drive API v3 (Resumable Uploads)

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 20+ (Node.js 22 LTS recommended)
- Google Cloud Console account (Free Tier)

### 2. Installation
```bash
git clone <repo-url> drivedrop-local
cd drivedrop-local

# Install dependencies across all workspaces
npm install

# Initialize local SQLite database
npm run db:push
```

### 3. Google Cloud OAuth 2.0 Setup
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new project (e.g. `DriveDrop Local`).
3. Under **APIs & Services > Library**, enable the **Google Drive API**.
4. Under **APIs & Services > OAuth consent screen**:
   - Choose User Type: **External**.
   - Add your own Google account email under **Test Users**.
5. Under **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - Name: `DriveDrop Local Client`.
   - Authorized redirect URIs: `http://127.0.0.1:3001/api/auth/callback`.
6. Copy the generated **Client ID** and **Client Secret**.

### 4. Running the Application
```bash
# Start backend on :3001 and frontend on :5173 concurrently:
npm run dev
```

Visit **`http://localhost:5173`** in your browser.
1. Navigate to **Settings**.
2. Paste your Google Cloud **Client ID** and **Client Secret**, then click **Save OAuth Credentials**.
3. Click **Sign in with Google** to grant Drive access.
4. Go to **New Transfer**, enter any direct download URL, and start streaming!

---

## 🧪 Testing

DriveDrop Local includes automated tests covering SSRF defenses, filename sanitization, AES-256 encryption, stream chunking, and API routes:

```bash
# Run Vitest test suite
npm run test
```

---

## ⚖️ Google Drive Limits & Disclaimers

1. **Daily Upload Quota (750 GB)**: Google enforces a hard daily upload limit of 750 GB across all API and web uploads per user account. If reached, transfers will pause until the rolling 24-hour window resets.
2. **Resumable Session Lifespan**: Google Drive resumable upload sessions expire after approximately 7 days of inactivity.
3. **Legal Compliance**: DriveDrop Local does NOT host, download, or index copyright-infringing content, ROMs, BIOS files, firmware, or decryption keys. Emulator launcher integration is solely intended for legally owned backups, homebrew projects, and public domain material.
