import React, { useState, useEffect, useCallback } from 'react';
import { TabType, Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewTransferPage } from './pages/NewTransferPage.js';
import { ActiveTransfersPage } from './pages/ActiveTransfersPage.js';
import { TransferHistoryPage } from './pages/TransferHistoryPage.js';
import { DriveBrowserPage } from './pages/DriveBrowserPage.js';
import { EmulatorLibraryPage } from './pages/EmulatorLibraryPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { SecurityPrivacyPage } from './pages/SecurityPrivacyPage.js';
import { HelpPage } from './pages/HelpPage.js';
import { Transfer, GoogleAuthStatus, DriveQuota, TransferProgressEvent } from './types/index.js';
import { useTransferEvents } from './lib/useTransferEvents.js';
import { api } from './lib/api.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus | null>(null);
  const [quota, setQuota] = useState<DriveQuota | null>(null);

  // Check URL query parameters for OAuth success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      loadAuth();
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadAuth();
    loadTransfers();
  }, []);

  // Poll transfers periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadTransfers();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const loadAuth = async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthStatus(status);
      if (status.isConnected) {
        loadQuota();
      }
    } catch (err) {
      console.error('Failed to load auth status:', err);
    }
  };

  const loadQuota = async () => {
    try {
      const q = await api.getDriveAbout();
      setQuota(q);
    } catch {
      // Ignore quota fetch errors
    }
  };

  const loadTransfers = async () => {
    try {
      const data = await api.listTransfers();
      setTransfers(data.transfers || []);
    } catch (err) {
      console.error('Failed to fetch transfers:', err);
    }
  };

  // Real-time SSE updates handler
  const handleProgressEvent = useCallback((event: TransferProgressEvent) => {
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.id === event.transferId) {
          return {
            ...t,
            status: event.status,
            transferredBytes: event.transferredBytes,
            totalBytes: event.totalBytes,
            speedBps: event.speedBps,
            etaSeconds: event.etaSeconds,
            errorMessage: event.errorMessage ?? t.errorMessage,
          };
        }
        return t;
      })
    );
  }, []);

  useTransferEvents(handleProgressEvent);

  const activeCount = transfers.filter((t) =>
    ['QUEUED', 'CONNECTING', 'STREAMING'].includes(t.status)
  ).length;

  const pageHeaders: Record<TabType, { title: string; description: string }> = {
    dashboard: {
      title: 'Transfer Overview',
      description: 'Zero-disk direct-to-Drive stream engine and storage metrics',
    },
    new_transfer: {
      title: 'New Direct Transfer',
      description: 'Stream any direct HTTP or HTTPS link straight into Google Drive',
    },
    active: {
      title: 'Active Transfers',
      description: 'Real-time telemetry, bandwidth gauges, and active stream controls',
    },
    history: {
      title: 'Transfer History',
      description: 'Durable SQLite records and technical event traces',
    },
    drive: {
      title: 'Google Drive Explorer',
      description: 'Browse, manage, search, and classify files in your Google Drive',
    },
    library: {
      title: 'Emulator Preservation Library',
      description: 'Organize and launch legally owned game backups and homebrew files',
    },
    settings: {
      title: 'Settings & Integrations',
      description: 'Google Cloud OAuth setup, local Drive paths, and emulator binaries',
    },
    security: {
      title: 'Security & Privacy',
      description: 'SSRF defense audit, AES-256 token encryption, and local-first guarantees',
    },
    help: {
      title: 'Technical Reference & Limits',
      description: 'Google Drive 750 GB daily limit, resumable sessions, and direct streaming',
    },
  };

  const currentHeader = pageHeaders[currentTab];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Fixed Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        authStatus={authStatus}
        activeCount={activeCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title={currentHeader.title}
          description={currentHeader.description}
          authStatus={authStatus}
          quota={quota}
          onNewTransfer={() => setCurrentTab('new_transfer')}
          onOpenSettings={() => setCurrentTab('settings')}
          onDisconnect={async () => {
            if (confirm('Disconnect Google account?')) {
              await api.disconnectGoogle();
              loadAuth();
            }
          }}
        />

        <main className="flex-1 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              transfers={transfers}
              authStatus={authStatus}
              quota={quota}
              onRefresh={loadTransfers}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'new_transfer' && (
            <NewTransferPage
              authStatus={authStatus}
              onTransferCreated={loadTransfers}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'active' && (
            <ActiveTransfersPage
              transfers={transfers}
              onRefresh={loadTransfers}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'history' && (
            <TransferHistoryPage
              transfers={transfers}
              onRefresh={loadTransfers}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'drive' && (
            <DriveBrowserPage
              authStatus={authStatus}
              quota={quota}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'library' && (
            <EmulatorLibraryPage onNavigate={setCurrentTab} />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              authStatus={authStatus}
              onRefreshAuth={loadAuth}
            />
          )}

          {currentTab === 'security' && (
            <SecurityPrivacyPage
              authStatus={authStatus}
              onRefreshAuth={loadAuth}
            />
          )}

          {currentTab === 'help' && <HelpPage />}
        </main>
      </div>
    </div>
  );
};
