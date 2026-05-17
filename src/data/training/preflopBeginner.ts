// プリフロップ初級・中級トレーニングの出題ロジック。
//
// 仕様:
//   - 1 セッション 20 問: 前半 10 = open 判定、後半 10 = vs_open 判定
//   - ポジション毎の EV ティア範囲からハンドをランダム抽選 (OPEN_TIER_RANGES / VS_OPEN_TIER_RANGES)
//   - 正解判定: GTO データ (R2 → public/data/preflop) で (raise+call+allin) > 0% なら "participate"
//   - 重複排除: (scenario, position, hand) 単位で重複しないよう N 回までリトライ
//
// データ参照:
//   - open: `/data/preflop/cash_100bb_6max_nl500_2.5x/{pos}.json` (5 ファイル)
//   - vs_open: `{opener}r_{responder}.json` (15 ペア, ORDER の前後関係に従う)
//
// 中級は本ジェネレータの結果をそのまま使用、TrainingPlay 側でタイマーのみ追加。

import type { Position, Hand } from '../../types/strategy';
import type { EvTier } from '../evRanking';
import { pickRandomHandFromTiers } from './tierLookup';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

/** プリフロップアクション順。UTG → … → BB。 */
export const PREFLOP_ORDER: ReadonlyArray<Position> = [
  'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB',
];

/** open 判定で出題する 5 ポジション (BB 除外)。 */
export const OPEN_POSITIONS: ReadonlyArray<Position> = [
  'UTG', 'HJ', 'CO', 'BTN', 'SB',
];

/** vs_open 判定で出題する 5 ポジション (UTG 除外)。 */
export const VS_OPEN_RESPONDERS: ReadonlyArray<Position> = [
  'HJ', 'CO', 'BTN', 'SB', 'BB',
];

