// Phase 4: Flop レポートのプリロード hook + 純関数。
//
// 用途: Flop タブを開いた / 選択中ボードが変わった瞬間に、全 variant × 全 depth の
// donk + CB データを裏で並列 fetch して module-level cache (fetchFlopNode の memo)
// に格納する。アコーディオン展開時にセルは cache hit で即時表示できる。
//
// 設計ポイント:
//   - `loadFlopReportCell` が variant あたり 1〜2 fetch を内包しており、その内側で
//     fetchFlopNode が memoize されている。preload は cache を温めるための trigger。
//   - 並列上限 8 (= 同時 fetch 最大 16 件) — R2 の TCP 接続数を取り合わない適正値。
//   - 前回の preload は AbortController で cancel。in-flight が race condition を
//     起こさないよう、loadFlopReportCell に signal を渡してアボート可。
//   - エラーは silent (個別セルが自分で再 fetch すれば error 表示できる)。
//
// 補足: fetchFlopNode の cache は URL 単位なので、ボード切替で再呼び出しても
// 既出 variant は instant return (network 不発生)。preload を board 依存にしても
// 副作用は cache 確認のみ。

import { useEffect } from 'react';
import {
  enumerateMatchups,
  FLOP_REPORT_DEPTHS,
  loadFlopReportCell,
  type FlopReportDepth,
} from '../data/flopReport';

/** 同時 in-flight 上限。loadFlopReportCell は内部で 1〜2 fetch を出すため、実 fetch は最大 16。 */
export const PRELOAD_CONCURRENCY = 8;

interface PreloadTask {
  variant: string;
  depth: FlopReportDepth;
}

/** 全 4 depth × 全 variant (variant !== null) を収集。重複なし。 */
function collectPreloadTasks(): PreloadTask[] {
  const tasks: PreloadTask[] = [];
  for (const depth of FLOP_REPORT_DEPTHS) {
    for (const cell of enumerateMatchups(depth)) {
      if (cell.variant !== null) {
        tasks.push({ variant: cell.variant, depth });
      }
    }
  }
  return tasks;
}

/**
 * 全 variant × depth に対し `loadFlopReportCell` を並列 fetch (上限 PRELOAD_CONCURRENCY)。
 *
 * - 既に fetchFlopNode の memo にあれば instant return (network 不発生)。
 * - 個別 task の失敗は silent (cell 側で自然に retry/error 表示)。
 * - `signal.aborted` 検出時は新しい task を起動しない (既起動の in-flight は signal で
 *   await を中断、underlying fetch は他 caller のため継続)。
 *
 * @returns 完了 task 数と失敗 task 数を持つサマリ
 */
export interface PreloadResult {
  total: number;
  succeeded: number;
  failed: number;
  aborted: boolean;
}

export async function preloadFlopReports(
  board: string | null,
  signal: AbortSignal,
): Promise<PreloadResult> {
  const tasks = collectPreloadTasks();
  const total = tasks.length;
  let succeeded = 0;
  let failed = 0;
  let nextIdx = 0;

  const workers: Array<Promise<void>> = [];
  for (let w = 0; w < PRELOAD_CONCURRENCY; w++) {
    workers.push(
      (async () => {
        while (!signal.aborted) {
          const myIdx = nextIdx++;
          if (myIdx >= tasks.length) return;
          const { variant, depth } = tasks[myIdx];
          try {
            await loadFlopReportCell(variant, depth, board, undefined, signal);
            succeeded++;
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            failed++;
            // silent — cell が自分で再試行する
          }
        }
      })(),
    );
  }
  await Promise.allSettled(workers);
  return { total, succeeded, failed, aborted: signal.aborted };
}

/**
 * React hook: マウント時 + board 変更時に preloadFlopReports を起動。
 * cleanup で前回 preload をアボートする。
 */
export function useFlopReportPreload(board: string | null): void {
  useEffect(() => {
    const ctrl = new AbortController();
    void preloadFlopReports(board, ctrl.signal);
    return () => ctrl.abort();
  }, [board]);
}
