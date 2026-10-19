# Database Schema & API Contracts: DriveDrop Local

## 1. Prisma Schema (SQLite)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Transfer Job State Machine
enum TransferStatus {
  QUEUED
  CONNECTING
  STREAMING
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}

model Transfer {
  id               String         @id @default(cuid())
  sourceUrl        String         // Validated remote download URL
  filename         String         // Sanitized destination filename
  mimeType         String?        // MIME type from Content-Type or extension
  totalBytes       BigInt?        // Null if Content-Length not provided (unknown size)
  transferredBytes BigInt         @default(0)
  status           TransferStatus @default(QUEUED)
  resumableUri     String?        // Google Drive resumable session URL
  driveFileId      String?        // Resulting Google Drive file ID once finalized
  driveFolderId    String?        // Target folder ID in Drive
  customHeaders    String?        // JSON-serialized optional headers (Authorization, Cookies)
  speedBps         Float          @default(0) // Instantaneous transfer speed in bytes/sec
  etaSeconds       Int?           // Estimated remaining seconds
  errorMessage     String?        // Technical error detail if failed
  retries          Int            @default(0) // Retry counter
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  completedAt      DateTime?
  logs             TransferLog[]

  @@index([status])
  @@index([createdAt])
}

model TransferLog {
  id         String   @id @default(cuid())
  transferId String
  transfer   Transfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  level      String   // INFO, WARN, ERROR, DEBUG
  message    String
  timestamp  DateTime @default(now())

  @@index([transferId])
}

model GoogleAuth {
  id                    String    @id @default("primary")
  userEmail             String?
  userName              String?
  userAvatar            String?
  encryptedRefreshToken String?
  encryptedAccessToken  String?
  tokenExpiresAt        DateTime?
  scope                 String?
  defaultFolderId       String?   // Root downloads folder
  emulatorFolderId      String?   // Emulator library root folder
  updatedAt             DateTime  @updatedAt
}

model AppSetting {
  id        String   @id
  value     String
  isSecret  Boolean  @default(false)
  updatedAt DateTime @updatedAt
}

model EmulatorConfig {
  id             String   @id // Platform identifier, e.g. "snes", "ps1", "gba", "switch"
  platformName   String   // Human label, e.g. "Super Nintendo"
  executablePath String   // Local path to emulator binary
  defaultArgs    String?  // CLI flags e.g. "-f" (fullscreen)
  isEnabled      Boolean  @default(true)
  updatedAt      DateTime @updatedAt
}

model LibraryItem {
  id           String   @id @default(cuid())
  title        String
  platform     String   // e.g. "ps1", "snes", "switch"
  region       String?  // USA, EUR, JPN, World
  version      String?  // v1.0, Rev 1
  fileType     String?  // .iso, .chd, .rvz, .zip, .bin
  driveFileId  String?  // ID in Google Drive
  drivePath    String?  // Path in Google Drive
  localPath    String?  // Path in local Google Drive for Desktop directory
  artworkUrl   String?
  tags         String?  // Comma-separated or JSON
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([platform])
  @@index([title])
}
```

## 2. API Contract Endpoints

### 2.1 Authentication & Google Connection (`/api/auth`)
- `GET /api/auth/status`: Returns `{ isConnected: boolean, user: { email, name, avatar } | null, defaultFolderId, emulatorFolderId }`.
- `POST /api/auth/configure-oauth`: Accepts `{ clientId: string, clientSecret: string, redirectUri: string }` and saves securely.
- `GET /api/auth/login-url`: Generates Google OAuth2 consent URL with state token.
- `POST /api/auth/callback`: Handles authorization code exchange, encrypts and stores tokens.
- `POST /api/auth/disconnect`: Revokes Google OAuth token and clears credentials.

### 2.2 Direct-to-Drive Transfers (`/api/transfers`)
- `POST /api/transfers`: Ingests `{ url: string, customFilename?: string, folderId?: string, customHeaders?: Record<string, string> }`. Validates URL (SSRF checks), inspects remote headers (`HEAD`/ranged `GET`), initiates Google Drive resumable session, inserts job into DB, begins streaming worker.
- `GET /api/transfers`: Lists transfers with optional filter `?status=ACTIVE|COMPLETED|ALL`.
- `GET /api/transfers/:id`: Returns single transfer details including byte counts, progress %, speed, and recent logs.
- `POST /api/transfers/:id/pause`: Pauses active streaming socket and saves byte offset.
- `POST /api/transfers/:id/resume`: Re-queries Google Drive resumable offset and resumes remote download stream.
- `POST /api/transfers/:id/cancel`: Aborts stream, cancels resumable session in Drive, marks cancelled.
- `POST /api/transfers/:id/retry`: Re-attempts failed transfer.
- `DELETE /api/transfers/:id`: Deletes job record and logs.
- `GET /api/transfers/events`: Server-Sent Events (SSE) stream broadcasting real-time progress updates.

### 2.3 Drive Explorer (`/api/drive`)
- `GET /api/drive/about`: Returns user storage quota: `{ limit, usage, usageInDrive, usageInDriveTrash }`.
- `GET /api/drive/files`: Lists files/folders in Drive with pagination `?folderId=xxx&pageToken=xxx&q=xxx&sortBy=name|modifiedTime|quotaBytesUsed`.
- `POST /api/drive/folders`: Creates a new folder `{ name: string, parentId?: string }`.
- `PATCH /api/drive/files/:id`: Renames or moves a file.
- `DELETE /api/drive/files/:id`: Trashes or deletes a file.

### 2.4 Emulator Library (`/api/library`)
- `GET /api/library`: Lists library items with filters (`platform`, `search`, `tags`).
- `POST /api/library`: Creates or classifies an item from Drive.
- `PATCH /api/library/:id`: Updates metadata (title, platform, tags, region, version, notes).
- `DELETE /api/library/:id`: Removes library entry.
- `POST /api/library/:id/launch`: Verifies local Drive for Desktop file existence and executes configured emulator binary.
- `GET /api/library/platforms`: Lists platforms and configured emulator paths.
- `PUT /api/library/platforms/:id`: Configures emulator executable path and arguments.

### 2.5 Settings & System (`/api/settings`, `/api/system`)
- `GET /api/settings`: Returns general settings (chunk size, Google Drive for Desktop path, concurrency).
- `PUT /api/settings`: Updates configuration.
- `GET /api/system/health`: Returns server status, memory RSS, system uptime, and connectivity.
