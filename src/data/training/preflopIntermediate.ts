// プリフロップ中級トレーニング (BB 応答) の出題・採点ロジック。
//
// シナリオ: 自分=BB、誰かが (UTG/HJ/CO/BTN/SB) で 2.5BB open している状態で
//           4 アクション (オールイン/レイズ/コール/フォルド) の中から複数選択。
//
// データ:
//   - `/data/preflop/cash_100bb_6max_nl500_2.5x/{opener}r_bb.json` の 5 ファイル
//   - schema: { hands: { "AA": { allin, raise, call, fold } } } で値は 0-100
//
// フィルタ:
//   - ティア表 (evRanking.ts) に存在しないハンドは出題しない
//   - 全ハンド100%戦略のレンジは出題しない (現実的にほぼ起きないが安全策)
//   - 主要戦略 (>= 20%) が 1 個もないハンドは出題しない
//
// 採点:
//   1. ユーザーが「5% 未満」の戦略を選んだ瞬間 finalScore=-1
//   2. それ以外は freq → 基礎点 (5-10% : 0, 10-20% : 0.5, 20-70% : 1, 70%+ : 2) を合計
//   3. rawScore = floor(sum)
//   4. finalScore = round(rawScore / theoreticalMax * 2) (満点 2)
//   5. theoreticalMax は「>=5% の戦略を全部選んだ時」の合計を floor したもの
//
// 時間切れ → finalScore = -1 (時間切れペナルティ)
// 何も選ばない → finalScore = 0

import { getTierOfHand } from './tierLookup';
import type { HandStrategy } from './preflopBeginner';
import {
  PREFLOP_ORDER,
  positionsBefore,
  positionsBetween,
  handToCards,
} from './preflopBeginner';
import type { Hand, Position } from '../../types/strategy';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** 中級で出題するシナリオ = BB が opener に応答。 */
export type IntermediateScenario = 'vs_open_bb';

/** 4 つのアクション (UI 表示順)。 */
export const ACTIONS = ['allin', 'raise', 'call', 'fold'] as const;
export type Action = (typeof ACTIONS)[number];

/** BB に open しうる 5 ポジション。 */
export const VS_OPEN_OPENERS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

/** 主要戦略の閾値 (この値以上 = 主要)。 */
const MAJOR_THRESHOLD_PCT = 20;
/** 戦略を選ぶ最低ライン (この値未満は「選ぶべきでない」)。 */
const INSTANT_PENALTY_THRESHOLD_PCT = 5;
/** 採点バンド境界 (%)。 */
const SCORE_BANDS = {
  ZERO: 10,    // [5, 10) → 0
  HALF: 20,    // [10, 20) → 0.5
  FULL: 70,    // [20, 70) → 1
  // [70, 100] → 2
} as const;

const TOTAL_QUESTIONS = 20;
const DEDUP_MAX_RETRIES = 8;
const GENERATE_MAX_RETRIES = 50;

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface RawNode {
  hands: Record<string, HandStrategy>;
}

/** BB 視点の vs_open 戦略マップ: vsOpenBb[opener] = hand → strategy。 */
export type VsOpenBbStrategies = Partial<Record<Position, Record<string, HandStrategy>>>;

/** 1 問の問題。 */
export interface IntermediateQuestion {
  scenario: IntermediateScenario;
  /** 常に 'BB'。 */
  myPosition: 'BB';
  /** opener (UTG/HJ/CO/BTN/SB)。 */
  opener: Position;
  foldedBefore: ReadonlyArray<Position>;
  hand: Hand;
  cards: [
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
  ];
  /** 正解判定に使う GTO 戦略 (採点・振り返り両方で使用)。 */
  strategy: HandStrategy;
}

/** 採点結果。 */
export interface ScoreBreakdown {
  rawScore: number;
  finalScore: number;
  theoreticalMax: number;
}

// ---------------------------------------------------------------------------
// 純粋ヘルパー: フィルタ
// ---------------------------------------------------------------------------