/** ポジション別 open 出題ティア (両端含む)。 */
export const OPEN_TIER_RANGES: Readonly<Record<string, ReadonlyArray<EvTier>>> = {
  UTG: ['elite', 'strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  HJ:  ['elite', 'strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  CO:  ['strong', 'good', 'standard', 'average', 'weak', 'marginal', 'poor'],
  BTN: ['good', 'standard', 'average', 'weak', 'marginal', 'poor', 'trash'],
  SB:  ['standard', 'average', 'weak', 'marginal', 'poor', 'trash', 'garbage'],
};

/** vs_open: responder 別の出題ティア。 */
export const VS_OPEN_TIER_RANGES: Readonly<Record<string, ReadonlyArray<EvTier>>> = {
  HJ:  ['elite', 'strong', 'good', 'standard'],
  CO:  ['elite', 'strong', 'good', 'standard'],
  BTN: ['premium', 'elite', 'strong', 'good', 'standard', 'average'],
  SB:  ['premium', 'elite', 'strong', 'good', 'standard', 'average', 'weak'],
  BB:  ['standard', 'average', 'weak', 'marginal', 'poor', 'trash', 'garbage'],
};

const OPEN_COUNT = 10;
const VS_OPEN_COUNT = 10;
const TOTAL_COUNT = OPEN_COUNT + VS_OPEN_COUNT;
const DEDUP_MAX_RETRIES = 8;

/**
 * 初級は混合戦略を出題しない。
 * GTO データは 0-100 スケール (例: { raise: 29, fold: 71 })。
 * fold が EPSILON 未満なら "実質 0%"、100-EPSILON 超なら "実質 100%" と判定。
 */
const ELIGIBLE_EPSILON = 0.1;
const ELIGIBLE_RETRIES = 50;

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export interface HandStrategy {
  /** 0-100, または 0-1 のどちらでもよい (hasAnyParticipation は >0 を見るだけ)。 */
  fold: number;
  call: number;
  raise: number;
  allin: number;
}

interface RawNode {
  hands: Record<string, HandStrategy>;
}

/** open 戦略 (5 ポジション)。 */
export type OpenStrategies = Partial<Record<Position, Record<string, HandStrategy>>>;
/** vs_open 戦略: vsOpen[opener][responder] = hand→strategy。 */
export type VsOpenStrategies = Partial<Record<Position, Partial<Record<Position, Record<string, HandStrategy>>>>>;

export type CorrectAnswer = 'participate' | 'fold';
export type Scenario = 'open' | 'vs_open';

export interface PreflopQuestion {
  scenario: Scenario;
  /** 自分のポジション。 */
  myPosition: Position;
  /** open シナリオでは null。vs_open では opener。 */
  opener: Position | null;
  /** PokerTable で薄表示するポジション集合 (自分より前の fold 済 + opener と自分の間)。 */
  foldedBefore: ReadonlyArray<Position>;
  /** ハンド表記 (AA / AKs / 72o)。 */
  hand: Hand;
  /** 表示用カード。 */
  cards: [
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
    { rank: string; suit: 's' | 'h' | 'd' | 'c' },
  ];
  correct: CorrectAnswer;
}

// ---------------------------------------------------------------------------
// 純粋ヘルパー (テスト容易)
// ---------------------------------------------------------------------------

/** (raise + call + allin) > 0 → "participate"。100% fold のみ "fold"。 (低レベル判定) */
export function hasAnyParticipation(s: HandStrategy | undefined): boolean {
  if (!s) return false;
  return (s.raise ?? 0) + (s.call ?? 0) + (s.allin ?? 0) > 0;
}

/**
 * 初級出題対象判定: fold が「実質 0%」または「実質 100%」のハンドのみ true。
 * 混合戦略 (例: raise 50% / fold 50%) は false → 出題スキップ。
 * 戦略が存在しない (undefined) は「実質 100% fold」とみなして true。
 */
export function isEligibleForBeginner(s: HandStrategy | undefined): boolean {
  if (!s) return true;
  const fold = s.fold ?? 0;
  return fold < ELIGIBLE_EPSILON || fold > 100 - ELIGIBLE_EPSILON;
}

/**
 * eligible なハンドの正解。eligible 前提で fold が EPSILON 未満なら "participate"、
 * それ以外 (= 実質 100% fold) なら "fold"。
 */
export function correctForBeginner(s: HandStrategy | undefined): CorrectAnswer {
  if (!s) return 'fold';
  return (s.fold ?? 0) < ELIGIBLE_EPSILON ? 'participate' : 'fold';
}

/** 指定ポジションより前にアクションするポジション一覧 (= 既に fold した可能性のある席)。 */
export function positionsBefore(pos: Position): Position[] {
  const idx = PREFLOP_ORDER.indexOf(pos);
  if (idx < 0) return [];
  return PREFLOP_ORDER.slice(0, idx) as Position[];
}

/** opener と responder の間 (両端含まず) のポジション = open に call せず fold した席。 */
export function positionsBetween(opener: Position, responder: Position): Position[] {
  const oi = PREFLOP_ORDER.indexOf(opener);
  const ri = PREFLOP_ORDER.indexOf(responder);
  if (oi < 0 || ri < 0 || oi >= ri) return [];
  return PREFLOP_ORDER.slice(oi + 1, ri) as Position[];
}

function pickRandom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** ハンド表記 → PlayingCard 用カード 2 枚。 */
export function handToCards(hand: Hand): PreflopQuestion['cards'] {
  if (hand.length === 2) {
    const r = hand[0];
    return [
      { rank: r, suit: 's' },
      { rank: r, suit: 'h' },
    ];
  }
  const [r1, r2, kind] = hand.split('') as [string, string, 's' | 'o'];
  if (kind === 's') {
    return [
      { rank: r1, suit: 's' },
      { rank: r2, suit: 's' },
    ];
  }
  return [
    { rank: r1, suit: 's' },
    { rank: r2, suit: 'h' },
  ];
}

// ---------------------------------------------------------------------------
// データロード
// ---------------------------------------------------------------------------

const openCache: OpenStrategies = {};
const vsOpenCache: VsOpenStrategies = {};
let loadingPromise: Promise<void> | null = null;

async function fetchNode(url: string): Promise<Record<string, HandStrategy>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  const raw = (await res.json()) as RawNode;
  return raw.hands;
}

