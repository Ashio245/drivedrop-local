import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Activity,
  History,
  HardDrive,
  Gamepad2,
  Settings,
  ShieldCheck,
  HelpCircle,
  Cloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { GoogleAuthStatus } from '../types/index.js';

export type TabType =
  | 'dashboard'
  | 'new_transfer'
  | 'active'
  | 'history'
  | 'drive'
  | 'library'
  | 'settings'
  | 'security'
  | 'help';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  authStatus: GoogleAuthStatus | null;
  activeCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  authStatus,
  activeCount,
}) => {
  const navItems: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new_transfer', label: 'New Transfer', icon: PlusCircle },
    { id: 'active', label: 'Active Transfers', icon: Activity, badge: activeCount },
    { id: 'history', label: 'Transfer History', icon: History },
    { id: 'drive', label: 'Drive & Extractor', icon: HardDrive },
    { id: 'library', label: 'Emulator Library', icon: Gamepad2 },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'security', label: 'Security & Privacy', icon: ShieldCheck },
    { id: 'help', label: 'Help & Limits', icon: HelpCircle },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm text-zinc-100 tracking-tight">
              DriveDrop Local
            </h1>
            <p className="text-[11px] text-zinc-500 font-mono">v1.0.0 • Local-First</p>
          </div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-sky-400' : 'text-zinc-500'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Connection Status Box */}
      <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30">
        <div className="flex items-center gap-2.5">
          {authStatus?.isConnected ? (
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-zinc-300 truncate">
              {authStatus?.isConnected
                ? authStatus.user?.name || 'Google Connected'
                : 'Google Disconnected'}
            </div>
            <div className="text-[10px] text-zinc-500 truncate font-mono">
              {authStatus?.isConnected
                ? authStatus.user?.email || 'Authenticated'
                : 'Requires OAuth Link'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
