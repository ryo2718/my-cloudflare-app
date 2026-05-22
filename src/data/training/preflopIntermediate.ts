// プリフロップ中級トレーニング: 4 タイプのシナリオを抽選で 20 問構成。
//
// シナリオタイプ:
//   1. bb_response: 自分=BB、誰かが open (2.5BB)
//   2. vs_3bet: 自分=opener、誰かが 3bet
//   3. vs_4bet: 自分=3bettor、opener が 4bet
//   4. risky_open: 自分=opener、混合戦略を持つハンドのみ
//
// データソース:
//   - bb_response: `{opener}r_bb.json` (5 ファイル)
//   - vs_3bet:     `{opener}r_{3bettor}r_{opener}.json` (15 ファイル)
//   - vs_4bet:     `{opener}r_{3bettor}r_{opener}r_{3bettor}.json` (15 ファイル)
//   - risky_open:  `{opener}.json` (5 ファイル、混合戦略ハンドのみ出題)
//
// 採点 (新ルール追加):
//   - selections に <5% を含む → 即 -1pt
//   - >=70% のアクションを取りこぼし → 即 -1pt (新)
//   - 時間切れ → -1pt
//   - 何も選ばない → 0pt
//   - それ以外: 頻度別基礎点合計 floor → 正規化 (満点 2)

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

export const ACTIONS = ['allin', 'raise', 'call', 'fold'] as const;
export type Action = (typeof ACTIONS)[number];

export type IntermediateScenarioType =
  | 'bb_response'
  | 'vs_3bet'
  | 'vs_4bet'
  | 'middle_vs_open'
  | 'risky_open';

export const VS_OPEN_OPENERS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

const MAJOR_THRESHOLD_PCT = 20;
const INSTANT_PENALTY_THRESHOLD_PCT = 5;
const MISSED_MAJOR_THRESHOLD_PCT = 70;
const SCORE_BANDS = { ZERO: 10, HALF: 20, FULL: 70 } as const;

const TOTAL_QUESTIONS = 20;
const DEDUP_MAX_RETRIES = 8;
const GENERATE_MAX_RETRIES = 50;
const DISTRIBUTION_MAX_RETRIES = 1000;

/** 開額 (テーブル俯瞰図のチップ表示用、bb 単位)。 */
const OPEN_SIZE = 2.5;
const THREE_BET_SIZE = 12;  // 概算: 12bb (BB が 3bet 想定)
const FOUR_BET_SIZE = 30;   // 概算: 30bb

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

interface RawNode { hands: Record<string, HandStrategy> }

export interface ChipExtra {
  position: Position;
  amount: number;
}

export interface IntermediateQuestion {
  scenarioType: IntermediateScenarioType;
  /** 自分のポジション (シナリオ毎)。 */
  myPosition: Position;
  /** open した人 (= 2.5BB のチップ持ち)。risky_open は自分自身。常に non-null。 */
  opener: Position;
  /** 3bet した人 (vs_3bet / vs_4bet で設定)。 */
  threeBettor?: Position;
  /** PokerTable で薄く描画するポジション。 */
  foldedBefore: ReadonlyArray<Position>;
  /** PokerTable に表示する追加チップ (opener と 3bettor 等、複数アクター対応)。 */
  chipExtras?: ReadonlyArray<ChipExtra>;
  hand: Hand;
  cards: [
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
  ];
  strategy: HandStrategy;
}

export interface ScoreBreakdown {
  rawScore: number;
  finalScore: number;
  theoreticalMax: number;
}

export interface ProblemDistribution {
  bb: number;
  vs3bet: number;
  vs4bet: number;
  middleVsOpen: number;
  riskyOpen: number;
}

/** middle_vs_open で自分のポジションになり得るのは BTN / SB のみ (混合戦略が豊富)。 */
export const MIDDLE_VS_OPEN_RESPONDERS: ReadonlyArray<Position> = ['BTN', 'SB'];

// ---------------------------------------------------------------------------
// 採点
// ---------------------------------------------------------------------------

