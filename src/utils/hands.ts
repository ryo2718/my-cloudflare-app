export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

export type Rank = typeof RANKS[number];

/**
 * 13×13 マトリクスの (row, col) からハンド名を返す。
 * 対角線=ペア (例: AA), 上三角=suited (例: AKs), 下三角=offsuit (例: AKo)。
 */
export function getHandName(row: number, col: number): string {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return r1 + r2;
  if (row < col) return r1 + r2 + 's';
  return r2 + r1 + 'o';
}

/** ハンドの組み合わせ数 (集約レポート用)。pairs=6, suited=4, offsuit=12. */
export function getCombos(hand: string): number {
  if (hand.length === 2) return 6;
  if (hand.endsWith('s')) return 4;
  return 12;
}
