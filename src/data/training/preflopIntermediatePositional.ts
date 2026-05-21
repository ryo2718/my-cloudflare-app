// 中級ポジション別トレーニング (EP / LP / Blind) の問題生成・採点。
// 用語定義は ./GLOSSARY.md を参照。既存「中級総合」(preflopIntermediate.ts) は一切変更しない。
//
// モード構成 (各問素点 -1/0/1/2pt、最後に ÷2 floor):
//   EP   (UTG/HJ, 20問): open 6=スライダー/境界, vs3bet 7=複数選択/全ハンド, vs4bet 7=複数選択/全ハンド
//   LP   (CO/BTN, 20問): open 3=スライダー/境界, vs open(BTN) 3=複数選択/境界, vs open(CO) 2=スライダー/境界,
//                        vs3bet 6=複数選択/境界, vs4bet 6=複数選択/境界
//   Blind(SB/BB, 30問, 全て複数選択/境界): SB open 3, SB limp vs raise 2, SB vs3bet(BBのみ) 3,
//                        SB vs4bet(BB以外) 3, SB vs open 3, BB vs open(SB以外) 6, BB vs open(SB) 3,
//                        BB vs limp(SB) 3, BB vs limp raise(SB) 2, BB vs4bet 2
//
// ヒーロー視点 (確認済):
//   EP/LP vs3bet = opener が 3bet を受ける (raise=4bet)。
//   EP/LP vs4bet = opener が 4bet 後に 5bet ジャムを受ける ({op}r_{tb}r_{op}r_{tb}ai_{op}, call/fold)。
//   Blind vs4bet = SB/BB が 3bettor として opener の 4bet を受ける ({op}r_{hero}r_{op}r_{hero})。

import type { Hand, Position } from '../../types/strategy';
import type { HandStrategy, PreflopQuestion } from './preflopBeginner';
import { PREFLOP_ORDER, positionsBefore, positionsBetween, handToCards } from './preflopBeginner';
import { isHandEligible, scoreAnswer, type Action } from './preflopIntermediate';
import {
  extractBoundaryBand,
  collapseToSlots,
  pickFromSlot,
} from './boundaryBand';
import {
  scoreSlider,
  SLIDER_SKIP_POINTS,
  SLIDER_TIMEOUT_POINTS,
  type SliderPoints,
} from './sliderScoring';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

export type PositionalMode = 'ep' | 'lp' | 'blind';
export type PositionalAction = 'allin' | 'raise' | 'call' | 'check' | 'fold';
export type QuestionFormat = 'slider' | 'select';

/** 5 アクションを保持する戦略 (check 込み)。HandStrategy の上位互換。 */
export interface PositionalStrategy {
  allin: number;
  raise: number;
  call: number;
  check: number;
  fold: number;
}

export interface ChipExtra {
  position: Position;
  amount: number;
}

export interface PositionalQuestion {
  mode: PositionalMode;
  scenarioKey: string;
  /** シナリオピル表示用ラベル。 */
  label: string;
  format: QuestionFormat;
  myPosition: Position;
  opener: Position | null;
  threeBettor?: Position;
  foldedBefore: ReadonlyArray<Position>;
  chipExtras: ReadonlyArray<ChipExtra>;
  hand: Hand;
  cards: PreflopQuestion['cards'];
  strategy: PositionalStrategy;
  // --- slider ---
  /** スライダーで頻度を問うアクション (常に raise)。 */
  sliderAction: 'raise';
  /** スライダーの正解頻度 (= strategy.raise)。 */
  sliderCorrectPct: number;
  // --- select ---
  /** ノードで実際に使われるアクション (UI 出し分け用)。 */
  availableActions: ReadonlyArray<PositionalAction>;
  actionLabels: Record<PositionalAction, string>;
  /** limp 配点緩和の対象アクション (SB open=call, BB vs limp=check)。それ以外 null。 */
  limpAction: 'call' | 'check' | null;
}

