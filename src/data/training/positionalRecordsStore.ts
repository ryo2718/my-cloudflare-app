// 中級ポジション別トレーニングの結果画面 (振り返り) 用ローカル記録ストア。
// in-memory + sessionStorage。DB には書き込まない (DB は missed_problems 経由)。

import type {
  PositionalQuestion,
  PositionalResponse,
} from './preflopIntermediatePositional';

export interface PositionalRecord {
  id: number; // 1-indexed 出題順
  question: PositionalQuestion;
  response: PositionalResponse;
  /** 1 問素点 (-1/0/1/2)。 */
  points: number;
}

const STORAGE_KEY_PREFIX = 'positional_records:';
const mem = new Map<string, PositionalRecord[]>();

function keyOf(levelKey: string): string {
  return STORAGE_KEY_PREFIX + levelKey;
}

function ss(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

export function savePositionalRecords(levelKey: string, records: ReadonlyArray<PositionalRecord>): void {
  mem.set(levelKey, [...records]);
  const s = ss();
  if (s) {
    try {
      s.setItem(keyOf(levelKey), JSON.stringify(records));
    } catch {
      /* quota 等は無視 */
    }
  }
}

export function loadPositionalRecords(levelKey: string): PositionalRecord[] | null {
  const m = mem.get(levelKey);
  if (m) return m;
  const s = ss();
  if (!s) return null;
  try {
    const raw = s.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PositionalRecord[];
    mem.set(levelKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearPositionalRecords(levelKey: string): void {
  mem.delete(levelKey);
  const s = ss();
  if (s) {
    try {
      s.removeItem(keyOf(levelKey));
    } catch {
      /* ignore */
    }
  }
}
