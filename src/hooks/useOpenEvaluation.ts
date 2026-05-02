import { useEffect, useState } from 'react';
import {
  classifyRaiseRate,
  OPEN_POSITIONS,
  type OpenEvaluation,
  type OpenPosition,
} from '../utils/openEvaluation';
import type { Hand } from '../types/strategy';

interface RawHandData {
  allin: number;
  raise: number;
  call: number;
  fold: number;
}

interface RawNodeData {
  hands: Record<string, RawHandData>;
}

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

// モジュールスコープのキャッシュ — コンポーネント再マウントでも保持。
const cache: Partial<Record<OpenPosition, RawNodeData>> = {};
let inflight: Promise<void> | null = null;

/**
 * 5ポジション (UTG/HJ/CO/BTN/SB) の RFI ノードデータを並列ロードしてキャッシュ。
 * - 既にロード済みなら即解決
 * - 並行呼び出しは同じ Promise に集約 (多重 fetch 抑止)
 * - エラー時は inflight をクリアして次回リトライ可能に
 *
 * App.tsx 起動時にプリロードする想定 (オプション1)。
 */
export function loadAllOpenNodes(): Promise<void> {
  if (Object.keys(cache).length === OPEN_POSITIONS.length) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await Promise.all(
        OPEN_POSITIONS.map(async (pos) => {
          if (cache[pos]) return;
          const url = `${PREFLOP_DATA_ROOT}/${pos.toLowerCase()}.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${pos} (${res.status})`);
          cache[pos] = (await res.json()) as RawNodeData;
        }),
      );
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * 169ハンド notation を5ポジション分の Open 評価に変換。
 * - hand=null は idle (evaluations=null)
 * - データ未ロード時は loading=true で 5ファイル並列 fetch
 * - 2回目以降は cache から即時返却 (loading=false で同期的に値が出る)
 */
export function useOpenEvaluation(hand: Hand | null): {
  evaluations: OpenEvaluation[] | null;
  loading: boolean;
  error: string | null;
} {
  const [evaluations, setEvaluations] = useState<OpenEvaluation[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hand) {
      setEvaluations(null);
      setLoading(false);
      setError(null);
      return;
    }

    const compute = (): OpenEvaluation[] =>
      OPEN_POSITIONS.map((pos) => {
        const node = cache[pos];
        // RFI (depth=1) は sparse 後も169ハンド全部含むはず。万が一ハンドキー欠落なら raise=0 扱い。
        const raise = node?.hands[hand]?.raise ?? 0;
        return { position: pos, raiseRate: raise, symbol: classifyRaiseRate(raise) };
      });

    // キャッシュ完備 → 同期的にセット (loading にならない)
    if (Object.keys(cache).length === OPEN_POSITIONS.length) {
      setEvaluations(compute());
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAllOpenNodes()
      .then(() => {
        if (cancelled) return;
        setEvaluations(compute());
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hand]);

  return { evaluations, loading, error };
}
