import React from 'react';
import { Plus, HardDrive, LogOut } from 'lucide-react';
import { GoogleAuthStatus, DriveQuota } from '../types/index.js';
import { formatBytes } from '../lib/formatters.js';
import { TabType } from './Sidebar.js';

interface HeaderProps {
  title: string;
  description?: string;
  authStatus: GoogleAuthStatus | null;
  quota: DriveQuota | null;
  onNewTransfer: () => void;
  onOpenSettings: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  description,
  authStatus,
  quota,
  onNewTransfer,
  onOpenSettings,
  onDisconnect,
}) => {
  let quotaPercent = 0;
  if (quota?.usage && quota?.limit) {
    const usage = parseFloat(quota.usage);
    const limit = parseFloat(quota.limit);
    if (limit > 0) {
      quotaPercent = Math.min(100, Math.round((usage / limit) * 100));
    }
  }

  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xs px-8 flex items-center justify-between shrink-0">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {description && (
          <p className="text-xs text-zinc-400 font-sans">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-5">
        {/* Storage Quota Gauge */}
        {authStatus?.isConnected && quota?.limit && (
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <HardDrive className="w-4 h-4 text-zinc-400" />
            <div className="text-xs font-mono">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span>{formatBytes(quota.usage)}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-500">{formatBytes(quota.limit)}</span>
                <span className="text-zinc-400 font-sans text-[11px] ml-1">
                  ({quotaPercent}%)
                </span>
              </div>
              <div className="w-28 bg-zinc-800 h-1 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    quotaPercent > 90 ? 'bg-rose-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onNewTransfer}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition shadow-xs"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Transfer</span>
        </button>

        {/* User Profile / Disconnect */}
        {authStatus?.isConnected ? (
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            {authStatus.user?.avatar ? (
              <img
                src={authStatus.user.avatar}
                alt="Google Avatar"
                className="w-7 h-7 rounded-full border border-zinc-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-mono text-zinc-300">
                {authStatus.user?.name?.[0] || 'U'}
              </div>
            )}
            <button
              onClick={onDisconnect}
              title="Disconnect Google Account"
              className="p-1 text-zinc-500 hover:text-rose-400 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenSettings}
            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition"
          >
            Connect Google
          </button>
        )}
      </div>
    </header>
  );
};
