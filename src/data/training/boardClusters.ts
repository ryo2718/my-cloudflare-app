// ボードクラスタ参照モジュール。
//
// scripts/build-board-clusters.cjs が生成した public/data/flop/board-clusters.json
// (全 canonical フロップ → 54 クラスタの最近傍マッピング) をロードし、出題ジェネレータの
// 「クラスタ層化ラウンドロビン抽選」に使うヘルパを提供する。
//
// クラスタ ID は 0..(N-1)。各クラスタは代表ボード 1 枚を持ち、代表は必ず自分のクラスタに属する。

import clustersJson from '../../../public/data/flop/board-clusters.json';
import { canonicalizeBoardName } from '../boardHistory';

interface Representative {
  cluster_id: number;
  board: string;
  label: string;
  size: number;
}
interface ClustersData {
  version: number;
  generated_at: string;
  representatives: Representative[];
  mapping: Record<string, number>;
}

const DATA = clustersJson as ClustersData;
const MAPPING: Record<string, number> = DATA.mapping;
const REPS: Representative[] = DATA.representatives;
const ALL_IDS: number[] = REPS.map((r) => r.cluster_id);

/** ボード (6 文字 "AhTd5c" 等) の所属クラスタ ID。canonical 正規化して引く。未収録は null。 */
export function getClusterId(board: string): number | null {
  let key: string;
  try {
    key = canonicalizeBoardName(board);
  } catch {
    return null;
  }
  const id = MAPPING[key];
  return id === undefined ? null : id;
}

/** クラスタ ID の代表ボード。 */
export function getRepresentative(clusterId: number): string {
  return REPS[clusterId]?.board ?? '';
}

/** 全クラスタ ID (0..N-1)。 */
export function getAllClusterIds(): number[] {
  return [...ALL_IDS];
}

/** クラスタ総数。 */
export const CLUSTER_COUNT = REPS.length;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * pool (ボード文字列の配列) を所属クラスタでグループ化し、ラウンドロビンで count 件抽選する。
 *   - クラスタは「均等確率」(サイズ非依存)。1 周で各クラスタ最大 1 枚 → クラスタ網羅を優先。
 *   - クラスタ内はランダム (毎回同じボードを使い回さない)。
 *   - canonical 単位で重複排除。excludeBoards (canonical 一致) は除外。
 *   - 母集団は pool に限定 (= 収録ボードのみ。母集団外フロップは混入しない)。
 */
export function sampleByClusterRoundRobin(
  pool: ReadonlyArray<string>,
  count: number,
  options: { excludeBoards?: Set<string> } = {},
): string[] {
  const excl = new Set<string>();
  for (const b of options.excludeBoards ?? []) {
    const k = safeCanon(b);
    if (k) excl.add(k);
  }
  const byCluster = new Map<number, string[]>();
  const usedCanon = new Set<string>();
  for (const b of shuffle([...pool])) {
    const k = safeCanon(b);
    if (!k || excl.has(k) || usedCanon.has(k)) continue;
    const cid = MAPPING[k];
    if (cid === undefined) continue;
    usedCanon.add(k);
    const g = byCluster.get(cid) ?? [];
    g.push(b);
    byCluster.set(cid, g);
  }
  const order = shuffle([...byCluster.keys()]);
  const out: string[] = [];
  let progressed = true;
  while (out.length < count && progressed) {
    progressed = false;
    for (const cid of order) {
      if (out.length >= count) break;
      const g = byCluster.get(cid);
      if (!g || g.length === 0) continue;
      out.push(g.pop()!);
      progressed = true;
    }
  }
  return out;
}

function safeCanon(board: string): string | null {
  try {
    return canonicalizeBoardName(board);
  } catch {
    return null;
  }
}
