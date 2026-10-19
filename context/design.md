# Design & UX Specification: DriveDrop Local

## 1. Visual Philosophy & Principles

DriveDrop Local is a precision engineering tool for moving data and managing file collections. Its visual identity reflects reliability, clarity, technical integrity, and utility.

### Non-Negotiables
- **No SaaS Clichés**: Absolutely no purple/blue cosmic gradients, rainbow mesh backgrounds, glowing frosted glass, or floating neon orb decorations.
- **No Fake Data**: No mock MRR charts, fake user graphs, vanity metrics, or dummy analytics. Every number displayed represents actual bytes, real seconds, genuine quota, or real files.
- **Typography-Driven**: Clean sans-serif hierarchy (Inter or system UI stack) with monospaced accents (JetBrains Mono / SF Mono) for byte counts, hashes, transfer speeds, URIs, and status badges.
- **Restrained Color Palette**:
  - Deep neutral canvas: Slate / Zinc scales (`zinc-950` dark surface, `zinc-900` cards, `zinc-800` borders, `zinc-100` crisp text).
  - High-contrast functional accents: Emerald / Teal for healthy progress/success (`emerald-500`), Amber for paused/warnings (`amber-500`), Rose for failures/SSRF blocks (`rose-500`), Sky / Blue for active connections (`sky-500`).
  - Subtle borders (`border-zinc-800`), crisp surfaces, and tactile interactive elements.

## 2. Layout Structure & Navigation

### Layout Grid
- **Sidebar Navigation**: Fixed left-hand column containing:
  - App Header: "DriveDrop Local" logomark with version and local connection status indicator (green dot = backend healthy, Google Drive linked).
  - Primary Nav:
    - **Dashboard**: High-level system overview (active transfers, storage quota, recent activity).
    - **New Transfer**: Direct URL ingestion, custom filename, target folder picker, advanced headers/auth toggle.
    - **Active Transfers**: Detailed live stream meters, pause/resume/cancel controls, stream logs.
    - **Transfer History**: Completed, failed, and archived jobs with full logs and retry options.
    - **Drive Browser**: File explorer directly querying Google Drive with search, sort, and folder navigation.
    - **Emulator Library**: Classified game preservation items, platform filters, metadata editor, and "Launch" triggers.
    - **Settings & Config**: OAuth setup, Drive folder defaults, Drive for Desktop path, emulator paths, chunk sizes.
    - **Security & Privacy**: SSRF policy audit, credential revocation, data deletion, clear disclaimer.
    - **Help & Limitations**: Comprehensive manual on technical limits, Google Drive daily upload quota (750 GB/day), resumable sessions.

## 3. UI States & Component Specifications

### 3.1 Progress & Transfer Displays
- **Known-Size Transfers**:
  - Deterministic progress bar with smooth CSS transition.
  - Metrics line: `Transferred 3.42 GB / 12.80 GB (26.7%) • 18.4 MB/s • ETA: 8m 32s`.
- **Unknown-Size Transfers (Chunked Stream)**:
  - Indeterminate striped pulse bar.
  - Metrics line: `Transferred 845.2 MB (Unknown total) • 12.1 MB/s • Elapsed: 1m 12s`.
- **Status Pills**:
  - `Queued` (zinc), `Connecting` (sky pulse), `Streaming` (emerald pulse), `Paused` (amber), `Completed` (emerald solid), `Failed` (rose), `Cancelled` (zinc line-through).

### 3.2 Error & Warning Banners
- Non-modal, clear explanatory banners indicating exact root causes:
  - "Source host `192.168.1.1` rejected by SSRF security engine."
  - "Source returned HTTP 403 Forbidden. The download link likely requires a browser session, cookies, or CAPTCHA verification."
  - "Google Drive storage quota exceeded or daily 750 GB upload limit reached."
  - "Resumable session expired (Google Drive sessions expire after ~7 days of inactivity). Restarting from byte 0."

### 3.3 Empty States
- Always informative and actionable:
  - Empty Transfers: "No active transfers. Enter a direct download link to begin streaming into your Drive."
  - Empty Library: "No items classified yet. Browse your Drive files or add a new entry to link legally owned backups."
  - Google Disconnected: "Google Drive is not connected. Configure your OAuth credentials or sign in to start transferring."

### 3.4 Responsive Design & Desktop Ergonomics
- Optimized for desktop viewport (1024px to 1920px+). Keyboard shortcuts for common actions (`Cmd/Ctrl + N` for new transfer, `Cmd/Ctrl + K` for search).