export interface ScoreBreakdown {
  rawScore: number;
  finalScore: number;
  theoreticalMax: number;
}

// ---------------------------------------------------------------------------
// 採点
// ---------------------------------------------------------------------------

const POS_ACTIONS: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'check', 'fold'];

// しきい値は preflopIntermediate.ts の複数選択採点と同一 (parity test で担保)。
const BAND_ZERO = 10;
const BAND_HALF = 20;
const BAND_FULL = 70;
const INSTANT_PENALTY_PCT = 5;
const MISSED_MAJOR_PCT = 70;
/** limp 緩和: raise+limp 主体とみなす閾値。 */
const LIMP_RELAX_PARTICIPATE_PCT = 70;
/** limp 緩和: fold 僅少とみなす閾値。 */
const LIMP_RELAX_FOLD_PCT = 5;

function bandScore(freqPct: number): number {
  if (freqPct < BAND_ZERO) return 0;
  if (freqPct < BAND_HALF) return 0.5;
  if (freqPct < BAND_FULL) return 1;
  return 2;
}

function freqOf(s: PositionalStrategy, a: PositionalAction): number {
  return s[a] ?? 0;
}

/**
 * 複数選択の基礎採点 (check 対応版)。preflopIntermediate.scoreAnswer と同一ロジックで、
 * 5 アクション (check 込み) を走査する点だけ拡張。
 */
export function scoreSelectBase(
  s: PositionalStrategy,
  selections: ReadonlyArray<PositionalAction>,
): ScoreBreakdown {
  let max = 0;
  for (const a of POS_ACTIONS) {
    const f = freqOf(s, a);
    if (f >= INSTANT_PENALTY_PCT) max += bandScore(f);
  }
  const theoreticalMax = Math.floor(max);

  if (selections.length === 0) {
    return { rawScore: 0, finalScore: 0, theoreticalMax };
  }
  for (const a of selections) {
    if (freqOf(s, a) < INSTANT_PENALTY_PCT) {
      return { rawScore: -1, finalScore: -1, theoreticalMax };
    }
  }
  for (const a of POS_ACTIONS) {
    if (freqOf(s, a) >= MISSED_MAJOR_PCT && !selections.includes(a)) {
      return { rawScore: -1, finalScore: -1, theoreticalMax };
    }
  }
  let sum = 0;
  for (const a of selections) sum += bandScore(freqOf(s, a));
  const rawScore = Math.floor(sum);
  const finalScore = theoreticalMax <= 0 ? 0 : Math.round((rawScore / theoreticalMax) * 2);
  return { rawScore, finalScore, theoreticalMax };
}

/** limp 緩和の発動条件を満たすか (Blind 専用)。 */
export function limpRelaxApplies(
  s: PositionalStrategy,
  selections: ReadonlyArray<PositionalAction>,
  limpAction: 'call' | 'check',
): boolean {
  const raise = freqOf(s, 'raise');
  const limp = freqOf(s, limpAction);
  const fold = freqOf(s, 'fold');
  if (raise + limp < LIMP_RELAX_PARTICIPATE_PCT) return false; // raise+limp 主体でない
  if (fold >= LIMP_RELAX_FOLD_PCT) return false;               // fold 僅少でない
  if (selections.length === 0) return false;
  // 選択が raise / limp のみ (fold・allin を含まない)
  for (const a of selections) {
    if (a !== 'raise' && a !== limpAction) return false;
  }
  return true;
}

/**
 * Blind の複数選択採点。基礎採点が -1pt のケースで limp 緩和条件を満たせば +1pt に救済。
 */
export function scoreBlindAnswer(
  s: PositionalStrategy,
  selections: ReadonlyArray<PositionalAction>,
  limpAction: 'call' | 'check' | null,
): ScoreBreakdown {
  const base = scoreSelectBase(s, selections);
  if (base.finalScore === -1 && limpAction && limpRelaxApplies(s, selections, limpAction)) {
    return { ...base, rawScore: 1, finalScore: 1 };
  }
  return base;
}

