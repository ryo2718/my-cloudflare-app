// 初級オープン (preflop_beginner_open) の結果画面「答え一覧」用ローカル記録ストア。
// in-memory + sessionStorage。DB には書き込まない (positionalRecordsStore と同じ方式)。

import type { Hand, Position } from '../../types/strategy';

export interface BeginnerOpenRecord {
  /** 1-indexed 出題順。 */
  id: number;
  position: Position;
  hand: Hand;
  /** GTO 正解レイズ% (0-100)。 */
  raisePct: number;
  /** ユーザー回答 (スライダー%)。スキップ / 時間切れは null。 */
  answerPct: number | null;
  /** 1 問素点 (0.5 = 正解 / 0 = 不正解)。 */
  points: number;
}

const STORAGE_KEY_PREFIX = 'beginner_open_records:';
const mem = new Map<string, BeginnerOpenRecord[]>();

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

export function saveBeginnerOpenRecords(
  levelKey: string,
  records: ReadonlyArray<BeginnerOpenRecord>,
): void {
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

export function loadBeginnerOpenRecords(levelKey: string): BeginnerOpenRecord[] | null {
  const m = mem.get(levelKey);
  if (m) return m;
  const s = ss();
  if (!s) return null;
  try {
    const raw = s.getItem(keyOf(levelKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BeginnerOpenRecord[];
    mem.set(levelKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function clearBeginnerOpenRecords(levelKey: string): void {
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