function bandScore(freqPct: number): number {
  if (freqPct < SCORE_BANDS.ZERO) return 0;
  if (freqPct < SCORE_BANDS.HALF) return 0.5;
  if (freqPct < SCORE_BANDS.FULL) return 1;
  return 2;
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

/** 70% 以上の主要アクションを取りこぼしている (新ルール)。 */
export function isMissedMajorAction(
  strategy: HandStrategy,
  selections: ReadonlyArray<Action>,
): boolean {
  for (const a of ACTIONS) {
    if ((strategy[a] ?? 0) >= MISSED_MAJOR_THRESHOLD_PCT && !selections.includes(a)) {
      return true;
    }
  }
  return false;
}

export function getTheoreticalMaxScore(strategy: HandStrategy): number {
  let sum = 0;
  for (const a of ACTIONS) {
    const f = strategy[a] ?? 0;
    if (f < INSTANT_PENALTY_THRESHOLD_PCT) continue;
    sum += bandScore(f);
  }
  return Math.floor(sum);
}

export function normalize(rawScore: number, theoreticalMax: number): number {
  if (theoreticalMax <= 0) return 0;
  return Math.round((rawScore / theoreticalMax) * 2);
}

export function scoreAnswer(
  strategy: HandStrategy,
  selections: ReadonlyArray<Action>,
): ScoreBreakdown {
  const theoreticalMax = getTheoreticalMaxScore(strategy);
  if (selections.length === 0) {
    return { rawScore: 0, finalScore: 0, theoreticalMax };
  }
  if (isInstantPenalty(strategy, selections)) {
    return { rawScore: -1, finalScore: -1, theoreticalMax };
  }
  if (isMissedMajorAction(strategy, selections)) {
    return { rawScore: -1, finalScore: -1, theoreticalMax };
  }
  let sum = 0;
  for (const a of selections) sum += bandScore(strategy[a] ?? 0);
  const rawScore = Math.floor(sum);
  const finalScore = normalize(rawScore, theoreticalMax);
  return { rawScore, finalScore, theoreticalMax };
}

export function scoreTimeout(strategy: HandStrategy): ScoreBreakdown {
  return {
    rawScore: -1,
    finalScore: -1,
    theoreticalMax: getTheoreticalMaxScore(strategy),
  };
}

// ---------------------------------------------------------------------------
// 抽選ロジック
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 4 タイプの問題内訳を抽選 (合計 20 問)。
 *  - bb / vs3bet / vs4bet: 各 4-8 問
 *  - riskyOpen: 2-4 問
 *  - メイン 3 つが 3 以下 NG
 *  - riskyOpen が 1 以下 NG
 * 上限ループ超過時はデフォルト分布。
 */
/**
 * 5 タイプの問題内訳を抽選 (合計 20 問)。
 *   bb: 2-5, vs3bet: 4-6, vs4bet: 4-6, middleVsOpen: 3-5, riskyOpen: 1-3
 */
export function generateProblemDistribution(): ProblemDistribution {
  for (let i = 0; i < DISTRIBUTION_MAX_RETRIES; i++) {
    const bb = randomInt(2, 5);
    const vs3bet = randomInt(4, 6);
    const vs4bet = randomInt(4, 6);
    const middleVsOpen = randomInt(3, 5);
    const riskyOpen = randomInt(1, 3);
    if (bb + vs3bet + vs4bet + middleVsOpen + riskyOpen === 20) {
      return { bb, vs3bet, vs4bet, middleVsOpen, riskyOpen };
    }
  }
  return { bb: 3, vs3bet: 5, vs4bet: 5, middleVsOpen: 5, riskyOpen: 2 };
}

// ---------------------------------------------------------------------------
// フィルタ
// ---------------------------------------------------------------------------

export function countMajorStrategies(strategy: HandStrategy): number {
  let count = 0;
  for (const a of ACTIONS) {
    if ((strategy[a] ?? 0) >= MAJOR_THRESHOLD_PCT) count++;
  }
  return count;
}

export function isHandEligible(hand: Hand, strategy: HandStrategy | undefined): boolean {
  if (!strategy) return false;
  if (getTierOfHand(hand) === null) return false;
  const major = countMajorStrategies(strategy);
  if (major < 1) return false;
  if (major === 1) {
    const maxFreq = Math.max(
      strategy.allin ?? 0, strategy.raise ?? 0, strategy.call ?? 0, strategy.fold ?? 0,
    );
    if (maxFreq >= 99.999) return false;
  }
  return true;
}

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
    ) return false;
  }
  return true;
}