/** 1 問の解答 (回答 / 飛ばし / 時間切れ)。 */
export type PositionalResponse =
  | { kind: 'timeout' }
  | { kind: 'skip' }
  | { kind: 'slider'; pct: number }
  | { kind: 'select'; selections: ReadonlyArray<PositionalAction> };

/** 1 問の素点 (-1/0/1/2) を返す。 */
export function scorePositionalPoints(
  q: PositionalQuestion,
  res: PositionalResponse,
): number {
  if (q.format === 'slider') {
    if (res.kind === 'timeout') return SLIDER_TIMEOUT_POINTS;
    if (res.kind === 'skip') return SLIDER_SKIP_POINTS;
    if (res.kind === 'slider') return scoreSlider(q.sliderCorrectPct, res.pct) as SliderPoints;
    return 0;
  }
  // select
  if (res.kind === 'timeout') return -1;
  if (res.kind !== 'select') return 0;
  if (q.mode === 'blind') {
    return scoreBlindAnswer(q.strategy, res.selections, q.limpAction).finalScore;
  }
  // EP/LP は既存 scoreAnswer を再利用 (check を含まないノードのみ)。
  return scoreAnswer(q.strategy, res.selections as ReadonlyArray<Action>).finalScore;
}

/** 全問素点の合計を ÷2 (floor)、下限 0 でモードスコアにする。 */
export function totalPositionalScore(points: ReadonlyArray<number>): number {
  const sum = points.reduce((a, b) => a + b, 0);
  return Math.max(0, Math.floor(sum / 2));
}

/** モードの満点。 */
export function maxScoreForMode(mode: PositionalMode): number {
  return mode === 'blind' ? 30 : 20;
}

// ---------------------------------------------------------------------------
// シナリオ定義
// ---------------------------------------------------------------------------

const SB: Position = 'SB';
const BB: Position = 'BB';

function lower(p: Position): string {
  return p.toLowerCase();
}
function after(p: Position): Position[] {
  return PREFLOP_ORDER.slice(PREFLOP_ORDER.indexOf(p) + 1) as Position[];
}

interface NodeCandidate {
  file: string;
  hero: Position;
  opener: Position | null;
  threeBettor?: Position;
}

interface ScenarioSpec {
  key: string;
  format: QuestionFormat;
  rule: 'boundary' | 'all';
  limp: 'call' | 'check' | null;
  candidates: NodeCandidate[];
}

const EP_OPENERS: Position[] = ['UTG', 'HJ'];
const LP_OPENERS: Position[] = ['CO', 'BTN'];
const NON_BB_OPENERS: Position[] = ['UTG', 'HJ', 'CO', 'BTN'];
const ALL_OPENERS: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

function openCandidates(openers: Position[]): NodeCandidate[] {
  return openers.map((op) => ({ file: `${lower(op)}.json`, hero: op, opener: null }));
}
/** opener が 3bet を受ける: {op}r_{tb}r_{op}.json */
function vs3betCandidates(openers: Position[]): NodeCandidate[] {
  const out: NodeCandidate[] = [];
  for (const op of openers) {
    for (const tb of after(op)) {
      out.push({ file: `${lower(op)}r_${lower(tb)}r_${lower(op)}.json`, hero: op, opener: op, threeBettor: tb });
    }
  }
  return out;
}
/** opener が 4bet 後に 5bet ジャムを受ける: {op}r_{tb}r_{op}r_{tb}ai_{op}.json */
function vs4betOpenerCandidates(openers: Position[]): NodeCandidate[] {
  const out: NodeCandidate[] = [];
  for (const op of openers) {
    for (const tb of after(op)) {
      out.push({
        file: `${lower(op)}r_${lower(tb)}r_${lower(op)}r_${lower(tb)}ai_${lower(op)}.json`,
        hero: op,
        opener: op,
        threeBettor: tb,
      });
    }
  }
  return out;
}
/** responder が open を受ける: {op}r_{re}.json */
function vsOpenCandidates(openers: Position[], responder: Position): NodeCandidate[] {
  return openers.map((op) => ({ file: `${lower(op)}r_${lower(responder)}.json`, hero: responder, opener: op }));
}
/** hero(3bettor) が opener の 4bet を受ける: {op}r_{hero}r_{op}r_{hero}.json */
function vs4bet3bettorCandidates(openers: Position[], hero: Position): NodeCandidate[] {
  return openers.map((op) => ({
    file: `${lower(op)}r_${lower(hero)}r_${lower(op)}r_${lower(hero)}.json`,
    hero,
    opener: op,
    threeBettor: hero,
  }));
}

