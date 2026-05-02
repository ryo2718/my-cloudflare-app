import { useEffect, useState } from 'react';

export type VsPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB';
export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

/** vs ポジション → 3betし得る hero ポジションのリスト (vsの後ろの席のみ) */
export const VS_POSITION_OPPONENTS: Readonly<Record<VsPosition, ReadonlyArray<Position>>> = {
  UTG: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  HJ:  ['CO', 'BTN', 'SB', 'BB'],
  CO:  ['BTN', 'SB', 'BB'],
  BTN: ['SB', 'BB'],
  SB:  ['BB'],
};

function getNodeFilename(vsPos: VsPosition, heroPos: Position): string {
  return `${vsPos.toLowerCase()}r_${heroPos.toLowerCase()}`;
}

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

const cache: Record<string, RawNodeData> = {};
let inflight: Promise<void> | null = null;

// 全15ファイルのリスト (UTG×5 + HJ×4 + CO×3 + BTN×2 + SB×1)
const ALL_3BET_NODES: ReadonlyArray<string> = (() => {
  const out: string[] = [];
  for (const vs of ['UTG', 'HJ', 'CO', 'BTN', 'SB'] as VsPosition[]) {
    for (const hero of VS_POSITION_OPPONENTS[vs]) {
      out.push(getNodeFilename(vs, hero));
    }
  }
  return out;
})();

/**
 * 全15 vs RFI ノードを並列ロード → モジュールキャッシュに格納。
 * - 既にロード済みなら即解決
 * - 並行呼び出しは同じ Promise に集約
 * - エラー時は inflight をクリアして次回リトライ可
 *
 * App.tsx 起動時にプリロードする想定。
 */
export function loadAll3betNodes(): Promise<void> {
  if (Object.keys(cache).length === ALL_3BET_NODES.length) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await Promise.all(
        ALL_3BET_NODES.map(async (filename) => {
          if (cache[filename]) return;
          const url = `${PREFLOP_DATA_ROOT}/${filename}.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Failed to load ${filename} (${res.status})`);
          cache[filename] = (await res.json()) as RawNodeData;
        }),
      );
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export type Symbol = '◎' | '○' | '🔼' | '❌';

export interface ThreebetEvaluation {
  position: Position;
  raiseRate: number;
  callRate: number;
  /** raise + call。allin は含まない (ユーザー指示通り) */
  playRate: number;
  symbol: Symbol;
}

function classifyPlayRate(rate: number): Symbol {
  if (rate >= 90) return '◎';
  if (rate >= 30) return '○';
  if (rate >= 10) return '🔼';
  return '❌';
}

/**
 * 指定ハンド × 指定 vs ポジションでの3bet/call戦略を、対応する hero ポジション分評価。
 * - hand=null: idle
 * - キャッシュ完備時は同期返却 (loading 経由しない)
 * - sparse 形式に対応 (hand キー欠落 → play率0)
 */
export function use3betEvaluation(
  hand: string | null,
  vsPosition: VsPosition,
): {
  evaluations: ThreebetEvaluation[] | null;
  loading: boolean;
  error: string | null;
} {
  const [evaluations, setEvaluations] = useState<ThreebetEvaluation[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hand) {
      setEvaluations(null);
      setLoading(false);
      setError(null);
      return;
    }

    const compute = (): ThreebetEvaluation[] => {
      const heroes = VS_POSITION_OPPONENTS[vsPosition];
      return heroes.map((hero) => {
        const filename = getNodeFilename(vsPosition, hero);
        const node = cache[filename];
        const handData = node?.hands[hand];
        const raise = handData?.raise ?? 0;
        const call = handData?.call ?? 0;
        const playRate = raise + call;
        return {
          position: hero,
          raiseRate: raise,
          callRate: call,
          playRate,
          symbol: classifyPlayRate(playRate),
        };
      });
    };

    if (Object.keys(cache).length === ALL_3BET_NODES.length) {
      setEvaluations(compute());
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAll3betNodes()
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
  }, [hand, vsPosition]);

  return { evaluations, loading, error };
}
