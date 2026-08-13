import { BackupData } from './backup';

/**
 * Local undo history. Every time the base is about to be REPLACED (cloud copy
 * applied, backup imported, divergence resolved) the outgoing version is kept
 * here, so a wrong choice is never final. Stored on the device only — this is
 * an undo net, not a substitute for backups.
 */
export interface Snapshot {
  at: number;
  reason: string;
  perfumes: number;
  sales: number;
  data: BackupData;
}

const KEY = 'sv_snapshots';
const MAX = 4;

export function listSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(data: BackupData, reason: string): void {
  // An empty base is not worth keeping — and would only push out real versions.
  if (!data.perfumes.length && !data.sales.length) return;
  const snap: Snapshot = {
    at: Date.now(),
    reason,
    perfumes: data.perfumes.length,
    sales: data.sales.length,
    data,
  };
  let list = [snap, ...listSnapshots()].slice(0, MAX);
  while (list.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return;
    } catch {
      list = list.slice(0, list.length - 1); // storage full — drop the oldest and retry
    }
  }
}
