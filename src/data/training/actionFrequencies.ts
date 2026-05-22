// 即時フィードバック / 答え合わせの「アクション頻度内訳」算出 (純関数)。
// ノードのレンジ (hand → 各アクション頻度%) から、表示する行を組み立てる。

import { ACTION_COLORS } from './actionHistory';

const ORDER = ['fold', 'check', 'call', 'raise', 'allin'] as const;
type FreqAction = (typeof ORDER)[number];

const DEFAULT_LABELS: Record<FreqAction, string> = {
  fold: 'フォールド',
  check: 'チェック',
  call: 'コール',
  raise: 'レイズ',
  allin: 'オールイン',
};

export type FreqMap = Record<string, number>;

export interface ActionFrequencyRow {
  action: string;
  label: string;
  /** 0..100 (%)。 */
  pct: number;
}

/** ノード内で1つでも頻度>0のアクションを fold→check→call→raise→allin 順で返す。 */
export function presentNodeActions(hands: Record<string, FreqMap>): string[] {
  return ORDER.filter((a) => Object.values(hands).some((h) => (h[a] ?? 0) > 0));
}

/**
 * 指定ハンドの、ノードに存在するアクションごとの頻度行。
 * ハンドがそのノードのレンジに無ければ全 0% (不明点2)。
 * labels でラベル上書き可 (例 SB open の call → 「リンプ」)。
 */
export function handActionFrequencies(
  hands: Record<string, FreqMap>,
  hand: string,
  labels?: Partial<Record<string, string>>,
): ActionFrequencyRow[] {
  const present = presentNodeActions(hands);
  const s = hands[hand];
  return present.map((a) => ({
    action: a,
    label: labels?.[a] ?? DEFAULT_LABELS[a as FreqAction] ?? a,
    pct: s ? (s[a] ?? 0) : 0,
  }));
}

/**
 * アクション → 横バーの色 (確定配色 ACTION_COLORS を再利用、新色は作らない)。
 * check は call と同色 (緑)。
 */
export function actionBarColor(action: string): string {
  const key = action === 'check' ? 'call' : action;
  const c = (ACTION_COLORS as Record<string, { bg: string }>)[key];
  return c?.bg ?? '#9CA3AF';
}

/** 頻度% → バー塗り幅 (0..100 にクランプ)。 */
export function barWidthPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}