/** 際どい open: open レンジで混合戦略を持つハンドのみ抽出。 */
export function isRiskyOpenHand(strategy: HandStrategy | undefined): boolean {
  if (!strategy) return false;
  const raise = strategy.raise ?? 0;
  const fold = strategy.fold ?? 0;
  // raise/fold が両方とも > 0 で、どちらも < 99.999 (混合戦略)
  if (raise > 0.001 && fold > 0.001 && raise < 99.999 && fold < 99.999) return true;
  return false;
}

// ---------------------------------------------------------------------------
// ペア定義
// ---------------------------------------------------------------------------

/** middle_vs_open 用ペア (responder = BTN or SB)。 */
export const MIDDLE_VS_OPEN_PAIRS: ReadonlyArray<[Position, Position]> = (() => {
  const pairs: [Position, Position][] = [];
  for (let i = 0; i < PREFLOP_ORDER.length; i++) {
    const op = PREFLOP_ORDER[i];
    if (!VS_OPEN_OPENERS.includes(op)) continue;
    for (let j = i + 1; j < PREFLOP_ORDER.length; j++) {
      const re = PREFLOP_ORDER[j];
      if (!MIDDLE_VS_OPEN_RESPONDERS.includes(re)) continue;
      pairs.push([op, re]);
    }
  }
  return pairs;
})();

/** (opener, responder) の有効ペア (opener < responder)。 */
export const VS_3BET_PAIRS: ReadonlyArray<[Position, Position]> = (() => {
  const pairs: [Position, Position][] = [];
  for (let i = 0; i < PREFLOP_ORDER.length; i++) {
    const op = PREFLOP_ORDER[i];
    if (!VS_OPEN_OPENERS.includes(op)) continue;
    for (let j = i + 1; j < PREFLOP_ORDER.length; j++) {
      const re = PREFLOP_ORDER[j];
      pairs.push([op, re]);
    }
  }
  return pairs;
})();

// ---------------------------------------------------------------------------
// データロード
// ---------------------------------------------------------------------------

export type StrategiesByOpener = Partial<Record<Position, Record<string, HandStrategy>>>;
/** vs 3bet / vs 4bet: キー = "OPENER_3BETTOR" */
export type StrategiesByPair = Record<string, Record<string, HandStrategy>>;

const cache = {
  openRanges: {} as StrategiesByOpener,        // {opener}.json
  vsOpenBb: {} as StrategiesByOpener,           // {opener}r_bb.json
  vsOpenMiddle: {} as StrategiesByPair,         // {opener}r_{btn|sb}.json (キー: "opener_responder")
  vs3bet: {} as StrategiesByPair,               // {opener}r_{3bettor}r_{opener}.json
  vs4bet: {} as StrategiesByPair,               // {opener}r_{3bettor}r_{opener}r_{3bettor}.json
};
let loadingPromise: Promise<void> | null = null;

async function fetchNode(file: string): Promise<Record<string, HandStrategy>> {
  const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  const raw = (await res.json()) as RawNode;
  return raw.hands;
}

function pairKey(opener: Position, threeBettor: Position): string {
  return `${opener}_${threeBettor}`;
}

