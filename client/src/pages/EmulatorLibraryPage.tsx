import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Play,
  Plus,
  Trash2,
  Edit2,
  Filter,
  Search,
  ExternalLink,
  ShieldAlert,
  FolderOpen,
} from 'lucide-react';
import { LibraryItem, PlatformConfig } from '../types/index.js';
import { Modal } from '../components/Modal.js';
import { EmptyState } from '../components/EmptyState.js';
import { api } from '../lib/api.js';

interface EmulatorLibraryPageProps {
  onNavigate: (tab: any) => void;
}

export const EmulatorLibraryPage: React.FC<EmulatorLibraryPageProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formPlatform, setFormPlatform] = useState('snes');
  const [formRegion, setFormRegion] = useState('USA');
  const [formVersion, setFormVersion] = useState('v1.0');
  const [formFileType, setFormFileType] = useState('');
  const [formDrivePath, setFormDrivePath] = useState('');
  const [formLocalPath, setFormLocalPath] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Launch state
  const [launchMessage, setLaunchMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedPlatform, search]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, platformsRes] = await Promise.all([
        api.listLibraryItems({
          platform: selectedPlatform !== 'ALL' ? selectedPlatform : undefined,
          search: search.trim() || undefined,
        }),
        api.listPlatforms(),
      ]);
      setItems(itemsRes.items || []);
      setPlatforms(platformsRes.platforms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunch = async (item: LibraryItem) => {
    setLaunchMessage({ text: `Launching ${item.title}...` });
    try {
      const res = await api.launchGame(item.id);
      if (res.success) {
        setLaunchMessage({ text: res.message });
      } else {
        setLaunchMessage({ text: res.message, isError: true });
      }
    } catch (err: any) {
      setLaunchMessage({ text: err.message, isError: true });
    }
  };

  const handleDelete = async (item: LibraryItem) => {
    if (confirm(`Remove "${item.title}" from library index? (File in Google Drive remains untouched)`)) {
      try {
        await api.deleteLibraryItem(item.id);
        loadData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      if (editingItem) {
        await api.updateLibraryItem(editingItem.id, {
          title: formTitle.trim(),
          platform: formPlatform,
          region: formRegion.trim() || null,
          version: formVersion.trim() || null,
          fileType: formFileType.trim() || null,
          drivePath: formDrivePath.trim() || null,
          localPath: formLocalPath.trim() || null,
          tags: formTags.trim() || null,
          notes: formNotes.trim() || null,
        });
      } else {
        await api.createLibraryItem({
          title: formTitle.trim(),
          platform: formPlatform,
          region: formRegion.trim() || null,
          version: formVersion.trim() || null,
          fileType: formFileType.trim() || null,
          drivePath: formDrivePath.trim() || null,
          localPath: formLocalPath.trim() || null,
          tags: formTags.trim() || null,
          notes: formNotes.trim() || null,
        });
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (item: LibraryItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormPlatform(item.platform);
    setFormRegion(item.region || '');
    setFormVersion(item.version || '');
    setFormFileType(item.fileType || '');
    setFormDrivePath(item.drivePath || '');
    setFormLocalPath(item.localPath || '');
    setFormTags(item.tags || '');
    setFormNotes(item.notes || '');
  };

  const resetForm = () => {
    setFormTitle('');
    setFormPlatform('snes');
    setFormRegion('USA');
    setFormVersion('v1.0');
    setFormFileType('');
    setFormDrivePath('');
    setFormLocalPath('');
    setFormTags('');
    setFormNotes('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Legal & Anti-Piracy Notice Banner */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 space-y-1">
          <div className="font-semibold text-zinc-100">
            Legal Compliance & Preservation Notice
          </div>
          <p className="text-zinc-400 leading-relaxed">
            DriveDrop Local is designed solely for organizing and launching legal backups, homebrew software, and public domain works stored in your personal Google Drive. This software does NOT distribute ROMs, BIOS files, firmware, or decryption keys.
          </p>
        </div>
      </div>

      {/* Launch Feedback Banner */}
      {launchMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            launchMessage.isError
              ? 'bg-rose-950/60 border-rose-800 text-rose-200'
              : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
          }`}
        >
          <span>{launchMessage.text}</span>
          <button
            onClick={() => setLaunchMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 ml-4 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 mb-1">Emulator Library</h2>
          <p className="text-xs text-zinc-400">
            Organize legal backups and launch them via Google Drive for Desktop mirror directory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 text-xs transition"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Configure Emulators</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedPlatform('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition shrink-0 ${
              selectedPlatform === 'ALL'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            ALL
          </button>
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlatform(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition shrink-0 ${
                selectedPlatform === p.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p.id.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search titles, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Library Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-zinc-500 text-xs font-mono">
          Loading emulator library...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Gamepad2}
          title="Library is Empty"
          description="Classify files from the Drive Browser or add an entry manually to organize your legal preservation collection."
          actionText="Add New Entry"
          onAction={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const platformConfig = platforms.find((p) => p.id === item.platform);

            return (
              <div
                key={item.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-mono font-semibold text-sky-300 uppercase tracking-wide">
                      {item.platform}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition"
                        title="Edit Entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                        title="Remove Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-100 line-clamp-1 mb-1">
                    {item.title}
                  </h3>

                  <div className="text-xs text-zinc-400 font-mono space-y-1 mb-4">
                    {item.region && <div>Region: {item.region}</div>}
                    {item.version && <div>Version: {item.version}</div>}
                    {item.drivePath && (
                      <div className="truncate text-[11px] text-zinc-500" title={item.drivePath}>
                        Path: {item.drivePath}
                      </div>
                    )}
                    {item.tags && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.split(',').map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-[10px] text-zinc-400"
                          >
                            #{t.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {platformConfig?.executablePath ? 'Configured' : 'Emulator unconfigured'}
                  </div>

                  <button
                    onClick={() => handleLaunch(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Entry Modal */}
      <Modal
        isOpen={isAddModalOpen || Boolean(editingItem)}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Library Entry' : 'Add Legal Backup to Library'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Super Mario World"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Platform
              </label>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-hidden focus:border-sky-500"
              >
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Region
              </label>
              <input
                type="text"
                placeholder="e.g. USA, EUR, JPN"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Version / Revision
              </label>
              <input
                type="text"
                placeholder="e.g. v1.0, Rev 1"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. platformer, 16-bit, favorite"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Drive Mirror Path (Relative to Google Drive for Desktop root)
            </label>
            <input
              type="text"
              placeholder="e.g. Backups/SNES/smw.sfc"
              value={formDrivePath}
              onChange={(e) => setFormDrivePath(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition"
            >
              {editingItem ? 'Save Changes' : 'Add to Library'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
