// プリフロップ初級拡張 (初級 オープン / vs オープン / vs 3bet・4bet) の共通土台。
//   - EV 閾値フィルタ (topPct <= 40)
//   - 優しい採点 (減点なし): select 用 / slider 用
//   - 出題規則ヘルパ (全戦略混合除外 / アクション該当 / レイズ主体 / 境界)
//
// 本フェーズ(2)ではヘルパ・定数のみ用意する。出題ジェネレータ本体 (フェーズ3〜5) と
// 既存の出題・採点ロジックには一切組み込まない。頻度 (freq) は 0-100 のパーセント想定。

import { EV_RANKING } from '../evRanking';
import type { HandStrategy } from './preflopBeginner';
import type { Hand } from '../../types/strategy';

// ---------------------------------------------------------------------------
// EV 閾値
// ---------------------------------------------------------------------------

/** 出題対象とする最大 topPct (これ以下のみ出題)。average ティアの上限まで含む。 */
export const EV_BEGINNER_EXT_MAX_TOPPCT = 40;

/** ハンドが EV 閾値 (topPct <= EV_BEGINNER_EXT_MAX_TOPPCT) を満たすか。未登録は false。 */
export function isEligibleByEvThreshold(hand: Hand): boolean {
  const info = EV_RANKING[hand];
  return info ? info.topPct <= EV_BEGINNER_EXT_MAX_TOPPCT : false;
}

// ---------------------------------------------------------------------------
// 優しい採点 (減点なし)
// ---------------------------------------------------------------------------

/** 「頻度0%」厳密境界。これ以下は 0% 扱い。 */
const FREQ_ZERO_PCT = 0;
/** 「必ず選ぶ」境界 (inclusive)。これ以上のアクションを選ばないと 0pt。 */
const MUST_SELECT_PCT = 80;

const SELECT_ACTIONS = ['allin', 'raise', 'call', 'fold'] as const;

function freqOf(s: HandStrategy, a: string): number {
  return (s as unknown as Record<string, number | undefined>)[a] ?? 0;
}

/**
 * vs オープン / vs 3bet・4bet 用の優しい select 採点。0pt or 1pt (減点なし)。
 *   - 頻度0%のアクションを選んだ → 0pt
 *   - 頻度80%以上のアクションを選ばなかった → 0pt
 *   - それ以外 → 1pt
 */
export function scoreGentleSelect(
  selected: ReadonlyArray<string>,
  freqs: HandStrategy,
): 0 | 1 {
  for (const a of selected) {
    if (freqOf(freqs, a) <= FREQ_ZERO_PCT) return 0; // 0% を選んだ
  }
  for (const a of SELECT_ACTIONS) {
    if (freqOf(freqs, a) >= MUST_SELECT_PCT && !selected.includes(a)) return 0; // 80%+ を漏らした
  }
  return 1;
}

/** スライダー正解判定の既定許容幅 (%)。 */
export const SLIDER_TOLERANCE_BAND = 20;

/**
 * 初級オープン用の優しい slider 採点。0pt or 0.5pt (減点なし)。
 *   - |userValue - gtoValue| <= toleranceBand → 0.5pt (正解)
 *   - それ以外 → 0pt
 * 既存 sliderScoring.ts の banded 採点 (-1/0/1/2, ±10/±20) とは別ロジック (減点なし・1段)。
 */
export function scoreGentleSlider(
  userValue: number,
  gtoValue: number,
  toleranceBand: number = SLIDER_TOLERANCE_BAND,
): 0 | 0.5 {
  return Math.abs(userValue - gtoValue) <= toleranceBand ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// 出題規則ヘルパ
// ---------------------------------------------------------------------------

/** 「明確な major」閾値 (これ以上の頻度を持つアクションがあれば「混合のみ」ではない)。 */
const MAJOR_PCT = 80;

/**
 * 全戦略混合か (80%以上の明確な major を持たない分散状態)。
 *   例: TT raise33/call40/fold27 → true。AA raise100 → false。AA raise85/call15 → false。
 *   B・C の「全戦略混合の除外」に使う。
 */
export function isAllMixedStrategy(s: HandStrategy): boolean {
  const max = Math.max(s.allin ?? 0, s.raise ?? 0, s.call ?? 0, s.fold ?? 0, s.check ?? 0);
  return max < MAJOR_PCT;
}

/**
 * ハンドが指定アクションに該当する戦略 (頻度 > 0) を持つか。
 *   例: 27o vs 3bet で raise を要求 → false (参加しない)。
 *   C の「アクションになっていないハンドの除外」に使う。
 */
export function isHandActiveInAction(s: HandStrategy, requiredAction: string): boolean {
  return freqOf(s, requiredAction) > 0;
}

/** レイズ頻度が閾値以上か。A: SB はレイズ90%以上のハンドのみ出題、に使う。 */
export function isRaiseDominant(s: HandStrategy, threshold: number = 90): boolean {
  return (s.raise ?? 0) >= threshold;
}

/** 境界とみなす raise 頻度の下限・上限 (この範囲 = レイズ/フォールド混合)。 */
export const BOUNDARY_RAISE_LO = 10;
export const BOUNDARY_RAISE_HI = 90;

/**
 * レイズ/フォールド境界 (混合) か。raise が [LO, HI] = どちらにも振り切っていない混合。
 *   A の「境界ハンドは全体の20%まで」に使う。positional の boundaryBand (参加%の連続帯) とは別の、
 *   ハンド単体の raise 混合判定。
 */
export function isBoundary(s: HandStrategy): boolean {
  const raise = s.raise ?? 0;
  return raise >= BOUNDARY_RAISE_LO && raise <= BOUNDARY_RAISE_HI;
}

// ---------------------------------------------------------------------------
// レイズ系判定 (vs オープンのレイズ問題保証に使う)
//   raiseTotal = raise + allin で「レイズ系」を測る。
// ---------------------------------------------------------------------------

/** バリューレイズとみなす raiseTotal の下限 (これ以上 = 強いレイズ主体)。 */
export const VALUE_RAISE_MIN_PCT = 80;
/** ブラフ/セミブラフレイズの raiseTotal 帯 (混合レイズ)。 */
export const BLUFF_RAISE_LO_PCT = 10;
export const BLUFF_RAISE_HI_PCT = 79;
/** ブラフ枠に含めるハンドの最小 topPct (これ未満 = プレミアム級で value 扱い、除外)。 */
export const BLUFF_MIN_TOPPCT = 10;

/** raise + allin の合計頻度 (%)。 */
export function raiseTotal(s: HandStrategy): number {
  return (s.raise ?? 0) + (s.allin ?? 0);
}

/** バリューレイズ系か (raise+allin >= 80%)。 */
export function isValueRaise(s: HandStrategy): boolean {
  return raiseTotal(s) >= VALUE_RAISE_MIN_PCT;
}

/**
 * ブラフ/セミブラフレイズ系か。
 *   - raise+allin が 10〜79% の混合レイズ
 *   - かつ topPct >= 10 (プレミアム/エリート級でない弱めのハンドのレイズ)
 */
export function isBluffOrSemiBluffRaise(s: HandStrategy, topPct: number): boolean {
  const rt = raiseTotal(s);
  return rt >= BLUFF_RAISE_LO_PCT && rt <= BLUFF_RAISE_HI_PCT && topPct >= BLUFF_MIN_TOPPCT;
}
