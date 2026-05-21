// スライダー形式問題の採点 (純粋関数)。用語定義は ./GLOSSARY.md を参照。
//
// 1 アクション (主に raise) の頻度を 0–100%・10% 刻みで回答。
//   - 正解が端 (0% or 100%):   ±0% → 2pt / ±10% → 1pt / それ以外 → -1pt
//   - 正解が中間 (10–90%):     ±10% → 2pt / ±20% → 1pt / それ以外 → -1pt
//   - 「飛ばす」 → 0pt (満点母数は固定)
//   - 時間切れ → -1pt (既存ルール踏襲)
//
// 1 問素点は -1/0/1/2pt。モード合計は最後に ÷2 (floor) する (呼び出し側)。

/** 1 問の素点 (-1/0/1/2)。 */
export type SliderPoints = -1 | 0 | 1 | 2;

/** 端 (0% / 100%) 判定の許容誤差 (%)。 */
const EXTREME_EPS = 0.5;

/** スライダーの刻み (%)。 */
export const SLIDER_STEP = 10;
export const SLIDER_MIN = 0;
export const SLIDER_MAX = 100;

/** 飛ばし時の素点。 */
export const SLIDER_SKIP_POINTS: SliderPoints = 0;
/** 時間切れ時の素点。 */
export const SLIDER_TIMEOUT_POINTS: SliderPoints = -1;

/** 正解頻度が端 (≈0% または ≈100%) か。 */
export function isExtremeFreq(correctPct: number): boolean {
  return correctPct <= EXTREME_EPS || correctPct >= 100 - EXTREME_EPS;
}

/**
 * スライダー回答の採点。
 * @param correctPct 正解頻度 (GTO の対象アクション %、0–100、小数可)
 * @param answerPct  ユーザー回答 (0,10,…,100)
 */
export function scoreSlider(correctPct: number, answerPct: number): SliderPoints {
  const diff = Math.abs(answerPct - correctPct);
  if (isExtremeFreq(correctPct)) {
    if (diff <= EXTREME_EPS) return 2;       // ±0 (端ぴったり)
    if (diff <= SLIDER_STEP + EXTREME_EPS) return 1;  // ±10
    return -1;
  }
  if (diff <= SLIDER_STEP + EXTREME_EPS) return 2;     // ±10
  if (diff <= 2 * SLIDER_STEP + EXTREME_EPS) return 1; // ±20
  return -1;
}
