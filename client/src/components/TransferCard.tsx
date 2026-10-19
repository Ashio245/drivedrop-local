import React, { useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  XCircle,
  Trash2,
  FileText,
  ExternalLink,
  AlertTriangle,
  Folder,
} from 'lucide-react';
import { Transfer } from '../types/index.js';
import { formatBytes, formatSpeed, formatEta, formatDate } from '../lib/formatters.js';
import { StatusBadge } from './StatusBadge.js';
import { ProgressBar } from './ProgressBar.js';
import { Modal } from './Modal.js';
import { api } from '../lib/api.js';

interface TransferCardProps {
  transfer: Transfer;
  onRefresh: () => void;
}

export const TransferCard: React.FC<TransferCardProps> = ({ transfer, onRefresh }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isActive = ['QUEUED', 'CONNECTING', 'STREAMING'].includes(transfer.status);
  const isPaused = transfer.status === 'PAUSED';
  const isFailed = transfer.status === 'FAILED';
  const isCompleted = transfer.status === 'COMPLETED';

  // Calculate percentage
  let percentage: number | null = null;
  if (transfer.totalBytes) {
    const total = BigInt(transfer.totalBytes);
    const transferred = BigInt(transfer.transferredBytes);
    if (total > 0n) {
      percentage = Math.min(100, Number((transferred * 10000n) / total) / 100);
    }
  }

  const handleAction = async (action: () => Promise<any>) => {
    setActionLoading(true);
    try {
      await action();
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openLogs = async () => {
    setShowLogs(true);
    setIsLoadingLogs(true);
    try {
      const data = await api.getTransfer(transfer.id);
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/80 transition shadow-xs">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className="font-medium text-zinc-100 truncate text-base"
              title={transfer.filename}
            >
              {transfer.filename}
            </h4>
            <StatusBadge status={transfer.status} size="sm" />
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
            <span>{transfer.mimeType || 'unknown mime'}</span>
            <span>•</span>
            <span className="truncate max-w-xs" title={transfer.sourceUrl}>
              {transfer.sourceUrl}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isActive && (
            <button
              onClick={() => handleAction(() => api.pauseTransfer(transfer.id))}
              disabled={actionLoading}
              title="Pause Transfer"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={() => handleAction(() => api.resumeTransfer(transfer.id))}
              disabled={actionLoading}
              title="Resume Transfer"
              className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 hover:bg-emerald-900 text-emerald-300 transition"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {(isActive || isPaused) && (
            <button
              onClick={() => handleAction(() => api.cancelTransfer(transfer.id))}
              disabled={actionLoading}
              title="Cancel Transfer"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-400 transition"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {(isFailed || transfer.status === 'CANCELLED') && (
            <button
              onClick={() => handleAction(() => api.retryTransfer(transfer.id))}
              disabled={actionLoading}
              title="Retry Transfer"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={openLogs}
            title="View Technical Logs"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (confirm('Delete this transfer entry?')) {
                handleAction(() => api.deleteTransfer(transfer.id));
              }
            }}
            disabled={actionLoading}
            title="Delete Record"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-950 hover:text-rose-400 text-zinc-500 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <ProgressBar status={transfer.status} percentage={percentage} />
      </div>

      {/* Real-time Telemetry Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs font-mono text-zinc-400">
        <div>
          <span className="text-zinc-200 font-medium">
            {formatBytes(transfer.transferredBytes)}
          </span>
          <span className="mx-1 text-zinc-500">/</span>
          <span>{formatBytes(transfer.totalBytes)}</span>
          {percentage !== null && (
            <span className="ml-2 text-zinc-300">({percentage}%)</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isActive && (
            <>
              <div>
                <span className="text-zinc-500 mr-1.5">Speed:</span>
                <span className="text-emerald-400 font-medium">
                  {formatSpeed(transfer.speedBps)}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 mr-1.5">ETA:</span>
                <span className="text-zinc-300">{formatEta(transfer.etaSeconds)}</span>
              </div>
            </>
          )}

          {isCompleted && (
            <div className="text-emerald-400 flex items-center gap-1.5">
              <span>Saved in Drive</span>
              {transfer.driveFileId && (
                <a
                  href={`https://drive.google.com/file/d/${transfer.driveFileId}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline inline-flex items-center gap-0.5 text-sky-400"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <div className="text-zinc-500">{formatDate(transfer.createdAt)}</div>
        </div>
      </div>

      {/* Error message callout if failed */}
      {transfer.errorMessage && (
        <div className="mt-3 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1 break-all">
            <span className="font-semibold">Error:</span> {transfer.errorMessage}
          </div>
        </div>
      )}

      {/* Logs Modal */}
      <Modal
        isOpen={showLogs}
        onClose={() => setShowLogs(false)}
        title={`Transfer Logs: ${transfer.filename}`}
        maxWidth="2xl"
      >
        <div className="space-y-2">
          {isLoadingLogs ? (
            <div className="text-center py-8 text-zinc-500 text-sm font-mono">
              Loading stream logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm font-mono">
              No log entries recorded for this job.
            </div>
          ) : (
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start gap-2">
                  <span className="text-zinc-500 shrink-0">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      l.level === 'ERROR'
                        ? 'text-rose-400'
                        : l.level === 'WARN'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    [{l.level}]
                  </span>
                  <span className="text-zinc-300 break-all">{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
