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
import { loadNodeHands, cachedNodeHands, __testing__ as gtoNodeCacheTesting } from './gtoNodeCache';

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
  /** 5bet ジャム等を黒チップで表示する場合に 'allin'。 */
  variant?: 'allin';
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
  /** スライダーで頻度を問うアクション。raise 軸 (open/3bet, レイズ/チェック2択) か
   *  call 軸 (コール/フォールド2択 = vs5bet)。 */
  sliderAction: 'raise' | 'call';
  /** スライダーの正解頻度 (= strategy[sliderAction])。 */
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

/**
 * EP/LP の複数選択は常に 4 択固定 (中級総合と同じ)。GTO 上 0% のアクションもボタンは表示する。
 * ノード別の出し分け (limp/check 等) は Blind 専用。
 */
export const EP_LP_SELECT_ACTIONS: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'fold'];

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
  // ジャム受け (ep_vs_4bet = vs 5bet) は最大3問。空いた4問は open/vs3bet に比率維持で補充
  // (GLOSSARY EP 構成: 6:7 → +2/+2)。合計 20 問は不変。
  ep: [
    { spec: 'ep_open', count: 8 },
    { spec: 'ep_vs_3bet', count: 9 },
    { spec: 'ep_vs_4bet', count: 3 },
  ],
  // lp_vs_4bet は出題対象ハンドが4 (99/77/66/AQo) かつノード間で不均等
  // (CO系は99のみ、77/AQo は1ノードのみ) なため、6題だと鳩の巣原理で必ず重複し、
  // 4題でも稀少ハンドをリトライ内に引けず約1%重複が残る。出題数を 3 に下げて重複を解消し、
  // 空いた3問をプールの広い lp_vs_3bet (distinct 32) へ振替する。合計20は不変。
  lp: [
    { spec: 'lp_open', count: 3 },
    { spec: 'lp_vs_open_btn', count: 3 },
    { spec: 'lp_vs_open_co', count: 2 },
    { spec: 'lp_vs_3bet', count: 9 },
    { spec: 'lp_vs_4bet', count: 3 },
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
  // 取得 + raw キャッシュは共通の gtoNodeCache に委譲。ここでは PositionalStrategy に正規化。
  const hands = await loadNodeHands(file);
  const out: Record<string, PositionalStrategy> = {};
  for (const [h, s] of Object.entries(hands)) out[h] = normalizeStrategy(s);
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
      const tasks: Promise<unknown>[] = filesForMode(mode).map(async (file) => {
        if (cache[file]) return;
        try {
          cache[file] = await fetchNode(file);
        } catch {
          /* 一部ノードが存在しない場合は silent skip */
        }
      });
      // Blind の BB ライト3bet 判定に UTG オープンレンジが要る (共通 raw キャッシュへ)。
      if (mode === 'blind') tasks.push(loadNodeHands(UTG_OPEN_FILE).catch(() => undefined));
      await Promise.all(tasks);
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
// BB ライト3bet バイアス (中級Blind の BB vs open のみ)
// ---------------------------------------------------------------------------

/** UTG オープンレンジ (100% open 判定用)。初級/EP open と同一ファイル。 */
const UTG_OPEN_FILE = 'utg.json';

/** BB vs open シナリオごとの「ライト3bet 下限保証」題数 (合計3)。 */
const LIGHT_3BET_QUOTA: Record<string, number> = {
  bb_vs_open_other: 2,
  bb_vs_open_sb: 1,
};

/**
 * ライト3bet 候補ハンド: 境界帯 ∩ 0<raise<100 ∩ UTG が100%openでない。
 *   - raise=100% の完全確定3betは「当たり前のレイズ」として除外。
 *   - UTG が 100% open するハンドはライト(ブラフ)3betではないため除外。
 *     (UTG データ未ロード時はこの除外を適用しない = グレースフルデグレード)
 */
function lightThreeBetCandidates(hands: Record<string, PositionalStrategy>): Hand[] {
  const utg = cachedNodeHands(UTG_OPEN_FILE);
  return extractBoundaryBand(hands).filter((h) => {
    const r = hands[h]?.raise ?? 0;
    if (!(r > 0 && r < 100)) return false;
    if ((utg?.[h]?.raise ?? 0) >= 100) return false;
    return isHandEligible(h, hands[h]);
  });
}

function pickLightThreeBet(hands: Record<string, PositionalStrategy>): Hand | null {
  const cand = lightThreeBetCandidates(hands);
  return cand.length > 0 ? pickRandom(cand) : null;
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

/** 相手オールインを受けるノードの選択肢。 */
export const CALL_FOLD_ACTIONS: ReadonlyArray<PositionalAction> = ['call', 'fold'];

/**
 * ノードのアクションに raise/allin が一切無い = 相手がオールイン済で「降りるか払う」しかない。
 * (vs 5bet 等。実データ上 ..ai_ ノードは call/fold のみ)
 */
export function facesAllinNode(hands: Record<string, PositionalStrategy>): boolean {
  const a = availableActionsOf(hands);
  return a.length > 0 && !a.includes('raise') && !a.includes('allin');
}

/**
 * 複数選択の選択肢 (hands 由来)。limp 系ノード以外 (EP/LP + 非limp Blind) に適用。
 *   - 相手オールイン (raise/allin 不可) → コール/フォールド 2 択
 *   - それ以外 → オールイン/レイズ/コール/フォールド 4 択固定
 * 「オールイン/コール/フォールド」等の中途半端な 3 択は決して出さない。
 */
export function positionalSelectActions(hands: Record<string, PositionalStrategy>): PositionalAction[] {
  return facesAllinNode(hands) ? [...CALL_FOLD_ACTIONS] : [...EP_LP_SELECT_ACTIONS];
}

/** 複数選択の選択肢 (ノード未取得時のシナリオ判定版)。vs 5bet → 2 択、それ以外 → 4 択固定。 */
export function positionalSelectActionsByScenario(scenarioKey: string): PositionalAction[] {
  return isVs5betScenario(scenarioKey) ? [...CALL_FOLD_ACTIONS] : [...EP_LP_SELECT_ACTIONS];
}

/**
 * 出題形式の解決。2 択ノードはスライダー形式に統一する (GLOSSARY 選択肢ルール)。
 *   - baseFormat が 'slider' (open / vs open CO 等) → そのまま raise 軸スライダー
 *   - 選択肢が 2 つ → スライダー (能動側を 100% 軸に: raise があれば raise、無ければ call)
 *       コール/フォールド → call 軸、レイズ/チェック → raise 軸
 *   - それ以外 (3択以上) → 複数選択のまま
 */
export function resolveSliderConversion(
  baseFormat: QuestionFormat,
  choices: ReadonlyArray<PositionalAction>,
  strategy: PositionalStrategy,
): { format: QuestionFormat; sliderAction: 'raise' | 'call'; sliderCorrectPct: number } {
  if (baseFormat === 'slider') {
    return { format: 'slider', sliderAction: 'raise', sliderCorrectPct: strategy.raise };
  }
  if (choices.length === 2) {
    const sliderAction: 'raise' | 'call' = choices.includes('raise') ? 'raise' : 'call';
    return {
      format: 'slider',
      sliderAction,
      sliderCorrectPct: sliderAction === 'raise' ? strategy.raise : strategy.call,
    };
  }
  return { format: 'select', sliderAction: 'raise', sliderCorrectPct: strategy.raise };
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
      // opener が 4bet 後に 3bettor の 5bet ジャムを受ける (5bet チップは黒)
      return {
        label: `${hero} 4bet → vs ${tb} 5bet`,
        opener: hero,
        foldedBefore: [...positionsBefore(hero), ...positionsBetween(hero, tb!)],
        chipExtras: [
          { position: hero, amount: FOUR_BET_SIZE },
          { position: tb!, amount: ALLIN_SIZE, variant: 'allin' },
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
  // limp 系ノード (SB open=リンプ / BB vs limp=チェック) のみノード別出し分け。
  // それ以外 (EP/LP + 非limp Blind) は: 相手オールイン→call/fold 2択 / その他→4択固定。
  const choices = spec.limp !== null ? availableActionsOf(hands) : positionalSelectActions(hands);
  // 2 択ノードはスライダー化 (GLOSSARY 選択肢ルール)。
  const conv = resolveSliderConversion(spec.format, choices, strategy);
  return {
    mode,
    scenarioKey: spec.key,
    label: info.label,
    format: conv.format,
    myPosition: c.hero,
    opener: info.opener,
    threeBettor: c.threeBettor,
    foldedBefore: info.foldedBefore,
    chipExtras: info.chipExtras,
    hand,
    cards: handToCards(hand),
    strategy,
    sliderAction: conv.sliderAction,
    sliderCorrectPct: conv.sliderCorrectPct,
    availableActions: choices,
    actionLabels: labelsFor(spec),
    limpAction: spec.limp,
  };
}

const GENERATE_RETRIES = 60;

function generateOne(
  mode: PositionalMode,
  spec: ScenarioSpec,
  seen: Set<string>,
  lightOnly = false,
): PositionalQuestion | null {
  let cands = spec.candidates.filter((c) => cache[c.file] && Object.keys(cache[c.file]).length > 0);
  // ライト3bet 枠は候補を持つノードに限定。
  if (lightOnly) cands = cands.filter((c) => lightThreeBetCandidates(cache[c.file]).length > 0);
  if (cands.length === 0) return null;
  for (let i = 0; i < GENERATE_RETRIES; i++) {
    const c = pickRandom(cands);
    const hands = cache[c.file];
    const hand = lightOnly ? pickLightThreeBet(hands) : pickHand(spec, hands);
    if (!hand) continue;
    // 同一シナリオ内ではハンド重複を排除 (scenario:hand)。プール枯渇時 (例 lp_vs_4bet:
    // ユニーク4 < 6) のみ末尾リトライで重複を許容し、問題数を維持する。
    const key = `${spec.key}:${hand}`;
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
    const quota = LIGHT_3BET_QUOTA[specKey] ?? 0; // BB vs open のライト3bet 下限保証
    for (let i = 0; i < count; i++) {
      const lightOnly = i < quota;
      // ライト3bet 枠が(プール枯渇等で)作れない場合は通常出題にフォールバックし問題数を維持。
      const q = generateOne(mode, spec, seen, lightOnly) ?? (lightOnly ? generateOne(mode, spec, seen, false) : null);
      if (q) out.push(q);
    }
  }
  return shuffle(out);
}

// ---------------------------------------------------------------------------
// 振り返り / 挑戦モード / 間違えた問題集 向けの公開ヘルパー
// ---------------------------------------------------------------------------

export const POSITIONAL_MODES: ReadonlyArray<PositionalMode> = ['ep', 'lp', 'blind'];

/** level.key → PositionalMode。 */
export function positionalModeFromLevelKey(key: string): PositionalMode | null {
  if (key === 'preflop_intermediate_ep') return 'ep';
  if (key === 'preflop_intermediate_lp') return 'lp';
  if (key === 'preflop_intermediate_blind') return 'blind';
  return null;
}

export function positionalTrainingType(mode: PositionalMode): string {
  return `preflop_intermediate_${mode}`;
}

/** vs 5bet シナリオ (EP/LP の opener が 5bet ジャムを受ける) か。 */
export function isVs5betScenario(scenarioKey: string): boolean {
  return scenarioKey === 'ep_vs_4bet' || scenarioKey === 'lp_vs_4bet';
}

export function scenarioFormat(scenarioKey: string): QuestionFormat {
  return SPECS[scenarioKey]?.format ?? 'select';
}

export function scenarioLimp(scenarioKey: string): 'call' | 'check' | null {
  return SPECS[scenarioKey]?.limp ?? null;
}

export function isPositionalScenario(scenarioKey: string): boolean {
  return scenarioKey in SPECS;
}

/** シナリオに対応するアクションラベル (call=リンプ 等の出し分け込み)。 */
export function labelsForScenario(scenarioKey: string): Record<PositionalAction, string> {
  const spec = SPECS[scenarioKey];
  return spec ? labelsFor(spec) : { ...BASE_LABELS };
}

export { availableActionsOf };

/** シナリオ + ポジションから PokerTable 表示情報を再構築。 */
export function positionalTableInfo(
  scenarioKey: string,
  pos: { hero: Position; opener: Position | null; threeBettor?: Position },
): TableInfo {
  const spec = SPECS[scenarioKey];
  if (!spec) {
    return { label: scenarioKey, opener: pos.opener, foldedBefore: [], chipExtras: [] };
  }
  return tableInfo(spec, { file: '', hero: pos.hero, opener: pos.opener, threeBettor: pos.threeBettor });
}

/** シナリオ + ポジションから対応ノードのファイル名を再構築 (challenge 用)。 */
export function positionalNodeFile(
  scenarioKey: string,
  pos: { hero: Position; opener: Position | null; threeBettor?: Position },
): string | null {
  const h = lower(pos.hero);
  const op = pos.opener ? lower(pos.opener) : null;
  const tb = pos.threeBettor ? lower(pos.threeBettor) : null;
  switch (scenarioKey) {
    case 'ep_open':
    case 'lp_open':
      return `${h}.json`;
    case 'sb_open':
      return 'sb.json';
    case 'sb_limp_vs_raise':
      return 'sbc_bbr_sb.json';
    case 'bb_vs_limp':
      return 'sbc_bb.json';
    case 'bb_vs_limp_raise':
      return 'sbc_bbr_sbr_bb.json';
    case 'ep_vs_3bet':
    case 'lp_vs_3bet':
    case 'sb_vs_3bet':
      return tb ? `${h}r_${tb}r_${h}.json` : null;
    case 'ep_vs_4bet':
    case 'lp_vs_4bet':
      return tb ? `${h}r_${tb}r_${h}r_${tb}ai_${h}.json` : null;
    case 'sb_vs_4bet':
    case 'bb_vs_4bet':
      return op ? `${op}r_${h}r_${op}r_${h}.json` : null;
    case 'lp_vs_open_btn':
    case 'lp_vs_open_co':
    case 'sb_vs_open':
    case 'bb_vs_open_other':
    case 'bb_vs_open_sb':
      return op ? `${op}r_${h}.json` : null;
    default:
      return null;
  }
}

/** 指定ノードを取得して hands を返す (キャッシュ利用)。失敗時 null。 */
export async function loadPositionalNode(
  file: string,
): Promise<Record<string, PositionalStrategy> | null> {
  if (cache[file]) return cache[file];
  try {
    cache[file] = await fetchNode(file);
    return cache[file];
  } catch {
    return null;
  }
}

// テスト用に内部を露出
export const __testing__ = {
  cache,
  SPECS,
  resetCache: () => {
    for (const k of Object.keys(cache)) delete cache[k];
    gtoNodeCacheTesting.reset(); // 共通の raw キャッシュもクリア
  },
  buildQuestion,
  pickHand,
  tableInfo,
  availableActionsOf,
  filesForMode,
  lightThreeBetCandidates,
  LIGHT_3BET_QUOTA,
  UTG_OPEN_FILE,
};
