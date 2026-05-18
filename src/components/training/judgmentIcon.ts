// 中級採点結果のテキスト記号アイコン。
//   +2pt → ◎ (満点)
//   +1pt → ○ (部分点)
//    0pt → △ (わからない / 何も選ばない)
//   -1pt → × (即-1pt または時間切れ)

export function judgmentIcon(finalScore: number): '◎' | '○' | '△' | '×' {
  if (finalScore >= 2) return '◎';
  if (finalScore === 1) return '○';
  if (finalScore === 0) return '△';
  return '×';
}

/** アイコンに対応する基調色 (UI のハイライト用)。 */
export function judgmentColor(finalScore: number): string {
  if (finalScore >= 2) return '#1F4D11';     // 緑系 (満点)
  if (finalScore === 1) return '#6B5A48';    // 茶系 (部分点)
  if (finalScore === 0) return '#5F5E5A';    // 灰系 (△)
  return '#7A2A26';                          // 赤系 (×)
}
