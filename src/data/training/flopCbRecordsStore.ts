// フロップ中級レンジベットの回答記録ストア (in-memory + sessionStorage)。
// flopRecordsStore と同方式。鍵 prefix は専用にして衝突回避。

import type { FlopRbRecord } from './flopIntermediateCb';

const STORAGE_KEY_PREFIX = 'flop_rb_records:';
const memStore = new Map<string, FlopRbRecord[]>();

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

export function saveFlopRbRecords(levelKey: string, records: ReadonlyArray<FlopRbRecord>): void {
  memStore.set(levelKey, [...records]);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(keyOf(levelKey), JSON.stringify(records));
  } catch {
    // ignore
  }
}

export function loadFlopRbRecords(levelKey: string): FlopRbRecord[] | null {
  const inMem = memStore.get(levelKey);
  if (inMem) return [...inMem];
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlopRbRecord[];
    memStore.set(levelKey, parsed);
    return [...parsed];
  } catch {
    return null;
  }
}

export function clearFlopRbRecords(levelKey: string): void {
  memStore.delete(levelKey);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(keyOf(levelKey));
  } catch {
    // ignore
  }
}
