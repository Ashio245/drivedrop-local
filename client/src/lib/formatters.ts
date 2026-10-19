export function formatBytes(bytesStrOrNum?: string | number | bigint | null): string {
  if (bytesStrOrNum === undefined || bytesStrOrNum === null || bytesStrOrNum === '') {
    return 'Unknown size';
  }

  const bytes = typeof bytesStrOrNum === 'bigint' 
    ? Number(bytesStrOrNum) 
    : typeof bytesStrOrNum === 'string' 
      ? parseFloat(bytesStrOrNum) 
      : bytesStrOrNum;

  if (isNaN(bytes) || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(2))} ${sizes[safeI]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds?: number | null): string {
  if (seconds === undefined || seconds === null || seconds <= 0 || !isFinite(seconds)) {
    return 'Calculating...';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;

  if (mins < 60) {
    return `${mins}m ${remainingSecs}s`;
  }

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
