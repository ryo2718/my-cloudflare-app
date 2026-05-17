// Flop ボード選択履歴を LocalStorage に保持する純粋ユーティリティ。
//
// 用途:
//   - ユーザーが選んだフロップをテクスチャ単位 (suit-isomorphism) で集約してカウント
//   - 「ボードを選択」UI が頻出 boards を表示するためのデータソース
//   - 履歴が n 件未満ならデフォルトの代表的なテクスチャで埋める
//
// Canonical:
//   既存の `isoSignature` (src/utils/flopBoardCanonical.ts) を使って suit-isomorphism
//   を計算する。signature → 表示用 canonical 名前は決定的に算出:
//      class A → 's', class B → 'h', class C → 'd', class D → 'c'
//   これにより、"As Ks 3h" と "Ad Kd 3c" は同じ canonical "AsKs3h" になる。

import type { Card } from '../types/card';
import { isoSignature, parseBoardName } from '../utils/flopBoardCanonical';

const STORAGE_KEY = 'flopBoardHistory';
const STORAGE_VERSION = 1;

export interface BoardHistoryEntry {
  /** suit-normalized 形式 (deterministic canonical name)。 */
  canonical: string;
  count: number;
  /** unix timestamp (ms)。 */
  lastUsedAt: number;
}

export type BoardHistoryMap = Record<string, BoardHistoryEntry>;

interface StoredHistory {
  version: number;
  entries: BoardHistoryMap;
}

// ----------------------------------------------------------------------------
// Default vector boards (履歴が薄い時の埋め草、テクスチャ多様性を確保)
// ----------------------------------------------------------------------------

/**
 * Phase 5 で更新したカバー対象テクスチャ:
 *  1. 高ハイカード × ドライ × レインボー (AhKs3d)
 *  2. ハイカード × モノトーン × コネクト   (QsTs8s)
 *  3. ミドル × レインボー × ストレート系   (Th9c8d)
 *  4. ロー × ツーフラッシュ                 (9s6s3h)
 *  5. ロー × ドライ                         (7s3h2d)
 *  6. ペアボード ロー                       (3h3d2s)
 *  7. A ハイ + ペア                         (As6s6h)
 *  8. 高 × ツーフラッシュ                   (KsQs2h)
 *
 * 表記は spec のまま (canonicalize で内部正規化されるため、ABC ↔ ahd の差は無視)。
 */
const DEFAULT_VECTOR_BOARDS: ReadonlyArray<string> = [
  'AhKs3d',
  'QsTs8s',
  'Th9c8d',
  '9s6s3h',
  '7s3h2d',
  '3h3d2s',
  'As6s6h',
  'KsQs2h',
];

// ----------------------------------------------------------------------------
// Canonical
// ----------------------------------------------------------------------------

const CLASS_TO_SUIT: Record<string, string> = { A: 's', B: 'h', C: 'd', D: 'c' };

/**
 * カード 3 枚を suit-isomorphism で正規化した canonical 名前にする。
 * 同テクスチャの異なる入力 ("AsKs3h" と "AdKd3c") は同じ文字列を返す。
 *
 * フォーマット: 6 文字 (rank-desc 順)。suits は class A→s / B→h / C→d / D→c。
 */
export function boardCanonicalKey(cards: [Card, Card, Card]): string {
  const sig = isoSignature(cards);
  const [ranks, classes] = sig.split('|');
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += ranks[i] + CLASS_TO_SUIT[classes[i]];
  }
  return result;
}

/**
 * 6 文字のボード名 (例: "2h2d2c", "AsKs3h") を canonical 名前に変換。
 *
 * @throws ボード名のパース失敗 (重複カード/形式不正)
 */
export function canonicalizeBoardName(name: string): string {
  return boardCanonicalKey(parseBoardName(name));
}

// ----------------------------------------------------------------------------
// LocalStorage I/O (silent on failure)
// ----------------------------------------------------------------------------

function readStorage(): BoardHistoryMap {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as StoredHistory;
    if (data.version !== STORAGE_VERSION || !data.entries) return {};
    return data.entries;
  } catch {
    return {};
  }
}

function writeStorage(entries: BoardHistoryMap): void {
  try {
    if (!globalThis.localStorage) return;
    const data: StoredHistory = { version: STORAGE_VERSION, entries };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // QuotaExceeded / SecurityError 等は silently 失敗
  }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * ボードを履歴に記録 (count++、lastUsedAt 更新)。
 *
 * 入力は任意の 6 文字ボード名 (例: "AsKs3h", "AdKd3c", "2h2d2c")。
 * 内部で canonical 化されるので、同テクスチャの異 suit 入力は同じエントリに集約される。
 *
 * LocalStorage が使えない環境 (private browsing 等) でも例外は伝播しない。
 */
export function recordBoardSelection(boardName: string): void {
  let canonical: string;
  try {
    canonical = canonicalizeBoardName(boardName);
  } catch {
    return; // 形式不正は silent
  }
  const entries = readStorage();
  const existing = entries[canonical];
  entries[canonical] = {
    canonical,
    count: (existing?.count ?? 0) + 1,
    lastUsedAt: Date.now(),
  };
  writeStorage(entries);
}

/**
 * Top N ボードを返す。
 *  - 履歴あり: count 降順 → 同 count では lastUsedAt 降順 (= 新しいほど上)
 *  - 履歴が n 件未満: DEFAULT_VECTOR_BOARDS から canonical 重複しないものを順に追加
 *
 * 結果は常に「displayable な canonical 名」の配列 (長さ 0..n)。
 */
export function getTopBoards(n: number): string[] {
  if (n <= 0) return [];
  const entries = readStorage();
  const sorted = Object.values(entries)
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
    .map((e) => e.canonical);

  const result: string[] = [];
  const seen = new Set<string>();
  for (const name of sorted) {
    if (result.length >= n) break;
    if (!seen.has(name)) {
      result.push(name);
      seen.add(name);
    }
  }
  for (const def of DEFAULT_VECTOR_BOARDS) {
    if (result.length >= n) break;
    let canonical: string;
    try {
      canonical = canonicalizeBoardName(def);
    } catch {
      continue;
    }
    if (!seen.has(canonical)) {
      result.push(canonical);
      seen.add(canonical);
    }
  }
  return result;
}

/** 履歴を全クリア (デバッグ / リセット用)。LocalStorage 不可なら silent。 */
export function clearBoardHistory(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ----------------------------------------------------------------------------
// Test-only helpers
// ----------------------------------------------------------------------------

/** テスト専用: 内部 storage I/O を観察したい場合に使う。 */
export const _internals = {
  STORAGE_KEY,
  STORAGE_VERSION,
  DEFAULT_VECTOR_BOARDS,
  readStorage,
  writeStorage,
};
