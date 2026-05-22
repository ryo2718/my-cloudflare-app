// プリフロップ GTO ノード JSON の取得 + ファイル単位キャッシュ (共通ローダ)。
// 以前は preflopBeginner / NodeRangeSection / preflopIntermediatePositional が
// それぞれ独自に fetch + キャッシュしていたものを、この1箇所に集約する。
//
// 挙動 (既存 fetchNode に合わせる):
//   - キャッシュは file 名単位・モジュールスコープ (アプリ起動中ずっと保持)。
//   - fetch が !ok なら throw (取得失敗を呼び出し側が検知できる)。成功時のみキャッシュ。
//   - silent フォールバックが必要な呼び出し側 (NodeRangeSection / loadPositionalNode 等) は
//     呼び出し側で catch して従来どおりの挙動を維持する。

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** ノード JSON の hands の値 (0-100%。check は limp pot ノードのみ)。 */
export interface NodeHandStrategy {
  allin: number;
  raise: number;
  call: number;
  fold: number;
  check?: number;
}
export type NodeHands = Record<string, NodeHandStrategy>;

const cache: Record<string, NodeHands> = {};

/** ノードファイルの hands を取得 (キャッシュ利用)。未取得なら fetch。!ok は throw。 */
export async function loadNodeHands(file: string): Promise<NodeHands> {
  const hit = cache[file];
  if (hit) return hit;
  const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  const raw = (await res.json()) as { hands: NodeHands };
  cache[file] = raw.hands;
  return raw.hands;
}

/** キャッシュ済み hands を同期取得 (未取得は undefined)。 */
export function cachedNodeHands(file: string): NodeHands | undefined {
  return cache[file];
}

export const __testing__ = {
  cache,
  reset(): void {
    for (const k of Object.keys(cache)) delete cache[k];
  },
};
