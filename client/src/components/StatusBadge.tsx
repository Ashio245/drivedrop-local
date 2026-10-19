import React from 'react';
import { TransferStatus } from '../types/index.js';

interface StatusBadgeProps {
  status: TransferStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs: Record<TransferStatus, { label: string; bg: string; text: string; dot: string; pulse?: boolean }> = {
    QUEUED: {
      label: 'Queued',
      bg: 'bg-zinc-800/80 border-zinc-700',
      text: 'text-zinc-400',
      dot: 'bg-zinc-500',
    },
    CONNECTING: {
      label: 'Connecting',
      bg: 'bg-sky-950/60 border-sky-800/60',
      text: 'text-sky-300',
      dot: 'bg-sky-400',
      pulse: true,
    },
    STREAMING: {
      label: 'Streaming',
      bg: 'bg-emerald-950/60 border-emerald-800/60',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      pulse: true,
    },
    PAUSED: {
      label: 'Paused',
      bg: 'bg-amber-950/60 border-amber-800/60',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
    },
    COMPLETED: {
      label: 'Completed',
      bg: 'bg-emerald-950/40 border-emerald-900/60',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
    },
    FAILED: {
      label: 'Failed',
      bg: 'bg-rose-950/60 border-rose-800/60',
      text: 'text-rose-300',
      dot: 'bg-rose-400',
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-zinc-900 border-zinc-800',
      text: 'text-zinc-500',
      dot: 'bg-zinc-600',
    },
  };

  const c = configs[status] || configs.QUEUED;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-mono font-medium rounded-full ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
};