/** 全 open + vs_open 戦略を一括ロード (冪等)。 */
async function loadAllStrategies(): Promise<void> {
  const allLoaded =
    OPEN_POSITIONS.every((p) => openCache[p]) &&
    VS_OPEN_PAIRS.every(([o, r]) => vsOpenCache[o]?.[r]);
  if (allLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // open: 5 files
      await Promise.all(
        OPEN_POSITIONS.map(async (pos) => {
          if (openCache[pos]) return;
          const url = `${PREFLOP_DATA_ROOT}/${pos.toLowerCase()}.json`;
          openCache[pos] = await fetchNode(url);
        }),
      );
      // vs_open: 15 files
      await Promise.all(
        VS_OPEN_PAIRS.map(async ([opener, responder]) => {
          if (vsOpenCache[opener]?.[responder]) return;
          const url = `${PREFLOP_DATA_ROOT}/${opener.toLowerCase()}r_${responder.toLowerCase()}.json`;
          const hands = await fetchNode(url);
          if (!vsOpenCache[opener]) vsOpenCache[opener] = {};
          vsOpenCache[opener]![responder] = hands;
        }),
      );
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

/** 有効な (opener, responder) ペア (opener が responder より前)。 */
export const VS_OPEN_PAIRS: ReadonlyArray<[Position, Position]> = (() => {
  const pairs: [Position, Position][] = [];
  for (let oi = 0; oi < PREFLOP_ORDER.length; oi++) {
    const opener = PREFLOP_ORDER[oi];
    if (!OPEN_POSITIONS.includes(opener)) continue;  // BB は open しない
    for (let ri = oi + 1; ri < PREFLOP_ORDER.length; ri++) {
      const responder = PREFLOP_ORDER[ri];
      if (!VS_OPEN_RESPONDERS.includes(responder)) continue;  // UTG 除外
      pairs.push([opener, responder]);
    }
  }
  return pairs;
})();

// ---------------------------------------------------------------------------
// 1 問生成 (純粋関数、戦略データを引数で受ける)
// ---------------------------------------------------------------------------

/**
 * open シナリオの 1 問生成。
 * 混合戦略 (fold が 0% でも 100% でもない) のハンドはスキップして最大 50 回リトライ。
 * 50 回で見つからない場合は例外 (= 該当ポジ × ティアで eligible ハンドが極めて少ない異常状態)。
 */
export function generateOpenQuestion(
  open: OpenStrategies,
): PreflopQuestion {
  for (let attempt = 0; attempt < ELIGIBLE_RETRIES; attempt++) {
    const position = pickRandom(OPEN_POSITIONS);
    const tiers = OPEN_TIER_RANGES[position];
    const hand = pickRandomHandFromTiers(tiers);
    const strategy = open[position]?.[hand];

    if (!isEligibleForBeginner(strategy)) continue;

    return {
      scenario: 'open',
      myPosition: position,
      opener: null,
      foldedBefore: positionsBefore(position),
      hand,
      cards: handToCards(hand),
      correct: correctForBeginner(strategy),
    };
  }
  throw new Error('generateOpenQuestion: no eligible hand after retries');
}

/**
 * vs_open シナリオの 1 問生成。
 * 混合戦略はスキップして最大 50 回リトライ。
 */
export function generateVsOpenQuestion(
  vsOpen: VsOpenStrategies,
): PreflopQuestion {
  for (let attempt = 0; attempt < ELIGIBLE_RETRIES; attempt++) {
    const responder = pickRandom(VS_OPEN_RESPONDERS);
    const possibleOpeners = OPEN_POSITIONS.filter(
      (p) => PREFLOP_ORDER.indexOf(p) < PREFLOP_ORDER.indexOf(responder),
    );
    const opener = pickRandom(possibleOpeners);
    const tiers = VS_OPEN_TIER_RANGES[responder];
    const hand = pickRandomHandFromTiers(tiers);
    const strategy = vsOpen[opener]?.[responder]?.[hand];

    if (!isEligibleForBeginner(strategy)) continue;

    const foldedBefore = [
      ...positionsBefore(opener),
      ...positionsBetween(opener, responder),
    ];

    return {
      scenario: 'vs_open',
      myPosition: responder,
      opener,
      foldedBefore,
      hand,
      cards: handToCards(hand),
      correct: correctForBeginner(strategy),
    };
  }
  throw new Error('generateVsOpenQuestion: no eligible hand after retries');
}

// ---------------------------------------------------------------------------
// 20 問生成
// ---------------------------------------------------------------------------

function questionKey(q: PreflopQuestion): string {
  return `${q.scenario}:${q.myPosition}:${q.hand}`;
}

/** 重複排除付き 10 問を生成 (リトライ上限超過で重複許容)。 */
function generateDedup(
  generator: () => PreflopQuestion,
  count: number,
): PreflopQuestion[] {
  const out: PreflopQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    let q = generator();
    let retries = 0;
    while (seen.has(questionKey(q)) && retries < DEDUP_MAX_RETRIES) {
      q = generator();
      retries++;
    }
    seen.add(questionKey(q));
    out.push(q);
  }
  return out;
}

/** 20 問生成 (前半 10 = open / 後半 10 = vs_open)。シャッフルせず出題順を維持。 */
export async function generatePreflopQuestions(
  count: number = TOTAL_COUNT,
): Promise<PreflopQuestion[]> {
  await loadAllStrategies();

  // count が 20 でない場合も比率を保持
  const openHalf = Math.ceil(count / 2);
  const vsOpenHalf = count - openHalf;

  const openQs = generateDedup(() => generateOpenQuestion(openCache), openHalf);
  const vsOpenQs = generateDedup(() => generateVsOpenQuestion(vsOpenCache), vsOpenHalf);

  return [...openQs, ...vsOpenQs];
}

// テスト用 (Math.random を直接モックする際に shuffle 再現する不要なので未エクスポート)
export const __testing__ = { shuffle };
