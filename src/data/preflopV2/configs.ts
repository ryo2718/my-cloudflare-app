// Phase 2b': /strategy に統合する 8 コンフィグ (7 gto + 1 legacy 2.5x) の一覧と、
// 3 セレクタ (Stack / Rake / Open) の cascading 解決ヘルパ。
//
// gto 7 つは R2 の新形式 (usePreflopStrategy + 「次の手」ツリーUI) で表示。
// 2.5x は旧データ構造上ツリー化できないため source='legacy' とし、既存の
// scenarios/useStrategy ベースのビューアで表示する (デュアルモード)。

export type Rake = 'NL50' | 'NL500';
export type OpenSize = '2.5x' | 'GTO';
export type ConfigSource = 'gto' | 'legacy';

export interface PreflopV2Config {
  /** R2 / URL の <config> セグメント。 */
  id: string;
  label: string;
  stackBb: number;
  rake: Rake;
  open: OpenSize;
  source: ConfigSource;
}

export const PREFLOP_V2_CONFIGS: ReadonlyArray<PreflopV2Config> = [
  { id: 'cash_20bb_6max_nl500_gto', label: '20bb NL500 GTO', stackBb: 20, rake: 'NL500', open: 'GTO', source: 'gto' },
  { id: 'cash_50bb_6max_nl500_gto', label: '50bb NL500 GTO', stackBb: 50, rake: 'NL500', open: 'GTO', source: 'gto' },
  { id: 'cash_75bb_6max_nl500_gto', label: '75bb NL500 GTO', stackBb: 75, rake: 'NL500', open: 'GTO', source: 'gto' },
  { id: 'cash_100bb_6max_nl500_gto', label: '100bb NL500 GTO', stackBb: 100, rake: 'NL500', open: 'GTO', source: 'gto' },
  { id: 'cash_100bb_6max_nl50_gto', label: '100bb NL50 GTO', stackBb: 100, rake: 'NL50', open: 'GTO', source: 'gto' },
  { id: 'cash_150bb_6max_nl500_gto', label: '150bb NL500 GTO', stackBb: 150, rake: 'NL500', open: 'GTO', source: 'gto' },
  { id: 'cash_200bb_6max_nl500_gto', label: '200bb NL500 GTO', stackBb: 200, rake: 'NL500', open: 'GTO', source: 'gto' },
  // legacy: 旧 public/data/preflop/cash_100bb_6max_nl500_2.5x/ (既存ビューアで表示)
  { id: 'cash_100bb_6max_nl500_2_5x', label: '100bb NL500 2.5x', stackBb: 100, rake: 'NL500', open: '2.5x', source: 'legacy' },
];

export const DEFAULT_CONFIG_ID = 'cash_100bb_6max_nl500_gto';

export function findConfig(id: string): PreflopV2Config | null {
  return PREFLOP_V2_CONFIGS.find((c) => c.id === id) ?? null;
}

export function isGtoConfig(id: string): boolean {
  return findConfig(id)?.source === 'gto';
}

// --- 3 セレクタ cascading (Open 起点 → Rake → Stack) ---

const uniq = <T,>(xs: T[]): T[] => [...new Set(xs)];

/** Open の選択肢 (GTO 優先)。 */
export function openOptions(): OpenSize[] {
  const present = uniq(PREFLOP_V2_CONFIGS.map((c) => c.open));
  return (['GTO', '2.5x'] as OpenSize[]).filter((o) => present.includes(o));
}

/** 指定 Open で有効な Rake。 */
export function rakeOptions(open: OpenSize): Rake[] {
  return uniq(PREFLOP_V2_CONFIGS.filter((c) => c.open === open).map((c) => c.rake)).sort();
}

/** 指定 Open + Rake で有効な Stack (昇順)。 */
export function stackOptions(open: OpenSize, rake: Rake): number[] {
  return uniq(
    PREFLOP_V2_CONFIGS.filter((c) => c.open === open && c.rake === rake).map((c) => c.stackBb),
  ).sort((a, b) => a - b);
}

/**
 * Rake の表示ラベル。レーキ率は高ステーク (NL500) ほど低く「安」、低ステーク
 * (NL50) ほど高く「高」。内部キー (NL50 / NL500) は不変、表示のみ。
 */
export function rakeLabel(rake: Rake): string {
  return rake === 'NL500' ? '安 (NL500)' : '高 (NL50)';
}

/** 3 軸からコンフィグを解決。無効な組み合わせは null。 */
export function resolveConfig(open: OpenSize, rake: Rake, stackBb: number): PreflopV2Config | null {
  return (
    PREFLOP_V2_CONFIGS.find((c) => c.open === open && c.rake === rake && c.stackBb === stackBb) ??
    null
  );
}
