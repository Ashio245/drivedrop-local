import {
  Transfer,
  GoogleAuthStatus,
  DriveQuota,
  DriveFile,
  LibraryItem,
  PlatformConfig,
  SystemHealth,
  SystemInfo,
} from '../types/index.js';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch {
      errMsg = await res.text() || errMsg;
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  getAuthStatus: () => request<GoogleAuthStatus>('/auth/status'),
  getLoginUrl: (fullScope?: boolean) => request<{ url: string }>(`/auth/login-url${fullScope ? '?fullScope=true' : ''}`),
  saveOAuthConfig: (data: { clientId: string; clientSecret: string; redirectUri?: string }) =>
    request<{ success: boolean; message: string }>('/auth/configure-oauth', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  disconnectGoogle: () =>
    request<{ success: boolean; message: string }>('/auth/disconnect', { method: 'POST' }),

  // Transfers
  createTransfer: (data: {
    url: string;
    customFilename?: string;
    folderId?: string;
    customHeaders?: Record<string, string>;
  }) => request<{ id: string; filename: string; status: string }>('/transfers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  listTransfers: (status?: string) =>
    request<{ transfers: Transfer[] }>(`/transfers${status ? `?status=${status}` : ''}`),
  getTransfer: (id: string) => request<Transfer>(`/transfers/${id}`),
  pauseTransfer: (id: string) =>
    request<{ success: boolean }> (`/transfers/${id}/pause`, { method: 'POST' }),
  resumeTransfer: (id: string) =>
    request<{ success: boolean }>(`/transfers/${id}/resume`, { method: 'POST' }),
  cancelTransfer: (id: string) =>
    request<{ success: boolean }>(`/transfers/${id}/cancel`, { method: 'POST' }),
  retryTransfer: (id: string) =>
    request<{ success: boolean }>(`/transfers/${id}/retry`, { method: 'POST' }),
  deleteTransfer: (id: string) =>
    request<{ success: boolean }>(`/transfers/${id}`, { method: 'DELETE' }),

  // Drive
  getDriveAbout: () => request<DriveQuota>('/drive/about'),
  listDriveFiles: (params?: { folderId?: string; q?: string; pageToken?: string; onlyFolders?: boolean; pageSize?: number }) => {
    const qParams = new URLSearchParams();
    if (params?.folderId) qParams.set('folderId', params.folderId);
    if (params?.q) qParams.set('q', params.q);
    if (params?.pageToken) qParams.set('pageToken', params.pageToken);
    if (params?.onlyFolders) qParams.set('onlyFolders', 'true');
    if (params?.pageSize) qParams.set('pageSize', params.pageSize.toString());
    const qs = qParams.toString();
    return request<{ files: DriveFile[]; nextPageToken?: string | null }>(`/drive/files${qs ? `?${qs}` : ''}`);
  },
  createDriveFolder: (data: { name: string; parentId?: string }) =>
    request<DriveFile>('/drive/folders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  renameDriveFile: (id: string, name: string) =>
    request<DriveFile>(`/drive/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  moveDriveFile: (id: string, targetFolderId: string) =>
    request<DriveFile>(`/drive/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ targetFolderId }),
    }),
  deleteDriveFile: (id: string, permanent?: boolean) =>
    request<{ success: boolean }>(`/drive/files/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    }),

  // Library
  listLibraryItems: (params?: { platform?: string; search?: string }) => {
    const qParams = new URLSearchParams();
    if (params?.platform) qParams.set('platform', params.platform);
    if (params?.search) qParams.set('search', params.search);
    const qs = qParams.toString();
    return request<{ items: LibraryItem[] }>(`/library${qs ? `?${qs}` : ''}`);
  },
  createLibraryItem: (item: Partial<LibraryItem>) =>
    request<LibraryItem>('/library', {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  updateLibraryItem: (id: string, item: Partial<LibraryItem>) =>
    request<LibraryItem>(`/library/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    }),
  deleteLibraryItem: (id: string) =>
    request<{ success: boolean }>(`/library/${id}`, { method: 'DELETE' }),
  launchGame: (id: string) =>
    request<{ success: boolean; message: string }>(`/library/${id}/launch`, { method: 'POST' }),
  listPlatforms: () => request<{ platforms: PlatformConfig[] }>('/library/platforms'),
  updatePlatformConfig: (id: string, config: Partial<PlatformConfig>) =>
    request<PlatformConfig>(`/library/platforms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  // Settings
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request<{ success: boolean; message: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // System
  getHealth: () => request<SystemHealth>('/system/health'),
  getSystemInfo: () => request<SystemInfo>('/system/info'),
};
