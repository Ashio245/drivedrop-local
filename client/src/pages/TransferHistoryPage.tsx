import React, { useState } from 'react';
import { History, Search, Filter, RefreshCw } from 'lucide-react';
import { Transfer } from '../types/index.js';
import { TransferCard } from '../components/TransferCard.js';
import { EmptyState } from '../components/EmptyState.js';

interface TransferHistoryPageProps {
  transfers: Transfer[];
  onRefresh: () => void;
  onNavigate: (tab: any) => void;
}

export const TransferHistoryPage: React.FC<TransferHistoryPageProps> = ({
  transfers,
  onRefresh,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState('');

  // Filter history (everything not currently actively streaming)
  const historyList = transfers.filter((t) => {
    if (['CONNECTING', 'STREAMING'].includes(t.status)) return false;
    if (filter !== 'ALL' && t.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.filename.toLowerCase().includes(q) ||
        t.sourceUrl.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 mb-1">Transfer History</h2>
          <p className="text-xs text-zinc-400">
            Durable SQLite transfer records, technical event traces, and Google Drive file IDs.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition self-start sm:self-auto"
          title="Refresh history"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-1.5">
          {(['ALL', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                filter === status
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search filenames or URLs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-sky-500 font-mono"
          />
        </div>
      </div>

      {historyList.length === 0 ? (
        <EmptyState
          icon={History}
          title="No History Found"
          description="No transfer records match your current filter criteria."
          actionText="Start a Transfer"
          onAction={() => onNavigate('new_transfer')}
        />
      ) : (
        <div className="space-y-4">
          {historyList.map((t) => (
            <TransferCard key={t.id} transfer={t} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
};