const SPECS: Record<string, ScenarioSpec> = {
  // ----- EP -----
  ep_open:    { key: 'ep_open',    format: 'slider', rule: 'boundary', limp: null, candidates: openCandidates(EP_OPENERS) },
  ep_vs_3bet: { key: 'ep_vs_3bet', format: 'select', rule: 'all',      limp: null, candidates: vs3betCandidates(EP_OPENERS) },
  ep_vs_4bet: { key: 'ep_vs_4bet', format: 'select', rule: 'all',      limp: null, candidates: vs4betOpenerCandidates(EP_OPENERS) },
  // ----- LP -----
  lp_open:        { key: 'lp_open',        format: 'slider', rule: 'boundary', limp: null, candidates: openCandidates(LP_OPENERS) },
  lp_vs_open_btn: { key: 'lp_vs_open_btn', format: 'select', rule: 'boundary', limp: null, candidates: vsOpenCandidates(['UTG', 'HJ', 'CO'], 'BTN') },
  lp_vs_open_co:  { key: 'lp_vs_open_co',  format: 'slider', rule: 'boundary', limp: null, candidates: vsOpenCandidates(['UTG', 'HJ'], 'CO') },
  lp_vs_3bet:     { key: 'lp_vs_3bet',     format: 'select', rule: 'boundary', limp: null, candidates: vs3betCandidates(LP_OPENERS) },
  lp_vs_4bet:     { key: 'lp_vs_4bet',     format: 'select', rule: 'boundary', limp: null, candidates: vs4betOpenerCandidates(LP_OPENERS) },
  // ----- Blind -----
  sb_open:           { key: 'sb_open',           format: 'select', rule: 'boundary', limp: 'call',  candidates: [{ file: 'sb.json', hero: SB, opener: null }] },
  sb_limp_vs_raise:  { key: 'sb_limp_vs_raise',  format: 'select', rule: 'boundary', limp: null,    candidates: [{ file: 'sbc_bbr_sb.json', hero: SB, opener: BB }] },
  sb_vs_3bet:        { key: 'sb_vs_3bet',        format: 'select', rule: 'boundary', limp: null,    candidates: [{ file: 'sbr_bbr_sb.json', hero: SB, opener: SB, threeBettor: BB }] },
  sb_vs_4bet:        { key: 'sb_vs_4bet',        format: 'select', rule: 'boundary', limp: null,    candidates: vs4bet3bettorCandidates(NON_BB_OPENERS, SB) },
  sb_vs_open:        { key: 'sb_vs_open',        format: 'select', rule: 'boundary', limp: null,    candidates: vsOpenCandidates(NON_BB_OPENERS, SB) },
  bb_vs_open_other:  { key: 'bb_vs_open_other',  format: 'select', rule: 'boundary', limp: null,    candidates: vsOpenCandidates(NON_BB_OPENERS, BB) },
  bb_vs_open_sb:     { key: 'bb_vs_open_sb',     format: 'select', rule: 'boundary', limp: null,    candidates: [{ file: 'sbr_bb.json', hero: BB, opener: SB }] },
  bb_vs_limp:        { key: 'bb_vs_limp',        format: 'select', rule: 'boundary', limp: 'check', candidates: [{ file: 'sbc_bb.json', hero: BB, opener: null }] },
  bb_vs_limp_raise:  { key: 'bb_vs_limp_raise',  format: 'select', rule: 'boundary', limp: null,    candidates: [{ file: 'sbc_bbr_sbr_bb.json', hero: BB, opener: SB }] },
  bb_vs_4bet:        { key: 'bb_vs_4bet',        format: 'select', rule: 'boundary', limp: null,    candidates: vs4bet3bettorCandidates(ALL_OPENERS, BB) },
};

