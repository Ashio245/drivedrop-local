import React from 'react';
import { Activity, Plus, RefreshCw } from 'lucide-react';
import { Transfer } from '../types/index.js';
import { TransferCard } from '../components/TransferCard.js';
import { EmptyState } from '../components/EmptyState.js';

interface ActiveTransfersPageProps {
  transfers: Transfer[];
  onRefresh: () => void;
  onNavigate: (tab: any) => void;
}

export const ActiveTransfersPage: React.FC<ActiveTransfersPageProps> = ({
  transfers,
  onRefresh,
  onNavigate,
}) => {
  const activeList = transfers.filter((t) =>
    ['QUEUED', 'CONNECTING', 'STREAMING', 'PAUSED'].includes(t.status)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 mb-1">
            Active Stream Monitor
          </h2>
          <p className="text-xs text-zinc-400">
            Real-time direct-to-Drive pipeline. High-water-mark backpressure maintains safe memory bounds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Refresh active status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('new_transfer')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Transfer</span>
          </button>
        </div>
      </div>

      {activeList.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No Active Streams"
          description="There are currently no active or paused stream jobs in progress. Enter a direct download link to stream straight to Google Drive."
          actionText="Create New Transfer"
          onAction={() => onNavigate('new_transfer')}
        />
      ) : (
        <div className="space-y-4">
          {activeList.map((t) => (
            <TransferCard key={t.id} transfer={t} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};
