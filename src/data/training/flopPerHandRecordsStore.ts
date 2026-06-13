// フロップ中級CB(個別ハンド) の回答記録ストア (in-memory + sessionStorage)。

import type { FlopPhRecord } from './flopPerHandCb';

const STORAGE_KEY_PREFIX = 'flop_ph_records:';
const memStore = new Map<string, FlopPhRecord[]>();

function keyOf(levelKey: string): string {
  return STORAGE_KEY_PREFIX + levelKey;
}
function getSessionStorage(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function saveFlopPhRecords(levelKey: string, records: ReadonlyArray<FlopPhRecord>): void {
  memStore.set(levelKey, [...records]);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(keyOf(levelKey), JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function loadFlopPhRecords(levelKey: string): FlopPhRecord[] | null {
  const inMem = memStore.get(levelKey);
  if (inMem) return [...inMem];
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlopPhRecord[];
    memStore.set(levelKey, parsed);
    return [...parsed];
  } catch {
    return null;
  }
}

export function clearFlopPhRecords(levelKey: string): void {
  memStore.delete(levelKey);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(keyOf(levelKey));
  } catch {
    // ignore
  }
}
