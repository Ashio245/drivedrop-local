import React, { useState, useEffect } from 'react';
import {
  Folder,
  File,
  Search,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronRight,
  HardDrive,
  RefreshCw,
  FolderPlus,
  Gamepad2,
} from 'lucide-react';
import { DriveFile, GoogleAuthStatus, DriveQuota } from '../types/index.js';
import { formatBytes, formatDate } from '../lib/formatters.js';
import { Modal } from '../components/Modal.js';
import { EmptyState } from '../components/EmptyState.js';
import { api } from '../lib/api.js';

interface DriveBrowserPageProps {
  authStatus: GoogleAuthStatus | null;
  quota: DriveQuota | null;
  onNavigate: (tab: any) => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export const DriveBrowserPage: React.FC<DriveBrowserPageProps> = ({
  authStatus,
  quota,
  onNavigate,
}) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: '', name: 'My Drive' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [newFolderName, setNewFolderName] = useState('');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<DriveFile | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Classify into emulator library modal
  const [classifyingFile, setClassifyingFile] = useState<DriveFile | null>(null);
  const [libraryTitle, setLibraryTitle] = useState('');
  const [libraryPlatform, setLibraryPlatform] = useState('snes');

  useEffect(() => {
    if (authStatus?.isConnected) {
      loadFiles();
    }
  }, [currentFolderId, authStatus?.isConnected]);

  const loadFiles = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.listDriveFiles({
        folderId: currentFolderId || undefined,
        q: searchQuery.trim() || undefined,
      });
      setFiles(res.files || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.createDriveFolder({
        name: newFolderName.trim(),
        parentId: currentFolderId || undefined,
      });
      setNewFolderName('');
      setIsFolderModalOpen(false);
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile || !renameValue.trim()) return;
    try {
      await api.renameDriveFile(editingFile.id, renameValue.trim());
      setEditingFile(null);
      loadFiles();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (file: DriveFile) => {
    if (confirm(`Move "${file.name}" to Google Drive trash?`)) {
      try {
        await api.deleteDriveFile(file.id);
        loadFiles();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleClassifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifyingFile || !libraryTitle.trim()) return;
    try {
      await api.createLibraryItem({
        title: libraryTitle.trim(),
        platform: libraryPlatform,
        driveFileId: classifyingFile.id,
        drivePath: classifyingFile.name,
      });
      setClassifyingFile(null);
      alert(`Classified "${libraryTitle}" into Emulator Library!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!authStatus?.isConnected) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          icon={HardDrive}
          title="Google Drive Not Connected"
          description="Connect your Google Account with Drive permissions in Settings to browse, search, and manage your cloud files."
          actionText="Go to Settings"
          onAction={() => onNavigate('settings')}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 mb-1">Google Drive Browser</h2>
          <p className="text-xs text-zinc-400">
            Direct Drive v3 explorer. Browse, search, organize, and classify transferred files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadFiles}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Refresh folder"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {/* Breadcrumbs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-mono text-zinc-400">
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.id || 'root'}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`px-1.5 py-0.5 rounded-md hover:bg-zinc-800 transition truncate max-w-xs ${
                  idx === breadcrumbs.length - 1
                    ? 'text-zinc-100 font-semibold bg-zinc-800/60'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadFiles();
          }}
          className="relative"
        >
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2" />
          <input
            type="text"
            placeholder="Search Drive files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-3 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 font-mono"
          />
        </form>
      </div>

      {/* File List Table */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center text-zinc-500 text-xs font-mono">
            Querying Google Drive API...
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-xs text-rose-400 font-mono">
            Error: {errorMsg}
          </div>
        ) : files.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs font-mono">
            This folder is empty.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {files.map((file) => {
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 hover:bg-zinc-850/60 transition group text-xs"
                >
                  <div
                    onClick={() => isFolder && navigateToFolder(file.id, file.name)}
                    className={`flex items-center gap-3 min-w-0 flex-1 ${
                      isFolder ? 'cursor-pointer' : ''
                    }`}
                  >
                    {isFolder ? (
                      <Folder className="w-5 h-5 text-sky-400 shrink-0" />
                    ) : (
                      <File className="w-5 h-5 text-zinc-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-200 truncate group-hover:text-sky-300 transition">
                        {file.name}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono truncate">
                        {file.mimeType}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 font-mono text-zinc-400 ml-4">
                    <span className="w-24 text-right">
                      {isFolder ? '—' : formatBytes(file.size)}
                    </span>
                    <span className="w-36 text-right hidden md:inline">
                      {formatDate(file.modifiedTime)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition">
                      {!isFolder && (
                        <button
                          onClick={() => {
                            setClassifyingFile(file);
                            setLibraryTitle(file.name.replace(/\.[^/.]+$/, ''));
                          }}
                          title="Classify as Legal Backup in Emulator Library"
                          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition"
                        >
                          <Gamepad2 className="w-4 h-4" />
                        </button>
                      )}

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in Google Drive"
                          className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 transition"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setEditingFile(file);
                          setRenameValue(file.name);
                        }}
                        title="Rename"
                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(file)}
                        title="Move to Trash"
                        className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      <Modal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        title="Create New Folder in Google Drive"
        maxWidth="md"
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Folder Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Backups, Games, Datasets"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFolderModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition"
            >
              Create Folder
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={Boolean(editingFile)}
        onClose={() => setEditingFile(null)}
        title="Rename Item in Google Drive"
        maxWidth="md"
      >
        <form onSubmit={handleRename} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              New Name
            </label>
            <input
              type="text"
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 font-mono"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditingFile(null)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-500 text-xs font-semibold text-zinc-950 hover:bg-sky-400 transition"
            >
              Rename
            </button>
          </div>
        </form>
      </Modal>

      {/* Classify into Library Modal */}
      <Modal
        isOpen={Boolean(classifyingFile)}
        onClose={() => setClassifyingFile(null)}
        title="Classify Legal Game / Backup in Emulator Library"
        maxWidth="lg"
      >
        <form onSubmit={handleClassifySubmit} className="space-y-4">
          <p className="text-xs text-zinc-400">
            Classify this file to organize and launch it via Google Drive for Desktop using your local emulator.
          </p>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Game / Backup Title
            </label>
            <input
              type="text"
              required
              value={libraryTitle}
              onChange={(e) => setLibraryTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Platform
            </label>
            <select
              value={libraryPlatform}
              onChange={(e) => setLibraryPlatform(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 focus:outline-hidden focus:border-sky-500"
            >
              <option value="nes">Nintendo Entertainment System (NES)</option>
              <option value="snes">Super Nintendo (SNES)</option>
              <option value="n64">Nintendo 64</option>
              <option value="gba">Game Boy Advance</option>
              <option value="nds">Nintendo DS</option>
              <option value="3ds">Nintendo 3DS</option>
              <option value="gamecube">Nintendo GameCube</option>
              <option value="wii">Nintendo Wii</option>
              <option value="switch">Nintendo Switch</option>
              <option value="ps1">Sony PlayStation 1</option>
              <option value="ps2">Sony PlayStation 2</option>
              <option value="psp">Sony PlayStation Portable</option>
              <option value="genesis">Sega Genesis / Mega Drive</option>
              <option value="dreamcast">Sega Dreamcast</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setClassifyingFile(null)}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 transition"
            >
              Add to Library
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
