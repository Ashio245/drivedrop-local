export type TransferStatus =
  | 'QUEUED'
  | 'CONNECTING'
  | 'STREAMING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface TransferLog {
  id: string;
  transferId: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  timestamp: string;
}

export interface Transfer {
  id: string;
  sourceUrl: string;
  filename: string;
  mimeType: string | null;
  totalBytes: string | null;
  transferredBytes: string;
  status: TransferStatus;
  resumableUri: string | null;
  driveFileId: string | null;
  driveFolderId: string | null;
  speedBps: number;
  etaSeconds: number | null;
  errorMessage: string | null;
  retries: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  logs?: TransferLog[];
  _count?: { logs: number };
}

export interface TransferProgressEvent {
  transferId: string;
  status: TransferStatus;
  transferredBytes: string;
  totalBytes: string | null;
  speedBps: number;
  etaSeconds: number | null;
  percentage: number | null;
  errorMessage?: string | null;
  filename: string;
}

export interface GoogleAuthStatus {
  isConnected: boolean;
  hasOAuthConfig: boolean;
  user: {
    email: string | null;
    name: string | null;
    avatar: string | null;
  } | null;
  defaultFolderId: string | null;
  emulatorFolderId: string | null;
}

export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
  userDisplayName?: string;
  userEmail?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  parents?: string[];
  iconLink?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  platform: string;
  region?: string | null;
  version?: string | null;
  fileType?: string | null;
  driveFileId?: string | null;
  drivePath?: string | null;
  localPath?: string | null;
  artworkUrl?: string | null;
  tags?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformConfig {
  id: string;
  name: string;
  fileExtensions: string[];
  defaultExecutable: string;
  executablePath: string;
  defaultArgs: string;
  isEnabled: boolean;
}

export interface SystemHealth {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export interface SystemInfo {
  appName: string;
  version: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  totalMemMb: number;
  freeMemMb: number;
  disclaimers: {
    zeroDiskUsage: string;
    googleDriveDailyLimit: string;
    resumableExpiry: string;
    legalNotice: string;
  };
}
