import { prisma } from '../lib/prisma.js';

export interface AppSettingsPayload {
  gdriveDesktopPath?: string;
  defaultFolderId?: string;
  emulatorFolderId?: string;
  chunkSizeMb?: number;
  maxConcurrentTransfers?: number;
}

export class SettingsService {
  private static instance: SettingsService;

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  public async getSettings(): Promise<Record<string, string>> {
    const settings = await prisma.appSetting.findMany({
      where: { isSecret: false },
    });

    const result: Record<string, string> = {
      GDRIVE_DESKTOP_PATH: '',
      DEFAULT_DOWNLOAD_FOLDER_ID: '',
      EMULATOR_FOLDER_ID: '',
      CHUNK_SIZE_MB: '8',
      MAX_CONCURRENT_TRANSFERS: '3',
    };

    for (const s of settings) {
      result[s.id] = s.value;
    }

    return result;
  }

  public async updateSettings(updates: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string') {
        await prisma.appSetting.upsert({
          where: { id: key },
          create: { id: key, value, isSecret: false },
          update: { value },
        });
      }
    }
  }
}