/** モード別の出題レシピ (シナリオ → 問題数)。合計が満点と一致。 */
export const MODE_RECIPES: Record<PositionalMode, Array<{ spec: string; count: number }>> = {
  ep: [
    { spec: 'ep_open', count: 6 },
    { spec: 'ep_vs_3bet', count: 7 },
    { spec: 'ep_vs_4bet', count: 7 },
  ],
  lp: [
    { spec: 'lp_open', count: 3 },
    { spec: 'lp_vs_open_btn', count: 3 },
    { spec: 'lp_vs_open_co', count: 2 },
    { spec: 'lp_vs_3bet', count: 6 },
    { spec: 'lp_vs_4bet', count: 6 },
  ],
  blind: [
    { spec: 'sb_open', count: 3 },
    { spec: 'sb_limp_vs_raise', count: 2 },
    { spec: 'sb_vs_3bet', count: 3 },
    { spec: 'sb_vs_4bet', count: 3 },
    { spec: 'sb_vs_open', count: 3 },
    { spec: 'bb_vs_open_other', count: 6 },
    { spec: 'bb_vs_open_sb', count: 3 },
    { spec: 'bb_vs_limp', count: 3 },
    { spec: 'bb_vs_limp_raise', count: 2 },
    { spec: 'bb_vs_4bet', count: 2 },
  ],
};

// ---------------------------------------------------------------------------
// データロード
// ---------------------------------------------------------------------------

const cache: Record<string, Record<string, PositionalStrategy>> = {};
let loadingPromise: Promise<void> | null = null;

function normalizeStrategy(raw: HandStrategy): PositionalStrategy {
  const r = raw as HandStrategy & { check?: number };
  return {
    allin: r.allin ?? 0,
    raise: r.raise ?? 0,
    call: r.call ?? 0,
    check: r.check ?? 0,
    fold: r.fold ?? 0,
  };
}

async function fetchNode(file: string): Promise<Record<string, PositionalStrategy>> {
  const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
  if (!res.ok) throw new Error(`failed to load ${file}: ${res.status}`);
  const raw = (await res.json()) as { hands: Record<string, HandStrategy> };
  const out: Record<string, PositionalStrategy> = {};
  for (const [h, s] of Object.entries(raw.hands)) out[h] = normalizeStrategy(s);
  return out;
}

function filesForMode(mode: PositionalMode): string[] {
  const files = new Set<string>();
  for (const { spec } of MODE_RECIPES[mode]) {
    for (const c of SPECS[spec].candidates) files.add(c.file);
  }
  return [...files];
}

async function loadModeData(mode: PositionalMode): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      await Promise.all(
        filesForMode(mode).map(async (file) => {
          if (cache[file]) return;
          try {
            cache[file] = await fetchNode(file);
          } catch {
            /* 一部ノードが存在しない場合は silent skip */
          }
        }),
      );
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

// ---------------------------------------------------------------------------
// 出題ハンド選択
// ---------------------------------------------------------------------------

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

