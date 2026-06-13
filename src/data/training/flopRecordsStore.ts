// フロップトレーニングの 20 問回答記録ストア。
//   - TrainingPlayFlop 完了時に (問題 + 回答 + 正誤) を保存
//   - TrainingResultFlop が振り返り一覧の描画用に読み出す
// 永続性は preflop の recordsStore と同じ方針 (in-memory Map + sessionStorage フォールバック)。
// 鍵は preflop と衝突しないよう専用 prefix を使う。

import type { FlopRecord } from './flopBeginner';

const STORAGE_KEY_PREFIX = 'flop_training_records:';
const memStore = new Map<string, FlopRecord[]>();

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

export function saveFlopRecords(levelKey: string, records: ReadonlyArray<FlopRecord>): void {
  memStore.set(levelKey, [...records]);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(keyOf(levelKey), JSON.stringify(records));
  } catch {
    // quota / SecurityError 等を無視 (in-memory は維持)
  }
}

export function loadFlopRecords(levelKey: string): FlopRecord[] | null {
  const inMem = memStore.get(levelKey);
  if (inMem) return [...inMem];
  const ss = getSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlopRecord[];
    memStore.set(levelKey, parsed);
    return [...parsed];
  } catch {
    return null;
  }
}

export function clearFlopRecords(levelKey: string): void {
  memStore.delete(levelKey);
  const ss = getSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(keyOf(levelKey));
  } catch {
    // ignore
  }
}
