import React from 'react';
import { HelpCircle, AlertCircle, HardDrive, Shield, CheckCircle, ExternalLink } from 'lucide-react';

export const HelpPage: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-1">
          Technical Reference & Operating Limitations
        </h2>
        <p className="text-xs text-zinc-400">
          Understanding Google Drive's API limits, network physics, and direct streaming capabilities.
        </p>
      </div>

      {/* 1. Google Drive Platform Limits */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Google Drive Platform Limits
          </h3>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          While DriveDrop Local imposes <strong>zero artificial application-level file size caps</strong>, all transfers are physically bounded by Google Drive's API constraints and available user quota:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">Daily Upload Quota (750 GB):</span>
            <p className="text-zinc-400 leading-relaxed">
              Google enforces a hard upload ceiling of 750 GB per rolling 24-hour period per user across both API uploads and web uploads. If exceeded, Google returns HTTP 403 <code className="text-zinc-300 font-mono">userRateLimitExceeded</code>.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">Max Single File Size (5 TB):</span>
            <p className="text-zinc-400 leading-relaxed">
              Google Drive accepts files up to 5 TB each, provided your account has sufficient available storage.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">Resumable Session Lifespan:</span>
            <p className="text-zinc-400 leading-relaxed">
              Google Drive resumable upload sessions remain active for approximately 7 days. If a transfer remains paused or interrupted beyond this window, Google invalidates the upload URI.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-zinc-200">API Rate Limiting (Queries / Sec):</span>
            <p className="text-zinc-400 leading-relaxed">
              Google limits file metadata queries to 12,000 queries per minute per project. DriveDrop Local employs automatic exponential backoff with jitter on HTTP 429 and 403 responses.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Supported vs Unsupported Download URLs */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-sky-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Supported vs. Unsupported Download URLs
          </h3>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-zinc-400">
          <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-300 space-y-1">
            <span className="font-semibold">Supported Sources:</span>
            <p className="text-zinc-300">
              Direct HTTP/HTTPS download URLs (e.g. ISO archives, datasets, open-source distributions, direct CDNs) and servers supporting HTTP range requests or chunked transfer encoding.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40 text-rose-300 space-y-1">
            <span className="font-semibold">Unsupported / Incompatible Sources:</span>
            <p className="text-zinc-300">
              Links requiring interactive browser sessions, CAPTCHA verification, Cloudflare waiting rooms, paywalls, or DRM protection. DriveDrop Local is an automated server utility and cannot solve interactive browser challenges.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Google Drive for Desktop & Emulator Launching */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <HardDrive className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-100">
            Google Drive for Desktop & Emulator Launching
          </h3>
        </div>

        <div className="space-y-3 text-xs text-zinc-400 leading-relaxed">
          <p>
            When launching classified game backups with your local emulator, DriveDrop Local points the emulator binary to your local Google Drive for Desktop mirror directory (e.g. <code className="font-mono text-zinc-300">~/Google Drive/My Drive</code>).
          </p>

          <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
            <span className="font-semibold text-amber-400">Important Note on "Cloud-Only" Files:</span>
            <p className="mt-1 text-zinc-400">
              By default, Google Drive for Desktop streams files on demand. Before launching large games (e.g., PS2, GameCube, Wii ISOs), make sure to right-click the file in macOS Finder or Windows Explorer and select <strong>"Available offline"</strong>. Otherwise, the emulator will encounter a 0-byte placeholder until the OS sync finishes.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Legal Compliance */}
      <section className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 space-y-3 text-xs text-zinc-400 leading-relaxed">
        <h3 className="text-sm font-semibold text-zinc-100">
          Legal & Copyright Compliance
        </h3>
        <p>
          DriveDrop Local is a technical stream utility. Users are exclusively responsible for ensuring they possess the legal right or authorization to transfer, store, and organize content. DriveDrop Local does not host, index, or distribute copyrighted ROMs, BIOS files, firmware, or decryption keys.
        </p>
      </section>
    </div>
  );
};
