// Phase 2a: 公開する 7 gto config の一覧と表示名。
// R2 上のディレクトリ一覧は取得できないため、ここで明示的に列挙する。
// (cash_*_2.5x の 2 config は新データ側が不完全なため除外 — docs/PREFLOP_STRATEGY_TAB.md 参照)

export interface PreflopV2Config {
  /** R2 上のディレクトリ名 = URL の <config> セグメント。 */
  id: string;
  /** ボタン表示名。 */
  label: string;
}

export const PREFLOP_V2_CONFIGS: ReadonlyArray<PreflopV2Config> = [
  { id: 'cash_20bb_6max_nl500_gto', label: '20bb NL500 GTO' },
  { id: 'cash_50bb_6max_nl500_gto', label: '50bb NL500 GTO' },
  { id: 'cash_75bb_6max_nl500_gto', label: '75bb NL500 GTO' },
  { id: 'cash_100bb_6max_nl500_gto', label: '100bb NL500 GTO' },
  { id: 'cash_100bb_6max_nl50_gto', label: '100bb NL50 GTO' },
  { id: 'cash_150bb_6max_nl500_gto', label: '150bb NL500 GTO' },
  { id: 'cash_200bb_6max_nl500_gto', label: '200bb NL500 GTO' },
];

export function findConfig(id: string): PreflopV2Config | null {
  return PREFLOP_V2_CONFIGS.find((c) => c.id === id) ?? null;
}
