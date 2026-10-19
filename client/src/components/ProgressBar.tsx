import React from 'react';
import { TransferStatus } from '../types/index.js';

interface ProgressBarProps {
  status: TransferStatus;
  percentage?: number | null;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  status,
  percentage,
  className = '',
}) => {
  const isFailed = status === 'FAILED';
  const isPaused = status === 'PAUSED';
  const isCompleted = status === 'COMPLETED';
  const isIndeterminate = percentage === null || percentage === undefined;

  let barColor = 'bg-emerald-500';
  if (isFailed) barColor = 'bg-rose-500';
  else if (isPaused) barColor = 'bg-amber-500';
  else if (status === 'CONNECTING') barColor = 'bg-sky-500';

  return (
    <div className={`w-full bg-zinc-900 border border-zinc-800 rounded-full h-2 overflow-hidden relative ${className}`}>
      {isIndeterminate && (status === 'STREAMING' || status === 'CONNECTING') ? (
        <div
          className={`h-full ${barColor} rounded-full animate-[pulse_1.5s_ease-in-out_infinite] w-1/2 mx-auto`}
        />
      ) : (
        <div
          className={`h-full ${barColor} transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${Math.min(100, Math.max(0, percentage ?? 0))}%` }}
        />
      )}
    </div>
  );
};
