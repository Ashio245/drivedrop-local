# DriveDrop Local — Complete Local User Guide 🚀

This guide explains step-by-step how to set up, configure, and use **DriveDrop Local** on your machine.

---

## 📋 Table of Contents
1. [System Requirements](#1-system-requirements)
2. [Quick Start (3-Minute Setup)](#2-quick-start-3-minute-setup)
3. [Google Cloud OAuth 2.0 Setup (One-Time)](#3-google-cloud-oauth-20-setup-one-time)
4. [Connecting Google Drive in the UI](#4-connecting-google-drive-in-the-ui)
5. [How to Stream Files to Google Drive](#5-how-to-stream-files-to-google-drive)
6. [Managing Active Transfers (Pause, Resume, Logs)](#6-managing-active-transfers-pause-resume-logs)
7. [Using the Google Drive Browser](#7-using-the-google-drive-browser)
8. [Emulator Library & Drive for Desktop Setup](#8-emulator-library--drive-for-desktop-setup)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. System Requirements

- **Operating System**: macOS, Linux, or Windows (WSL / PowerShell)
- **Node.js**: Version 20 or higher (`node -v` to check)
- **Browser**: Chrome, Brave, Safari, Edge, or Firefox
- **Google Account**: Free Personal Google Account (15 GB) or Google Workspace

---

## 2. Quick Start (3-Minute Setup)

### Step 1: Open Terminal and navigate to the project directory
```bash
cd /Users/emer/Downloads/gdrive_download
```

### Step 2: Install dependencies & setup SQLite database
If not already installed:
```bash
npm install
npm run db:push
```

### Step 3: Launch the application
```bash
npm run dev
```

This starts:
- **Backend Service (Fastify)** on `http://127.0.0.1:3001`
- **Frontend UI (React + Vite)** on `http://localhost:5173`

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 3. Google Cloud OAuth 2.0 Setup (One-Time)

To transfer files directly into your personal Google Drive, you need a free Google Cloud OAuth Client ID. You only have to do this once.

### Step-by-Step Instructions:
1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Click **Create Project** (e.g. name it `DriveDrop Local`) and select it.
3. In the left navigation, go to **APIs & Services > Library**.
   - Search for **Google Drive API**.
   - Click **Enable**.
4. In the left navigation, go to **APIs & Services > OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - Fill in **App Name** (`DriveDrop Local`) and your email under **User support email** and **Developer contact information**.
   - Click **Save and Continue** through the Scopes page.
   - Under **Test users**, click **+ Add Users** and add your own Google email address.
   - Click **Save and Continue**.
5. In the left navigation, go to **APIs & Services > Credentials**:
   - Click **+ Create Credentials** at the top and select **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `DriveDrop Local Client`.
   - Under **Authorized redirect URIs**, click **+ Add URI** and enter:
     ```text
     http://127.0.0.1:3001/api/auth/callback
     ```
   - Click **Create**.
6. A dialog will show your **Client ID** (ends with `.apps.googleusercontent.com`) and **Client Secret**. Keep this tab open.

---

## 4. Connecting Google Drive in the UI

1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. In the left sidebar, click **Settings**.
3. Under **Google Cloud OAuth 2.0 Credentials**:
   - Paste your **Client ID**.
   - Paste your **Client Secret**.
   - Verify the Redirect URI is `http://127.0.0.1:3001/api/auth/callback`.
   - Click **Save OAuth Credentials**.
4. Click **Sign in with Google**:
   - A Google authentication window opens.
   - Select your Google account.
   - Because your app is in "Testing" mode, Google may show a *"Google hasn't verified this app"* warning. Click **Advanced > Go to DriveDrop Local (unsafe)**.
   - Check the boxes to allow Drive access and click **Continue**.
5. You will be redirected back to DriveDrop Local with a confirmation. The sidebar and header will now show your avatar, name, and real-time Drive storage gauge!

> [!NOTE]
> **Do you need to sign in every time?**  
> **No.** Your refresh token is encrypted with AES-256-GCM and stored locally in SQLite (`drivedrop.db`). The backend automatically refreshes expired access tokens in the background. Even if you reboot your computer, your session remains active.

---

## 5. How to Stream Files to Google Drive

DriveDrop Local streams files directly from remote servers straight into your Google Drive via resumable upload chunks. It does not download the file to your hard drive first.

### Method 1: Instant Quick Transfer (Dashboard)
1. On the **Dashboard**, paste any direct HTTP or HTTPS download URL into the quick transfer input:
   ```text
   https://speed.hetzner.de/100MB.bin
   ```
2. Click **Stream to Drive** (or press Enter).
3. The transfer immediately enters the queue and begins chunked streaming.

### Method 2: Advanced New Transfer
1. Click **New Transfer** on the sidebar.
2. Enter the **Direct Download URL**.
3. (Optional) Provide a **Custom Filename** (e.g. `debian_installer.iso`). If left blank, DriveDrop Local automatically extracts the filename from `Content-Disposition` or URL path.
4. (Optional) Select a **Target Google Drive Folder** from the dropdown.
5. (Optional) For protected links authorized by you, expand **Advanced: Custom HTTP Headers & Cookies** and supply JSON headers:
   ```json
   {
     "Authorization": "Bearer your_token_here",
     "Cookie": "session_id=abcdef123456"
   }
   ```
6. Click **Start Direct Transfer to Google Drive**.

---

## 6. Managing Active Transfers (Pause, Resume, Logs)

In the **Active Transfers** tab:

- **Live Speed Gauge**: Shows instantaneous network throughput (e.g. `18.5 MB/s`).
- **Progress & ETA**: Shows transferred bytes out of total (e.g. `3.42 GB / 12.80 GB (26.7%)`) and calculated time remaining.
- **Unknown Content Length**: If the source uses chunked encoding without advertising file size, the app displays transferred bytes, speed, elapsed time, and an animated pulse indicator.
- **Pause & Resume**: Click the **Pause** icon (`⏸`) at any time. When you click **Resume** (`▶`), the backend queries Google Drive for the exact byte offset it previously received (`Range: bytes=0-N`) and resumes the source stream using HTTP `Range: bytes=(N+1)-`.
- **Technical Stream Logs**: Click the **Document** icon (`📄`) on any card to view real-time socket traces, DNS lookups, and chunk acknowledgment receipts.

---

## 7. Using the Google Drive Browser

Click **Drive Browser** in the sidebar to access a native cloud explorer:
- **Folder Navigation**: Double-click or click any folder to enter subdirectories with breadcrumb tracking.
- **New Folders**: Click **New Folder** to create directories directly in Google Drive.
- **File Actions**:
  - Rename files or folders.
  - Move files to another folder.
  - Trash / delete files.
  - Open file in Google Drive web interface.
  - **Classify as Legal Backup**: Click the gamepad icon on game/backup files to add them directly to your Emulator Library.

---

## 8. Emulator Library & Drive for Desktop Setup

DriveDrop Local includes a legal preservation library to classify legally owned backups and homebrew software.

### Step 1: Install Google Drive for Desktop
Install [Google Drive for Desktop](https://www.google.com/drive/download/). This creates a local mirror of your Drive on your computer:
- **macOS**: `/Volumes/GoogleDrive/My Drive` or `~/Library/CloudStorage/GoogleDrive-...`
- **Windows**: `G:\My Drive`

### Step 2: Configure Path in DriveDrop Local
1. Go to **Settings > Google Drive for Desktop Mirror Directory**.
2. Enter your local Drive path:
   ```text
   /Volumes/GoogleDrive/My Drive
   ```
3. Under **Local Emulator Executable Paths**, provide the absolute path to your emulator (e.g. `/Applications/Dolphin.app/Contents/MacOS/Dolphin` or `/usr/local/bin/dolphin-emu`).

### Step 3: Launching Games
1. Go to **Emulator Library**.
2. Click **Launch** on any entry.
3. DriveDrop Local verifies that the file exists locally and launches your emulator with array-escaped parameters (`shell: false`).

> [!IMPORTANT]
> **"Cloud-Only" / On-Demand Files:**  
> If Google Drive for Desktop has a file set to "online only", it appears as 0 bytes locally. Right-click the file in macOS Finder or Windows Explorer and select **"Available offline"** before launching.

---

## 9. Troubleshooting & FAQ

### Port 3001 or 5173 already in use?
To change ports, edit `server/.env` or specify environment variables:
```bash
PORT=3002 npm run dev:server
```

### "Source host rejected by SSRF security engine"
DriveDrop Local includes strict SSRF defenses to prevent attacks on private networks. It blocks:
- `127.0.0.1` and `localhost`
- Private subnets (`192.168.x.x`, `10.x.x.x`, `172.16.x.x`)
- Cloud metadata IP (`169.254.169.254`)  
Ensure your download URL points to a public HTTP/HTTPS server.

### "Google Drive daily upload limit reached (HTTP 403 userRateLimitExceeded)"
Google enforces a platform-wide limit of **750 GB of uploads per rolling 24-hour period** across all API and web uploads per user account. If you hit this limit, pause the transfer and resume after the 24-hour window resets.

### "Source returned HTTP 403 Forbidden"
Some websites block automated downloads using Cloudflare Turnstile, browser challenges, CAPTCHAs, or temporary session cookies. DriveDrop Local cannot bypass interactive human CAPTCHAs. Use direct download links or supply valid session headers in the **Advanced Headers** section of New Transfer.
