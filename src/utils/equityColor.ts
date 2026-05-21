// 勝率の勝敗判定 (色分け用)。表示桁 (小数1桁) で丸めた値で比較し、
// 浮動小数点誤差で「ほぼ同値なのに片方が勝ち」になるのを防ぐ。

export type EquityOutcome = 'win' | 'lose' | 'tie';

/** a / b は勝率(%)。who の側が勝ち/負け/引き分けかを返す。 */
export function equityOutcome(a: number, b: number, who: 'a' | 'b'): EquityOutcome {
  const ra = Math.round(a * 10) / 10;
  const rb = Math.round(b * 10) / 10;
  if (ra === rb) return 'tie';
  const mine = who === 'a' ? ra : rb;
  const other = who === 'a' ? rb : ra;
  return mine > other ? 'win' : 'lose';
}