/** 戦略の主要アクション (>= 20%) の個数。 */
export function countMajorStrategies(strategy: HandStrategy): number {
  let count = 0;
  for (const a of ACTIONS) {
    if ((strategy[a] ?? 0) >= MAJOR_THRESHOLD_PCT) count++;
  }
  return count;
}

/** ハンドが出題対象か。tier 存在 && 主要戦略 1〜3 個。 */
export function isHandEligible(hand: Hand, strategy: HandStrategy | undefined): boolean {
  if (!strategy) return false;
  if (getTierOfHand(hand) === null) return false;
  const major = countMajorStrategies(strategy);
  if (major < 1) return false;
  // 主要戦略 1 個でも、その頻度が 100% ならば「明確すぎる」→ 除外
  if (major === 1) {
    const maxFreq = Math.max(
      strategy.allin ?? 0,
      strategy.raise ?? 0,
      strategy.call ?? 0,
      strategy.fold ?? 0,
    );
    if (maxFreq >= 99.999) return false;
  }
  return true;
}

/** レンジ単位の monotonic 判定: 全ハンドが完全に同じ戦略なら true (= 出題対象外)。 */
export function isMonotonicRange(handsMap: Record<string, HandStrategy>): boolean {
  const entries = Object.entries(handsMap);
  if (entries.length === 0) return true;
  const [, first] = entries[0];
  for (let i = 1; i < entries.length; i++) {
    const [, s] = entries[i];
    if (
      Math.abs((s.allin ?? 0) - (first.allin ?? 0)) > 0.001 ||
      Math.abs((s.raise ?? 0) - (first.raise ?? 0)) > 0.001 ||
      Math.abs((s.call ?? 0) - (first.call ?? 0)) > 0.001 ||
      Math.abs((s.fold ?? 0) - (first.fold ?? 0)) > 0.001
    ) {
      return false;
    }
  }
  return true;
}