/** spec のルールに従ってノードから出題ハンドを 1 つ選ぶ。候補がなければ null。 */
function pickHand(spec: ScenarioSpec, hands: Record<string, PositionalStrategy>): Hand | null {
  if (spec.rule === 'all') {
    const eligible = (Object.keys(hands) as Hand[]).filter((h) => isHandEligible(h, hands[h]));
    if (eligible.length === 0) return null;
    const slots = collapseToSlots(eligible);
    return pickFromSlot(pickRandom(slots));
  }
  // boundary
  const band = extractBoundaryBand(hands);
  if (band.length === 0) return null;
  if (spec.format === 'select') {
    const eligible = band.filter((h) => isHandEligible(h, hands[h]));
    return pickRandom(eligible.length > 0 ? eligible : band);
  }
  // slider は端 (≈100%/≈0%) も出題対象に含める
  return pickRandom(band);
}

// ---------------------------------------------------------------------------
// 表示情報 (PokerTable 用)
// ---------------------------------------------------------------------------

const OPEN_SIZE = 2.5;
const LIMP_SIZE = 1;
const ISO_RAISE_SIZE = 5;
const THREE_BET_SIZE = 12;
const FOUR_BET_SIZE = 30;
const ALLIN_SIZE = 100;

const BASE_LABELS: Record<PositionalAction, string> = {
  allin: 'オールイン',
  raise: 'レイズ',
  call: 'コール',
  check: 'チェック',
  fold: 'フォールド',
};

function labelsFor(spec: ScenarioSpec): Record<PositionalAction, string> {
  const labels = { ...BASE_LABELS };
  if (spec.limp === 'call') labels.call = 'リンプ'; // SB open の call = リンプ
  return labels;
}

function availableActionsOf(hands: Record<string, PositionalStrategy>): PositionalAction[] {
  const used = new Set<PositionalAction>();
  for (const h of Object.keys(hands)) {
    const s = hands[h];
    for (const a of POS_ACTIONS) if (freqOf(s, a) > 0) used.add(a);
  }
  return POS_ACTIONS.filter((a) => used.has(a));
}

interface TableInfo {
  label: string;
  opener: Position | null;
  foldedBefore: Position[];
  chipExtras: ChipExtra[];
}

function tableInfo(spec: ScenarioSpec, c: NodeCandidate): TableInfo {
  const hero = c.hero;
  const op = c.opener;
  const tb = c.threeBettor;
  switch (spec.key) {
    case 'ep_open':
    case 'lp_open':
      return { label: `${hero} open`, opener: null, foldedBefore: positionsBefore(hero), chipExtras: [] };
    case 'sb_open':
      return { label: 'SB open (raise/limp/fold)', opener: null, foldedBefore: positionsBefore(SB), chipExtras: [] };
    case 'lp_vs_open_btn':
    case 'lp_vs_open_co':
    case 'sb_vs_open':
    case 'bb_vs_open_other':
    case 'bb_vs_open_sb':
      return {
        label: `${hero} vs ${op} open`,
        opener: op,
        foldedBefore: [...positionsBefore(op!), ...positionsBetween(op!, hero)],
        chipExtras: [{ position: op!, amount: OPEN_SIZE }],
      };
    case 'ep_vs_3bet':
    case 'lp_vs_3bet':
    case 'sb_vs_3bet':
      return {
        label: `${hero} open → vs ${tb} 3bet`,
        opener: hero,
        foldedBefore: [...positionsBefore(hero), ...positionsBetween(hero, tb!)],
        chipExtras: [
          { position: hero, amount: OPEN_SIZE },
          { position: tb!, amount: THREE_BET_SIZE },
        ],
      };
    case 'ep_vs_4bet':
    case 'lp_vs_4bet':
      // opener が 4bet 後に 3bettor の 5bet ジャムを受ける
      return {
        label: `${hero} 4bet → vs ${tb} 5bet`,
        opener: hero,
        foldedBefore: [...positionsBefore(hero), ...positionsBetween(hero, tb!)],
        chipExtras: [
          { position: hero, amount: FOUR_BET_SIZE },
          { position: tb!, amount: ALLIN_SIZE },
        ],
      };
    case 'sb_vs_4bet':
    case 'bb_vs_4bet':
      // hero(3bettor) が opener の 4bet を受ける
      return {
        label: `${hero} 3bet → vs ${op} 4bet`,
        opener: op,
        foldedBefore: [...positionsBefore(op!), ...positionsBetween(op!, hero)],
        chipExtras: [
          { position: op!, amount: FOUR_BET_SIZE },
          { position: hero, amount: THREE_BET_SIZE },
        ],
      };
    case 'sb_limp_vs_raise':
      return {
        label: 'SB limp → vs BB raise',
        opener: BB,
        foldedBefore: positionsBefore(SB),
        chipExtras: [
          { position: SB, amount: LIMP_SIZE },
          { position: BB, amount: ISO_RAISE_SIZE },
        ],
      };
    case 'bb_vs_limp':
      return {
        label: 'BB vs SB limp',
        opener: null,
        foldedBefore: positionsBefore(SB),
        chipExtras: [{ position: SB, amount: LIMP_SIZE }],
      };
    case 'bb_vs_limp_raise':
      return {
        label: 'BB vs SB limp-raise',
        opener: SB,
        foldedBefore: positionsBefore(SB),
        chipExtras: [
          { position: SB, amount: THREE_BET_SIZE },
          { position: BB, amount: ISO_RAISE_SIZE },
        ],
      };
    default:
      return { label: spec.key, opener: op ?? null, foldedBefore: [], chipExtras: [] };
  }
}

