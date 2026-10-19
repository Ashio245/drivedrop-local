import React, { useState, useEffect } from 'react';
import {
  CloudUpload,
  Folder,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { GoogleAuthStatus, DriveFile } from '../types/index.js';
import { api } from '../lib/api.js';

interface NewTransferPageProps {
  authStatus: GoogleAuthStatus | null;
  onTransferCreated: () => void;
  onNavigate: (tab: any) => void;
}

export const NewTransferPage: React.FC<NewTransferPageProps> = ({
  authStatus,
  onTransferCreated,
  onNavigate,
}) => {
  const [url, setUrl] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  // Advanced headers
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headersText, setHeadersText] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus?.isConnected) {
      loadFolders();
    }
  }, [authStatus?.isConnected]);

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const res = await api.listDriveFiles({ onlyFolders: true, pageSize: 50 });
      setFolders(res.files || []);
    } catch {
      // Ignore folder load failures
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!authStatus?.isConnected) {
      setErrorMsg('Google Drive is not connected. Please connect your account in Settings.');
      return;
    }

    // Parse custom headers if provided
    let customHeaders: Record<string, string> | undefined;
    if (headersText.trim()) {
      try {
        customHeaders = JSON.parse(headersText);
      } catch {
        setErrorMsg('Custom headers must be a valid JSON object, e.g. {"Authorization": "Bearer ..."}');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.createTransfer({
        url: url.trim(),
        customFilename: customFilename.trim() || undefined,
        folderId: folderId || undefined,
        customHeaders,
      });

      onTransferCreated();
      onNavigate('active');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Intro Header */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          Initiate Direct-to-Drive Transfer
        </h2>
        <p className="text-sm text-zinc-400">
          Stream files of any technical size straight from remote web servers into your personal Google Drive without intermediary disk buffering.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Direct Download URL <span className="text-rose-400">*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://example.com/downloads/big_file.iso"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 transition font-mono"
          />
          <p className="text-xs text-zinc-500">
            Must be a public direct HTTP or HTTPS link, or a link accompanied by valid authentication headers.
          </p>
        </div>

        {/* Custom Filename & Target Folder Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Custom Filename (Optional)
            </label>
            <input
              type="text"
              placeholder="Auto-inferred from Content-Disposition"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 transition font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Target Google Drive Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              disabled={isSubmitting || isLoadingFolders}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 focus:outline-hidden focus:border-sky-500 transition"
            >
              <option value="">Root (My Drive)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Headers Collapsible */}
        <div className="border border-zinc-800/80 rounded-xl bg-zinc-900/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition"
          >
            <span>Advanced: Custom HTTP Headers & Cookies</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-5 border-t border-zinc-800/80 space-y-3">
              <p className="text-xs text-zinc-400">
                If the remote source requires authentication or session tokens, provide them as a JSON dictionary:
              </p>
              <textarea
                rows={4}
                placeholder='{\n  "Authorization": "Bearer token_here",\n  "Cookie": "session_id=abc123xyz"\n}'
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-sky-500"
              />
            </div>
          )}
        </div>

        {/* Error Callout */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/50 border border-rose-900/80 rounded-xl flex items-start gap-3 text-xs text-rose-300">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">Transfer Ingestion Rejected</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div>
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Validating URL & Starting Resumable Session...</span>
            ) : (
              <>
                <CloudUpload className="w-5 h-5" />
                <span>Start Direct Transfer to Google Drive</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Technical Guardrails & Guarantees Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-zinc-800/80 text-xs">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-zinc-200">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Strict SSRF & Private Network Protection</span>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            All URLs and redirect targets are resolved and verified against private subnets (RFC1918), loopback, link-local, and cloud metadata (169.254.169.254) before establishing any connection.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-zinc-200">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Zero Local Disk Storage</span>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            Data is streamed directly from the remote socket to Google Drive resumable upload chunks. Files of 100 GB+ consume under 32 MB RAM and 0 bytes permanent local disk.
          </p>
        </div>
      </div>
    </div>
  );
};