async function loadAllData(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      // open レンジ + BB 応答 + vs 3bet + vs 4bet を並列に
      const tasks: Promise<void>[] = [];
      for (const op of VS_OPEN_OPENERS) {
        if (!cache.openRanges[op]) {
          tasks.push(fetchNode(`${op.toLowerCase()}.json`).then((h) => {
            cache.openRanges[op] = h;
          }));
        }
        if (!cache.vsOpenBb[op]) {
          tasks.push(fetchNode(`${op.toLowerCase()}r_bb.json`).then((h) => {
            cache.vsOpenBb[op] = h;
          }));
        }
      }
      for (const [op, re] of MIDDLE_VS_OPEN_PAIRS) {
        const key = pairKey(op, re);
        if (!cache.vsOpenMiddle[key]) {
          tasks.push(
            fetchNode(`${op.toLowerCase()}r_${re.toLowerCase()}.json`)
              .then((h) => { cache.vsOpenMiddle[key] = h; })
              .catch(() => {}),
          );
        }
      }
      for (const [op, re] of VS_3BET_PAIRS) {
        const key = pairKey(op, re);
        if (!cache.vs3bet[key]) {
          tasks.push(
            fetchNode(`${op.toLowerCase()}r_${re.toLowerCase()}r_${op.toLowerCase()}.json`)
              .then((h) => { cache.vs3bet[key] = h; })
              .catch(() => {}),  // 一部存在しない場合は silent skip
          );
        }
        if (!cache.vs4bet[key]) {
          tasks.push(
            fetchNode(
              `${op.toLowerCase()}r_${re.toLowerCase()}r_${op.toLowerCase()}r_${re.toLowerCase()}.json`,
            )
              .then((h) => { cache.vs4bet[key] = h; })
              .catch(() => {}),
          );
        }
      }
      await Promise.all(tasks);
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

// ---------------------------------------------------------------------------
// 1 問生成: 4 タイプ
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** BB 応答シナリオ。 */
export function generateBBResponseQuestion(data: StrategiesByOpener): IntermediateQuestion {
  const eligibleOpeners = VS_OPEN_OPENERS.filter((op) => {
    const h = data[op];
    return !!h && !isMonotonicRange(h);
  });
  if (eligibleOpeners.length === 0) throw new Error('bb_response: no eligible openers');
  for (let attempt = 0; attempt < GENERATE_MAX_RETRIES; attempt++) {
    const opener = pickRandom(eligibleOpeners);
    const hands = data[opener]!;
    const handStr = pickRandom(Object.keys(hands));
    const hand = handStr as Hand;
    const strategy = hands[handStr];
    if (!isHandEligible(hand, strategy)) continue;
    const foldedBefore = [...positionsBefore(opener), ...positionsBetween(opener, 'BB')];
    return {
      scenarioType: 'bb_response',
      myPosition: 'BB',
      opener,
      foldedBefore,
      chipExtras: [{ position: opener, amount: OPEN_SIZE }],
      hand,
      cards: handToCards(hand),
      strategy,
    };
  }
  throw new Error('bb_response: no eligible hand after retries');
}

/** vs 3bet シナリオ: 自分=opener、誰かが 3bet。 */
export function generateVs3betQuestion(data: StrategiesByPair): IntermediateQuestion {
  const eligibleKeys = Object.keys(data).filter((k) => !isMonotonicRange(data[k]));
  if (eligibleKeys.length === 0) throw new Error('vs_3bet: no eligible pairs');
  for (let attempt = 0; attempt < GENERATE_MAX_RETRIES; attempt++) {
    const key = pickRandom(eligibleKeys);
    const [opener, threeBettor] = key.split('_') as [Position, Position];
    const hands = data[key];
    const handStr = pickRandom(Object.keys(hands));
    const hand = handStr as Hand;
    const strategy = hands[handStr];
    if (!isHandEligible(hand, strategy)) continue;
    // 自分=opener、3bettor は後 → foldedBefore = opener より前のみ
    // (opener と 3bettor の間の人は既に fold 確定)
    const foldedBefore = [
      ...positionsBefore(opener),
      ...positionsBetween(opener, threeBettor),
    ];
    return {
      scenarioType: 'vs_3bet',
      myPosition: opener,
      opener,
      threeBettor,
      foldedBefore,
      chipExtras: [
        { position: opener, amount: OPEN_SIZE },
        { position: threeBettor, amount: THREE_BET_SIZE },
      ],
      hand,
      cards: handToCards(hand),
      strategy,
    };
  }
  throw new Error('vs_3bet: no eligible hand after retries');
}

/** vs 4bet シナリオ: 自分=3bettor、opener が 4bet。 */
export function generateVs4betQuestion(data: StrategiesByPair): IntermediateQuestion {
  const eligibleKeys = Object.keys(data).filter((k) => !isMonotonicRange(data[k]));
  if (eligibleKeys.length === 0) throw new Error('vs_4bet: no eligible pairs');
  for (let attempt = 0; attempt < GENERATE_MAX_RETRIES; attempt++) {
    const key = pickRandom(eligibleKeys);
    const [opener, threeBettor] = key.split('_') as [Position, Position];
    const hands = data[key];
    const handStr = pickRandom(Object.keys(hands));
    const hand = handStr as Hand;
    const strategy = hands[handStr];
    if (!isHandEligible(hand, strategy)) continue;
    const foldedBefore = [
      ...positionsBefore(opener),
      ...positionsBetween(opener, threeBettor),
    ];
    return {
      scenarioType: 'vs_4bet',
      myPosition: threeBettor,
      opener,
      threeBettor,
      foldedBefore,
      chipExtras: [
        { position: opener, amount: FOUR_BET_SIZE },
        { position: threeBettor, amount: THREE_BET_SIZE },
      ],
      hand,
      cards: handToCards(hand),
      strategy,
    };
  }
  throw new Error('vs_4bet: no eligible hand after retries');
}

/**
 * 中間ポジ vs open シナリオ: 自分=BTN or SB、誰かが open に対する応答。
 * フィルタは isHandEligible (主要 1〜3 個、単一 100% 除外)。
 */
export function generateMiddleVsOpenQuestion(data: StrategiesByPair): IntermediateQuestion {
  const eligibleKeys = Object.keys(data).filter((k) => !isMonotonicRange(data[k]));
  if (eligibleKeys.length === 0) throw new Error('middle_vs_open: no eligible pairs');
  for (let attempt = 0; attempt < GENERATE_MAX_RETRIES; attempt++) {
    const key = pickRandom(eligibleKeys);
    const [opener, me] = key.split('_') as [Position, Position];
    const hands = data[key];
    const handStr = pickRandom(Object.keys(hands));
    const hand = handStr as Hand;
    const strategy = hands[handStr];
    if (!isHandEligible(hand, strategy)) continue;
    const foldedBefore = [
      ...positionsBefore(opener),
      ...positionsBetween(opener, me),
    ];
    return {
      scenarioType: 'middle_vs_open',
      myPosition: me,
      opener,
      foldedBefore,
      chipExtras: [{ position: opener, amount: OPEN_SIZE }],
      hand,
      cards: handToCards(hand),
      strategy,
    };
  }
  throw new Error('middle_vs_open: no eligible hand after retries');
}

/** 際どい open シナリオ: 自分=opener、混合戦略ハンドのみ。 */
export function generateRiskyOpenQuestion(data: StrategiesByOpener): IntermediateQuestion {
  // eligible な (opener, hand) ペアを列挙して直接一様抽選する。
  // 旧実装は 169 ハンドからの一様抽選 + isRiskyOpenHand 棄却 (rejection sampling) で、
  // SB の eligible が極小 (2 ハンド) のため稀に GENERATE_MAX_RETRIES を使い切って throw していた。
  // 採択分布は「eligible ペアの一様分布」と数学的に同一なので、直接列挙に置換しても
  // 出題分布 (混合戦略傾向・opener/hand 分布) は変わらず、かつ throw しなくなる。
  const pairs: Array<{ opener: Position; hand: Hand }> = [];
  for (const opener of VS_OPEN_OPENERS) {
    const hands = data[opener];
    if (!hands) continue;
    for (const handStr of Object.keys(hands)) {
      const hand = handStr as Hand;
      if (!isRiskyOpenHand(hands[handStr])) continue;
      if (getTierOfHand(hand) === null) continue;
      pairs.push({ opener, hand });
    }
  }
  if (pairs.length === 0) throw new Error('risky_open: no eligible hand');
  const { opener, hand } = pickRandom(pairs);
  return {
    scenarioType: 'risky_open',
    myPosition: opener,
    opener,
    foldedBefore: positionsBefore(opener),
    chipExtras: [],
    hand,
    cards: handToCards(hand),
    strategy: data[opener]![hand]!,
  };
}

/** 際どい open ハンドの統計を返す (各 opener で何ハンド該当するか)。 */
export function countRiskyOpenHands(data: StrategiesByOpener): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const op of VS_OPEN_OPENERS) {
    const hands = data[op];
    if (!hands) { out[op] = []; continue; }
    out[op] = Object.entries(hands)
      .filter(([h, s]) => isRiskyOpenHand(s) && getTierOfHand(h as Hand) !== null)
      .map(([h]) => h);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 20 問生成 (4 タイプ抽選)
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 同一シナリオ内ではハンド重複を排除する (scenarioType:hand)。
function questionKey(q: IntermediateQuestion): string {
  return `${q.scenarioType}:${q.hand}`;
}

export async function generateIntermediateQuestions(): Promise<IntermediateQuestion[]> {
  void TOTAL_QUESTIONS;
  await loadAllData();
  const dist = generateProblemDistribution();
  const out: IntermediateQuestion[] = [];
  const seen = new Set<string>();

  const addUnique = (gen: () => IntermediateQuestion) => {
    let q = gen();
    let retries = 0;
    while (seen.has(questionKey(q)) && retries < DEDUP_MAX_RETRIES) {
      q = gen();
      retries++;
    }
    seen.add(questionKey(q));
    out.push(q);
  };

  for (let i = 0; i < dist.bb; i++) addUnique(() => generateBBResponseQuestion(cache.vsOpenBb));
  for (let i = 0; i < dist.vs3bet; i++) addUnique(() => generateVs3betQuestion(cache.vs3bet));
  for (let i = 0; i < dist.vs4bet; i++) addUnique(() => generateVs4betQuestion(cache.vs4bet));
  for (let i = 0; i < dist.middleVsOpen; i++) addUnique(() => generateMiddleVsOpenQuestion(cache.vsOpenMiddle));
  for (let i = 0; i < dist.riskyOpen; i++) addUnique(() => generateRiskyOpenQuestion(cache.openRanges));

  return shuffle(out);
}

// 既存ヘルパーの再 export
export { PREFLOP_ORDER };

// テスト用に内部 cache を露出 (vitest からの seed 用)
export const __testing__ = {
  cache,
  resetCache: () => {
    cache.openRanges = {};
    cache.vsOpenBb = {};
    cache.vsOpenMiddle = {};
    cache.vs3bet = {};
    cache.vs4bet = {};
  },
};

// ---------------------------------------------------------------------------
// 既存 API との互換 (旧 BB-only 関数を残す)
// ---------------------------------------------------------------------------

/** 旧 type: BB 応答シナリオの問題タイプ。 */
export type IntermediateScenario = 'vs_open_bb';

/** 旧 API: BB 応答ジェネレータ (テスト互換)。 */
export function generateIntermediateQuestion(
  data: StrategiesByOpener,
): IntermediateQuestion {
  return generateBBResponseQuestion(data);
}

/** 旧型: BB 応答用 strategy map (テスト互換)。 */
export type VsOpenBbStrategies = StrategiesByOpener;

/** 旧 helper: 互換用。 */
export function eligibleOpenersFromData(data: VsOpenBbStrategies): Position[] {
  return VS_OPEN_OPENERS.filter((op) => {
    const h = data[op];
    return !!h && !isMonotonicRange(h);
  });
}

/** 旧 export: VS_OPEN_PAIRS (互換、未使用)。 */
export const VS_OPEN_PAIRS = VS_3BET_PAIRS;

/** 旧 export: VS_OPEN_RESPONDERS (互換、未使用)。 */
export const VS_OPEN_RESPONDERS: ReadonlyArray<Position> = ['HJ', 'CO', 'BTN', 'SB', 'BB'];
