import React, { useState } from 'react';
import {
  Activity,
  CheckCircle,
  HardDrive,
  Cpu,
  ArrowRight,
  Plus,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Transfer, GoogleAuthStatus, DriveQuota } from '../types/index.js';
import { TransferCard } from '../components/TransferCard.js';
import { formatBytes } from '../lib/formatters.js';
import { api } from '../lib/api.js';

interface DashboardPageProps {
  transfers: Transfer[];
  authStatus: GoogleAuthStatus | null;
  quota: DriveQuota | null;
  onRefresh: () => void;
  onNavigate: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  transfers,
  authStatus,
  quota,
  onRefresh,
  onNavigate,
}) => {
  const [quickUrl, setQuickUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeTransfers = transfers.filter((t) =>
    ['QUEUED', 'CONNECTING', 'STREAMING'].includes(t.status)
  );
  const completedTransfers = transfers.filter((t) => t.status === 'COMPLETED');
  const failedTransfers = transfers.filter((t) => t.status === 'FAILED');

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;

    if (!authStatus?.isConnected) {
      setErrorMsg('Please connect your Google Drive account before starting a transfer.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await api.createTransfer({ url: quickUrl.trim() });
      setQuickUrl('');
      onRefresh();
      onNavigate('active');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Google Disconnected Banner */}
      {!authStatus?.isConnected && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-amber-200">
                Google Drive Connection Required
              </h4>
              <p className="text-xs text-amber-300/80">
                Connect your Google account in Settings to enable direct-to-Drive stream transfers.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-xs transition"
          >
            Configure Google Drive
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Streams */}
        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Streams</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100">
            {activeTransfers.length}
          </div>
          <div className="text-xs text-zinc-500 font-mono mt-1">
            Zero-disk direct pipe
          </div>
        </div>

        {/* Completed Transfers */}
        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100">
            {completedTransfers.length}
          </div>
          <div className="text-xs text-zinc-500 font-mono mt-1">
            Saved in personal Drive
          </div>
        </div>

        {/* Drive Storage Quota */}
        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Drive Quota</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-mono font-semibold text-zinc-100">
            {quota?.usage ? formatBytes(quota.usage) : '—'}
          </div>
          <div className="text-xs text-zinc-500 font-mono mt-1">
            of {quota?.limit ? formatBytes(quota.limit) : 'Google quota'}
          </div>
        </div>

        {/* Engine Security & RSS */}
        <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Engine Defense</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-semibold text-emerald-400">
            SSRF Guard
          </div>
          <div className="text-xs text-zinc-500 font-mono mt-1">
            Private IP block active
          </div>
        </div>
      </div>

      {/* Quick Transfer Ingestion Form */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">
          Quick Transfer to Google Drive
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Enter any direct HTTP/HTTPS URL. Streams directly into Google Drive via resumable upload.
        </p>

        <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            required
            placeholder="https://speed.hetzner.de/100MB.bin or direct download URL..."
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 transition font-mono"
          />
          <button
            type="submit"
            disabled={isSubmitting || !quickUrl.trim()}
            className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Validating & Connecting...</span>
            ) : (
              <>
                <span>Stream to Drive</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-center gap-2.5 text-xs text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Active Streams Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">Active Streams</h3>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-zinc-800 text-zinc-300">
              {activeTransfers.length}
            </span>
          </div>
          {activeTransfers.length > 0 && (
            <button
              onClick={() => onNavigate('active')}
              className="text-xs text-sky-400 hover:text-sky-300 font-medium transition"
            >
              View detailed stream meters →
            </button>
          )}
        </div>

        {activeTransfers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 text-xs text-zinc-500 font-mono">
            No active transfers running. Paste a direct URL above to begin streaming.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activeTransfers.map((t) => (
              <TransferCard key={t.id} transfer={t} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>

      {/* Recent History Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Recent Completed</h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium transition"
          >
            View all history →
          </button>
        </div>

        {completedTransfers.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 text-xs text-zinc-500 font-mono">
            No completed transfers yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {completedTransfers.slice(0, 3).map((t) => (
              <TransferCard key={t.id} transfer={t} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
