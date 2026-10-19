import React, { useState, useEffect } from 'react';
import {
  Key,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Save,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { GoogleAuthStatus, PlatformConfig } from '../types/index.js';
import { api } from '../lib/api.js';

interface SettingsPageProps {
  authStatus: GoogleAuthStatus | null;
  onRefreshAuth: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  authStatus,
  onRefreshAuth,
}) => {
  // OAuth credentials
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('http://127.0.0.1:3001/api/auth/callback');
  const [isSavingOAuth, setIsSavingOAuth] = useState(false);
  const [oAuthSuccessMsg, setOAuthSuccessMsg] = useState<string | null>(null);

  // App settings
  const [gdriveDesktopPath, setGdriveDesktopPath] = useState('');
  const [chunkSizeMb, setChunkSizeMb] = useState('8');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalSuccessMsg, setGeneralSuccessMsg] = useState<string | null>(null);

  // Platform emulator configs
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [isSavingPlatforms, setIsSavingPlatforms] = useState(false);

  // Copy indicator
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settings, platformsRes] = await Promise.all([
        api.getSettings(),
        api.listPlatforms(),
      ]);

      if (settings.GDRIVE_DESKTOP_PATH) setGdriveDesktopPath(settings.GDRIVE_DESKTOP_PATH);
      if (settings.CHUNK_SIZE_MB) setChunkSizeMb(settings.CHUNK_SIZE_MB);
      setPlatforms(platformsRes.platforms || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveOAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOAuth(true);
    setOAuthSuccessMsg(null);
    try {
      await api.saveOAuthConfig({ clientId, clientSecret, redirectUri });
      setOAuthSuccessMsg('Google Cloud OAuth credentials saved securely in SQLite.');
      onRefreshAuth();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingOAuth(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const { url } = await api.getLoginUrl();
      window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Revoke Google OAuth token and disconnect your account?')) {
      try {
        await api.disconnectGoogle();
        onRefreshAuth();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setGeneralSuccessMsg(null);
    try {
      await api.updateSettings({
        GDRIVE_DESKTOP_PATH: gdriveDesktopPath.trim(),
        CHUNK_SIZE_MB: chunkSizeMb,
      });
      setGeneralSuccessMsg('Preferences saved successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleUpdatePlatform = async (id: string, execPath: string, args: string) => {
    try {
      await api.updatePlatformConfig(id, {
        executablePath: execPath.trim(),
        defaultArgs: args.trim(),
      });
      setPlatforms(
        platforms.map((p) =>
          p.id === id ? { ...p, executablePath: execPath, defaultArgs: args } : p
        )
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">Settings & Integrations</h2>
        <p className="text-xs text-zinc-400">
          Manage local Google OAuth keys, Google Drive for Desktop paths, and emulator executables.
        </p>
      </div>

      {/* 1. Google OAuth Credentials & Connection */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Google Cloud OAuth 2.0 Credentials
              </h3>
              <p className="text-xs text-zinc-400">
                Encrypted with AES-256-GCM and stored solely on your machine.
              </p>
            </div>
          </div>

          {authStatus?.isConnected ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Linked to {authStatus.user?.email}
              </span>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-xs text-zinc-300 transition"
              >
                Disconnect & Revoke
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition"
            >
              Sign in with Google
            </button>
          )}
        </div>

        {/* Setup Guide */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 space-y-2">
          <div className="font-semibold text-zinc-200">
            How to configure Google Cloud OAuth (Free tier):
          </div>
          <ol className="list-decimal list-inside space-y-1 leading-relaxed">
            <li>
              Go to{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 underline inline-flex items-center gap-0.5"
              >
                Google Cloud Console <ExternalLink className="w-3 h-3" />
              </a>{' '}
              and create a project.
            </li>
            <li>Enable the <strong>Google Drive API</strong>.</li>
            <li>Configure OAuth Consent Screen as <strong>External</strong> and add your own email as a test user.</li>
            <li>
              Create credentials of type <strong>OAuth client ID</strong> (Web application) and add the Redirect URI below.
            </li>
          </ol>
        </div>

        {/* Redirect URI copy box */}
        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Authorized Redirect URI
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={redirectUri}
              className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-300 select-all"
            />
            <button
              onClick={copyRedirectUri}
              className="px-3.5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* OAuth Form */}
        <form onSubmit={handleSaveOAuth} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Client ID
              </label>
              <input
                type="text"
                placeholder="xxxx.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 font-mono focus:outline-hidden focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Client Secret
              </label>
              <input
                type="password"
                placeholder="GOCSPX-xxxxxxxxxxxx"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 font-mono focus:outline-hidden focus:border-sky-500"
              />
            </div>
          </div>

          {oAuthSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300">
              {oAuthSuccessMsg}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSavingOAuth || !clientId.trim() || !clientSecret.trim()}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition disabled:opacity-50"
            >
              {isSavingOAuth ? 'Saving...' : 'Save OAuth Credentials'}
            </button>
          </div>
        </form>
      </section>

      {/* 2. Google Drive for Desktop Mirror & General */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
          <HardDrive className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Google Drive for Desktop Mirror Directory
            </h3>
            <p className="text-xs text-zinc-400">
              Configure your local desktop sync path to enable offline verification and emulator launching.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Local Drive Root Path
            </label>
            <input
              type="text"
              placeholder="/Volumes/GoogleDrive/My Drive or ~/Google Drive/My Drive"
              value={gdriveDesktopPath}
              onChange={(e) => setGdriveDesktopPath(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Used to resolve relative paths for legal game backups when triggering local emulator binaries.
            </p>
          </div>

          <div className="w-48">
            <label className="block font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Stream Chunk Window Size (MB)
            </label>
            <select
              value={chunkSizeMb}
              onChange={(e) => setChunkSizeMb(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-hidden focus:border-sky-500 font-mono"
            >
              <option value="4">4 MB (Low memory)</option>
              <option value="8">8 MB (Default, recommended)</option>
              <option value="16">16 MB (High throughput)</option>
              <option value="32">32 MB (Gigabit network)</option>
            </select>
          </div>

          {generalSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300">
              {generalSuccessMsg}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingGeneral}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition shadow-xs"
            >
              Save Preferences
            </button>
          </div>
        </form>
      </section>

      {/* 3. Local Emulator Executables Integration */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4">
          <Gamepad2 className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Local Emulator Executable Paths
            </h3>
            <p className="text-xs text-zinc-400">
              Specify the local absolute path to your verified emulator binaries.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {platforms.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">{p.name}</span>
                <span className="text-[11px] font-mono text-zinc-500">
                  {p.fileExtensions.join(', ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder={`e.g. /usr/local/bin/${p.defaultExecutable}`}
                    value={p.executablePath}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlatforms(
                        platforms.map((item) =>
                          item.id === p.id ? { ...item, executablePath: val } : item
                        )
                      );
                    }}
                    onBlur={(e) =>
                      handleUpdatePlatform(p.id, e.target.value, p.defaultArgs)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="CLI flags (e.g. -f)"
                    value={p.defaultArgs}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlatforms(
                        platforms.map((item) =>
                          item.id === p.id ? { ...item, defaultArgs: val } : item
                        )
                      );
                    }}
                    onBlur={(e) =>
                      handleUpdatePlatform(p.id, p.executablePath, e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