/** opener × BB の有効ペアの中で、レンジが monotonic でないものだけを採用。 */
export function eligibleOpenersFromData(data: VsOpenBbStrategies): Position[] {
  const out: Position[] = [];
  for (const op of VS_OPEN_OPENERS) {
    const hands = data[op];
    if (!hands) continue;
    if (isMonotonicRange(hands)) continue;
    out.push(op);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 純粋ヘルパー: 採点
// ---------------------------------------------------------------------------

/** 単一アクションの頻度から基礎点を算出 (%, 0-100 スケール)。 */
function bandScore(freqPct: number): number {
  if (freqPct < SCORE_BANDS.ZERO) return 0;       // [5, 10) → 0
  if (freqPct < SCORE_BANDS.HALF) return 0.5;     // [10, 20)
  if (freqPct < SCORE_BANDS.FULL) return 1;       // [20, 70)
  return 2;                                       // [70, 100]
}

/** ユーザー選択に「5% 未満」のアクションが含まれているか。 */
export function isInstantPenalty(
  strategy: HandStrategy,
  selections: ReadonlyArray<Action>,
): boolean {
  for (const a of selections) {
    if ((strategy[a] ?? 0) < INSTANT_PENALTY_THRESHOLD_PCT) return true;
  }
  return false;
}

/** 理論最高点: >=5% の全アクションを選んだ時の合計を floor したもの。 */
export function getTheoreticalMaxScore(strategy: HandStrategy): number {
  let sum = 0;
  for (const a of ACTIONS) {
    const f = strategy[a] ?? 0;
    if (f < INSTANT_PENALTY_THRESHOLD_PCT) continue;
    sum += bandScore(f);
  }
  return Math.floor(sum);
}

/** 正規化: rawScore を満点 2pt に揃える。theoreticalMax<=0 はゼロ除算回避。 */
export function normalize(rawScore: number, theoreticalMax: number): number {
  if (theoreticalMax <= 0) return 0;
  return Math.round((rawScore / theoreticalMax) * 2);
}

/**
 * 採点本体。
 *  - selections が空 (= 「何も選ばない」確定): finalScore = 0
 *  - selections に <5% の戦略を含む: 即 finalScore = -1
 *  - それ以外: 基礎点合計 floor → 正規化
 */
export function scoreAnswer(
  strategy: HandStrategy,
  selections: ReadonlyArray<Action>,
): ScoreBreakdown {
  const theoreticalMax = getTheoreticalMaxScore(strategy);
  if (selections.length === 0) {
    // "何も選ばない" 確定 (時間切れではない、ユーザー意図的)
    return { rawScore: 0, finalScore: 0, theoreticalMax };
  }
  if (isInstantPenalty(strategy, selections)) {
    return { rawScore: -1, finalScore: -1, theoreticalMax };
  }
  let sum = 0;
  for (const a of selections) {
    sum += bandScore(strategy[a] ?? 0);
  }
  const rawScore = Math.floor(sum);
  const finalScore = normalize(rawScore, theoreticalMax);
  return { rawScore, finalScore, theoreticalMax };
}

/** 時間切れスコア (-1pt 固定)。 */
export function scoreTimeout(strategy: HandStrategy): ScoreBreakdown {
  return {
    rawScore: -1,
    finalScore: -1,
    theoreticalMax: getTheoreticalMaxScore(strategy),
  };
}

// ---------------------------------------------------------------------------
// データロード
// ---------------------------------------------------------------------------

const vsOpenBbCache: VsOpenBbStrategies = {};
let loadingPromise: Promise<void> | null = null;

async function fetchNode(url: string): Promise<Record<string, HandStrategy>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  const raw = (await res.json()) as RawNode;
  return raw.hands;
}

async function loadAllVsOpenBb(): Promise<void> {
  const allLoaded = VS_OPEN_OPENERS.every((p) => vsOpenBbCache[p]);
  if (allLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      await Promise.all(
        VS_OPEN_OPENERS.map(async (op) => {
          if (vsOpenBbCache[op]) return;
          const url = `${PREFLOP_DATA_ROOT}/${op.toLowerCase()}r_bb.json`;
          vsOpenBbCache[op] = await fetchNode(url);
        }),
      );
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

// ---------------------------------------------------------------------------
// 1 問生成 (純粋関数)
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 1 問生成。フィルタ通過するまで最大 GENERATE_MAX_RETRIES 回試行。
 */
export function generateIntermediateQuestion(
  data: VsOpenBbStrategies,
): IntermediateQuestion {
  const eligibleOpeners = eligibleOpenersFromData(data);
  if (eligibleOpeners.length === 0) {
    throw new Error('generateIntermediateQuestion: no eligible opener (all ranges monotonic?)');
  }
  for (let attempt = 0; attempt < GENERATE_MAX_RETRIES; attempt++) {
    const opener = pickRandom(eligibleOpeners);
    const hands = data[opener]!;
    const handNames = Object.keys(hands);
    const handStr = handNames[Math.floor(Math.random() * handNames.length)];
    const hand = handStr as Hand;
    const strategy = hands[handStr];
    if (!isHandEligible(hand, strategy)) continue;

    const foldedBefore = [
      ...positionsBefore(opener),
      ...positionsBetween(opener, 'BB'),
    ];
    return {
      scenario: 'vs_open_bb',
      myPosition: 'BB',
      opener,
      foldedBefore,
      hand,
      cards: handToCards(hand),
      strategy,
    };
  }
  throw new Error('generateIntermediateQuestion: no eligible hand after retries');
}

function questionKey(q: IntermediateQuestion): string {
  return `${q.opener}:${q.hand}`;
}

/** 20 問生成 (重複排除付き)。 */
export async function generateIntermediateQuestions(
  count: number = TOTAL_QUESTIONS,
): Promise<IntermediateQuestion[]> {
  await loadAllVsOpenBb();
  const out: IntermediateQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    let q = generateIntermediateQuestion(vsOpenBbCache);
    let retries = 0;
    while (seen.has(questionKey(q)) && retries < DEDUP_MAX_RETRIES) {
      q = generateIntermediateQuestion(vsOpenBbCache);
      retries++;
    }
    seen.add(questionKey(q));
    out.push(q);
  }
  return out;
}

// 既存ヘルパーの再 export (UI から使う)
export { PREFLOP_ORDER };
