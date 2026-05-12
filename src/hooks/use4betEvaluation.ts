import { useEffect, useState } from 'react';
import { classifyByPlayRateWithAllin, type StrategySymbol } from '../utils/strategySymbol';

/** 4bet シーンでの "vs ポジション" — 元の opener に対し 3bet を打ったプレイヤー */
export type VsPosition = 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

/**
 * vs (= 3bettor) ポジション → 4bet し得る hero (= 元 opener) のリスト。
 * 「vs より前の席だけが open → vs から 3bet された側」になる。
 */
export const VS_POSITION_HEROS: Readonly<Record<VsPosition, ReadonlyArray<Position>>> = {
  HJ:  ['UTG'],
  CO:  ['UTG', 'HJ'],
  BTN: ['UTG', 'HJ', 'CO'],
  SB:  ['UTG', 'HJ', 'CO', 'BTN'],
  BB:  ['UTG', 'HJ', 'CO', 'BTN', 'SB'],
};

/** ノード命名: hero open → vs 3bet → hero 判断 = `{hero}r_{vs}r_{hero}` */
function getNodeFilename(vsPos: VsPosition, heroPos: Position): string {
  const v = vsPos.toLowerCase();
  const h = heroPos.toLowerCase();
  return `${h}r_${v}r_${h}`;
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

// 全15ファイルのリスト (HJ×1 + CO×2 + BTN×3 + SB×4 + BB×5)
const ALL_4BET_NODES: ReadonlyArray<string> = (() => {
  const out: string[] = [];
  for (const vs of ['HJ', 'CO', 'BTN', 'SB', 'BB'] as VsPosition[]) {
    for (const hero of VS_POSITION_HEROS[vs]) {
      out.push(getNodeFilename(vs, hero));
    }
  }
  return out;
})();

/**
 * 全15 4bet ノードを並列ロード → モジュールキャッシュに格納。
 * use3betEvaluation.loadAll3betNodes と同じ構造。
 */
export function loadAll4betNodes(): Promise<void> {
  if (Object.keys(cache).length === ALL_4BET_NODES.length) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await Promise.all(
        ALL_4BET_NODES.map(async (filename) => {
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

export type Symbol = StrategySymbol;

export interface FourbetEvaluation {
  position: Position;
  raiseRate: number;
  callRate: number;
  allinRate: number;
  foldRate: number;
  /** raise + call + allin (4bet では jam も play 扱い) */
  playRate: number;
  symbol: StrategySymbol;
}

/**
 * 指定ハンド × 指定 vs ポジションでの 4bet 戦略を、対応する hero ポジション分評価。
 * use3betEvaluation と同じ構造・同じ閾値・同じ sparse 対応。
 */
export function use4betEvaluation(
  hand: string | null,
  vsPosition: VsPosition,
): {
  evaluations: FourbetEvaluation[] | null;
  loading: boolean;
  error: string | null;
} {
  const [evaluations, setEvaluations] = useState<FourbetEvaluation[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hand) {
      // 既存パターン (useStrategy 系と統一): prop null 時の state reset。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEvaluations(null);
      setLoading(false);
      setError(null);
      return;
    }

    const compute = (): FourbetEvaluation[] => {
      const heroes = VS_POSITION_HEROS[vsPosition];
      return heroes.map((hero) => {
        const filename = getNodeFilename(vsPosition, hero);
        const node = cache[filename];
        const handData = node?.hands[hand];
        const raise = handData?.raise ?? 0;
        const call = handData?.call ?? 0;
        const allin = handData?.allin ?? 0;
        const fold = handData?.fold ?? Math.max(0, 100 - raise - call - allin);
        const playRate = raise + call + allin;
        return {
          position: hero,
          raiseRate: raise,
          callRate: call,
          allinRate: allin,
          foldRate: fold,
          playRate,
          symbol: classifyByPlayRateWithAllin(raise, call, allin),
        };
      });
    };

    if (Object.keys(cache).length === ALL_4BET_NODES.length) {
      setEvaluations(compute());
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    loadAll4betNodes()
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