// ---------------------------------------------------------------------------
// 1 問生成
// ---------------------------------------------------------------------------

function buildQuestion(
  mode: PositionalMode,
  spec: ScenarioSpec,
  c: NodeCandidate,
  hand: Hand,
  hands: Record<string, PositionalStrategy>,
): PositionalQuestion {
  const strategy = hands[hand];
  const info = tableInfo(spec, c);
  return {
    mode,
    scenarioKey: spec.key,
    label: info.label,
    format: spec.format,
    myPosition: c.hero,
    opener: info.opener,
    threeBettor: c.threeBettor,
    foldedBefore: info.foldedBefore,
    chipExtras: info.chipExtras,
    hand,
    cards: handToCards(hand),
    strategy,
    sliderAction: 'raise',
    sliderCorrectPct: strategy.raise,
    availableActions: availableActionsOf(hands),
    actionLabels: labelsFor(spec),
    limpAction: spec.limp,
  };
}

const GENERATE_RETRIES = 60;

function generateOne(
  mode: PositionalMode,
  spec: ScenarioSpec,
  seen: Set<string>,
): PositionalQuestion | null {
  const cands = spec.candidates.filter((c) => cache[c.file] && Object.keys(cache[c.file]).length > 0);
  if (cands.length === 0) return null;
  for (let i = 0; i < GENERATE_RETRIES; i++) {
    const c = pickRandom(cands);
    const hands = cache[c.file];
    const hand = pickHand(spec, hands);
    if (!hand) continue;
    const key = `${c.file}:${hand}`;
    if (seen.has(key) && i < GENERATE_RETRIES - 10) continue;
    seen.add(key);
    return buildQuestion(mode, spec, c, hand, hands);
  }
  return null;
}

/** モードの全問を生成 (シャッフル済)。 */
export async function generatePositionalQuestions(mode: PositionalMode): Promise<PositionalQuestion[]> {
  await loadModeData(mode);
  const out: PositionalQuestion[] = [];
  const seen = new Set<string>();
  for (const { spec: specKey, count } of MODE_RECIPES[mode]) {
    const spec = SPECS[specKey];
    for (let i = 0; i < count; i++) {
      const q = generateOne(mode, spec, seen);
      if (q) out.push(q);
    }
  }
  return shuffle(out);
}

// テスト用に内部を露出
export const __testing__ = {
  cache,
  SPECS,
  resetCache: () => {
    for (const k of Object.keys(cache)) delete cache[k];
  },
  buildQuestion,
  pickHand,
  tableInfo,
  availableActionsOf,
  filesForMode,
};
