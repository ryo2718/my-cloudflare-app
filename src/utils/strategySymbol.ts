// 戦略カード共通ユーティリティ。Open / 3bet 共通で使う。
// - play率 (raise + call) で 4段階に分類
// - グラデーション (赤=raise / 緑=call / 青=fold) を 135度で生成

export type StrategySymbol = '◎' | '○' | '△' | '✕';

export interface SymbolStyle {
  border: string;
  symbolColor: string;
  labelColor: string;
}

/** play率 = raise + call で 4段階に分類 (Open / 3bet 用) */
export function classifyByPlayRate(raise: number, call: number): StrategySymbol {
  const playRate = raise + call;
  if (playRate >= 90) return '◎';
  if (playRate >= 30) return '○';
  if (playRate >= 10) return '△';
  return '✕';
}

/** play率 = allin + raise + call で 4段階に分類 (4bet 用 — jam が play 扱い) */
export function classifyByPlayRateWithAllin(
  raise: number,
  call: number,
  allin: number,
): StrategySymbol {
  const playRate = raise + call + allin;
  if (playRate >= 90) return '◎';
  if (playRate >= 30) return '○';
  if (playRate >= 10) return '△';
  return '✕';
}

/** 記号別の枠・記号文字色・ラベル色 */
export function getSymbolStyle(symbol: StrategySymbol): SymbolStyle {
  switch (symbol) {
    case '◎':
      return { border: '#f87171', symbolColor: '#ef4444', labelColor: '#991b1b' };
    case '○':
      return { border: '#fb923c', symbolColor: '#ea580c', labelColor: '#9a3412' };
    case '△':
      return { border: '#ca8a04', symbolColor: '#a16207', labelColor: '#854d0e' };
    case '✕':
      return { border: '#93c5fd', symbolColor: '#3b82f6', labelColor: '#1e3a8a' };
  }
}

/** R: / C: / AI: のテキストカラー (raise=赤, call=緑, fold=青系, allin=紫) */
export const STRATEGY_TEXT_COLORS = {
  raise: '#b91c1c',
  call: '#047857',
  fold: '#1e40af',
  allin: '#7c3aed',
} as const;

/**
 * カード背景のグラデーション生成 (135度斜め)。
 * - 各色の領域は raise/call/fold の比率で決まる
 * - 単色判定: 98%以上のアクションは単色背景 (グラデの境目を消す)
 * - 引数の値はそれぞれ 0-100 想定。fold 未指定なら 100-raise-call で算出。
 */
export function buildGradient(raise: number, call: number, fold?: number): string {
  const r = Math.max(0, Math.min(100, raise));
  const c = Math.max(0, Math.min(100, call));
  const f = fold !== undefined ? Math.max(0, Math.min(100, fold)) : Math.max(0, 100 - r - c);

  const total = r + c + f;
  if (total === 0) return '#dbeafe'; // 全部0なら青 (安全策)

  // 単色判定 — グラデの境目を見せない
  if (r >= 98) return '#fee2e2'; // raise 単色
  if (c >= 98) return '#d1fae5'; // call 単色
  if (f >= 98) return '#dbeafe'; // fold 単色

  // 比率を 100% に正規化 (allin 等で 100超えたケースの保険)
  const norm = (v: number) => (v / total) * 100;
  const rPct = norm(r);
  const cPct = norm(c);
  // fPct は残り

  const stops: string[] = [];
  let cursor = 0;

  if (r > 0) {
    stops.push(`#fee2e2 0%`);
    cursor = rPct;
    stops.push(`#fee2e2 ${cursor.toFixed(1)}%`);
  }
  if (c > 0) {
    stops.push(`#d1fae5 ${cursor.toFixed(1)}%`);
    cursor += cPct;
    stops.push(`#d1fae5 ${cursor.toFixed(1)}%`);
  }
  // fold (残り)
  stops.push(`#dbeafe ${cursor.toFixed(1)}%`);
  stops.push(`#dbeafe 100%`);

  return `linear-gradient(135deg, ${stops.join(', ')})`;
}

/**
 * 4色グラデ生成 (135度) — allin (紫) 含む 4bet 用。
 * 順序: allin (紫 #ede9fe) → raise (赤 #fee2e2) → call (緑 #d1fae5) → fold (青 #dbeafe)
 */
export function buildGradientWithAllin(
  raise: number,
  call: number,
  allin: number,
  fold?: number,
): string {
  const r = Math.max(0, Math.min(100, raise));
  const c = Math.max(0, Math.min(100, call));
  const a = Math.max(0, Math.min(100, allin));
  const f = fold !== undefined
    ? Math.max(0, Math.min(100, fold))
    : Math.max(0, 100 - r - c - a);

  const total = r + c + a + f;
  if (total === 0) return '#dbeafe';

  // 単色判定
  if (a >= 98) return '#ede9fe';
  if (r >= 98) return '#fee2e2';
  if (c >= 98) return '#d1fae5';
  if (f >= 98) return '#dbeafe';

  const norm = (v: number) => (v / total) * 100;
  const aPct = norm(a);
  const rPct = norm(r);
  const cPct = norm(c);

  const stops: string[] = [];
  let cursor = 0;

  if (a > 0) {
    stops.push(`#ede9fe 0%`);
    cursor = aPct;
    stops.push(`#ede9fe ${cursor.toFixed(1)}%`);
  }
  if (r > 0) {
    stops.push(`#fee2e2 ${cursor.toFixed(1)}%`);
    cursor += rPct;
    stops.push(`#fee2e2 ${cursor.toFixed(1)}%`);
  }
  if (c > 0) {
    stops.push(`#d1fae5 ${cursor.toFixed(1)}%`);
    cursor += cPct;
    stops.push(`#d1fae5 ${cursor.toFixed(1)}%`);
  }
  stops.push(`#dbeafe ${cursor.toFixed(1)}%`);
  stops.push(`#dbeafe 100%`);

  return `linear-gradient(135deg, ${stops.join(', ')})`;
}
