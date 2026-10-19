import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Server,
  AlertTriangle,
  FileCheck,
  Cpu,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { GoogleAuthStatus } from '../types/index.js';
import { api } from '../lib/api.js';

interface SecurityPrivacyPageProps {
  authStatus: GoogleAuthStatus | null;
  onRefreshAuth: () => void;
}

export const SecurityPrivacyPage: React.FC<SecurityPrivacyPageProps> = ({
  authStatus,
  onRefreshAuth,
}) => {
  const [isWiping, setIsWiping] = useState(false);
  const [wipeSuccess, setWipeSuccess] = useState(false);

  const handleWipeData = async () => {
    if (
      confirm(
        'WARNING: This will disconnect your Google Drive account, revoke OAuth tokens with Google, and wipe all local SQLite transfer history. Proceed?'
      )
    ) {
      setIsWiping(true);
      try {
        await api.disconnectGoogle();
        onRefreshAuth();
        setWipeSuccess(true);
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsWiping(false);
      }
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          Security & Privacy Architecture
        </h2>
        <p className="text-xs text-zinc-400">
          Engineering guardrails, SSRF defenses, token isolation, and local privacy guarantees.
        </p>
      </div>

      {wipeSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
          All Google credentials and local tokens have been revoked and cleared from SQLite.
        </div>
      )}

      {/* 1. SSRF Defense Engine */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Strict SSRF Defense Engine
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Because DriveDrop Local fetches remote URLs initiated by user input, it executes active defense mechanisms to prevent Server-Side Request Forgery attacks against local intranets or cloud instances:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-emerald-400 font-semibold">Private Subnet Blocking:</span>
            <p className="text-zinc-400 font-sans">
              Rejects RFC1918 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and IPv6 Unique Local addresses (fc00::/7).
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-emerald-400 font-semibold">Metadata & Link-Local Guard:</span>
            <p className="text-zinc-400 font-sans">
              Blocks AWS/GCP/Azure instance metadata endpoints (169.254.169.254) and fe80::/10 link-local addresses.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-emerald-400 font-semibold">DNS Rebinding Verification:</span>
            <p className="text-zinc-400 font-sans">
              Hostnames are resolved to IP before connection; if resolved IP matches blocklist, connection is refused.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-emerald-400 font-semibold">Redirect Hop Interception:</span>
            <p className="text-zinc-400 font-sans">
              Every HTTP 301/302/307/308 redirect target is intercepted and re-validated against the SSRF engine.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Token Security & Encryption */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-sky-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Encrypted Credential Storage
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Google OAuth access tokens and refresh tokens are stored in the local SQLite database encrypted with <strong>AES-256-GCM</strong> using an operating system or environment secret key.
        </p>

        <ul className="list-disc list-inside text-xs text-zinc-400 space-y-1.5 leading-relaxed font-sans">
          <li>Tokens are never exposed in frontend HTTP responses or stored in browser local storage.</li>
          <li>All Google API transactions occur server-side inside the Fastify runtime.</li>
          <li>Sensitive authorization headers and bearer tokens are omitted from all logs.</li>
        </ul>
      </section>

      {/* 3. Zero-Disk Streaming & Intermediary Policy */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Zero-Disk Direct Pipe & No Intermediary Servers
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          DriveDrop Local operates with zero intermediary servers. Data is piped in real-time from the remote socket to Google Drive's resumable upload endpoint using memory-bounded chunks (8 MB).
        </p>

        <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-300">
          Source URL ──[HTTPS Stream]──▶ DriveDrop (8MB RAM Buffer) ──[Resumable PUT]──▶ Your Google Drive
        </div>
      </section>

      {/* 4. Revocation & Purge */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-rose-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Token Revocation & Data Wipe
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          You can disconnect and revoke all Google authorizations at any time. This calls Google's token revocation API and deletes stored tokens from your SQLite database.
        </p>

        <div className="pt-2">
          <button
            onClick={handleWipeData}
            disabled={isWiping}
            className="px-4 py-2.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 hover:bg-rose-900 text-xs font-semibold transition"
          >
            {isWiping ? 'Revoking Tokens...' : 'Revoke Tokens & Clear Local Credentials'}
          </button>
        </div>
      </section>
    </div>
  );
};
