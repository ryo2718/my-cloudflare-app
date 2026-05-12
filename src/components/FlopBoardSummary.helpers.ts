// FlopBoardSummary 用の pure helper。
// component ファイル (.tsx) に同居すると react-refresh/only-export-components rule
// に違反するため切り出し。

/**
 * EV 比較で勝者を判定。同値 or どちらか null/undefined → 両方 false (ニュートラル)。
 */
export function determineWinner(
  oopEv: number | null | undefined,
  ipEv: number | null | undefined,
): { oopWins: boolean; ipWins: boolean } {
  if (oopEv == null || ipEv == null) return { oopWins: false, ipWins: false };
  if (oopEv === ipEv) return { oopWins: false, ipWins: false };
  if (oopEv > ipEv) return { oopWins: true, ipWins: false };
  return { oopWins: false, ipWins: true };
}
