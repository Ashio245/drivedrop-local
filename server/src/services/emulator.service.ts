import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { prisma } from '../lib/prisma.js';

export interface PlatformMetadata {
  id: string;
  name: string;
  defaultExecutable: string;
  fileExtensions: string[];
}

export const SUPPORTED_PLATFORMS: PlatformMetadata[] = [
  { id: 'nes', name: 'Nintendo Entertainment System', defaultExecutable: 'fceux', fileExtensions: ['.nes'] },
  { id: 'snes', name: 'Super Nintendo (SNES)', defaultExecutable: 'snes9x', fileExtensions: ['.sfc', '.smc'] },
  { id: 'n64', name: 'Nintendo 64', defaultExecutable: 'mupen64plus', fileExtensions: ['.z64', '.n64'] },
  { id: 'gba', name: 'Game Boy Advance', defaultExecutable: 'mgba', fileExtensions: ['.gba'] },
  { id: 'nds', name: 'Nintendo DS', defaultExecutable: 'melonds', fileExtensions: ['.nds'] },
  { id: '3ds', name: 'Nintendo 3DS', defaultExecutable: 'citra', fileExtensions: ['.3ds', '.cia'] },
  { id: 'gamecube', name: 'Nintendo GameCube', defaultExecutable: 'dolphin-emu', fileExtensions: ['.iso', '.rvz', '.gcm'] },
  { id: 'wii', name: 'Nintendo Wii', defaultExecutable: 'dolphin-emu', fileExtensions: ['.iso', '.rvz', '.wbfs'] },
  { id: 'switch', name: 'Nintendo Switch', defaultExecutable: 'ryujinx', fileExtensions: ['.nsp', '.xci'] },
  { id: 'ps1', name: 'Sony PlayStation (PS1)', defaultExecutable: 'duckstation', fileExtensions: ['.chd', '.cue', '.bin', '.iso'] },
  { id: 'ps2', name: 'Sony PlayStation 2 (PS2)', defaultExecutable: 'pcsx2', fileExtensions: ['.iso', '.chd'] },
  { id: 'psp', name: 'Sony PlayStation Portable (PSP)', defaultExecutable: 'ppsspp', fileExtensions: ['.iso', '.cso'] },
  { id: 'genesis', name: 'Sega Genesis / Mega Drive', defaultExecutable: 'blastem', fileExtensions: ['.md', '.bin', '.gen'] },
  { id: 'dreamcast', name: 'Sega Dreamcast', defaultExecutable: 'flycast', fileExtensions: ['.chd', '.cdi', '.gdi'] },
];

export class EmulatorService {
  private static instance: EmulatorService;

  public static getInstance(): EmulatorService {
    if (!EmulatorService.instance) {
      EmulatorService.instance = new EmulatorService();
    }
    return EmulatorService.instance;
  }

  /**
   * Initializes default platform configs in DB if not present.
   */
  public async ensureDefaultPlatforms(): Promise<void> {
    for (const p of SUPPORTED_PLATFORMS) {
      const existing = await prisma.emulatorConfig.findUnique({ where: { id: p.id } });
      if (!existing) {
        await prisma.emulatorConfig.create({
          data: {
            id: p.id,
            platformName: p.name,
            executablePath: '',
            defaultArgs: '',
            isEnabled: true,
          },
        });
      }
    }
  }

  /**
   * Launches a game locally using the configured emulator.
   */
  public async launchGame(libraryItemId: string): Promise<{ success: boolean; message: string }> {
    const item = await prisma.libraryItem.findUnique({ where: { id: libraryItemId } });
    if (!item) {
      throw new Error('Library item not found');
    }

    // 1. Get emulator config for this platform
    const emuConfig = await prisma.emulatorConfig.findUnique({ where: { id: item.platform } });
    if (!emuConfig || !emuConfig.executablePath || !emuConfig.isEnabled) {
      throw new Error(`No emulator executable configured for platform "${item.platform}". Please configure it in Settings -> Emulator Integration.`);
    }

    // Verify emulator executable exists
    try {
      await fs.access(emuConfig.executablePath);
    } catch {
      throw new Error(`Configured emulator executable not found at "${emuConfig.executablePath}". Verify path in Settings.`);
    }

    // 2. Resolve local file path
    let gameFilePath = item.localPath;

    // If localPath is not set, attempt to resolve via Google Drive for Desktop root
    if (!gameFilePath) {
      const gdriveSetting = await prisma.appSetting.findUnique({ where: { id: 'GDRIVE_DESKTOP_PATH' } });
      if (!gdriveSetting || !gdriveSetting.value) {
        throw new Error(
          'Google Drive for Desktop mirror path is not configured. Please specify your local Drive path in Settings (e.g. ~/Google Drive/My Drive).'
        );
      }

      if (item.drivePath) {
        gameFilePath = path.join(gdriveSetting.value, item.drivePath);
      } else {
        throw new Error('This item does not have a local path or drivePath recorded.');
      }
    }

    // Check if game file is available locally
    try {
      const stat = await fs.stat(gameFilePath);
      // Drive for Desktop placeholder files on macOS / Windows may appear as 0 bytes if cloud-only
      if (stat.size === 0) {
        return {
          success: false,
          message: `The file "${path.basename(gameFilePath)}" is currently cloud-only in Google Drive for Desktop. Please right-click it in Finder/Explorer and select "Available offline", then try launching again.`,
        };
      }
    } catch {
      throw new Error(
        `File not found locally at "${gameFilePath}". Verify that Google Drive for Desktop is running and syncing the library folder.`
      );
    }

    // 3. Launch emulator with shell: false for security
    const args: string[] = [];
    if (emuConfig.defaultArgs) {
      args.push(...emuConfig.defaultArgs.split(' ').filter(Boolean));
    }
    args.push(gameFilePath);

    try {
      const child = spawn(emuConfig.executablePath, args, {
        detached: true,
        stdio: 'ignore',
        shell: false,
      });

      child.unref();

      return {
        success: true,
        message: `Launched ${item.title} with ${path.basename(emuConfig.executablePath)}.`,
      };
    } catch (err: any) {
      throw new Error(`Failed to execute emulator: ${err.message}`);
    }
  }
}
