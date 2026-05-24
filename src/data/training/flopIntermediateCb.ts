// フロップトレーニング「中級レンジベット」の出題・採点ロジック。
//   - 全25問・1問2pt・満点50・クリア90% (45pt)。1モードに2形式が混在:
//       CB問題  (複数選択, SRP のみ 15問): プリフロ中級と同じ帯別基礎点採点。
//       Donk問題 (スライダー, SRP4/3bp3/4bp3 = 10問): プリフロ中級と同じ scoreSlider 採点。
//   - データ: public/data/flop/flop_rangebet_v1.json (scripts/build-flop-rangebet.cjs 生成)。
//   - training_type は既存の中級CB (flop_intermediate) をそのまま流用 (サーバ変更不要)。
// ※ファイル名は履歴上 *Cb のままだが、モードは「中級レンジベット」。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';
import { scoreSlider, SLIDER_SKIP_POINTS } from './sliderScoring';

/** ポット種別。CB は SRP のみ、Donk は SRP/3bet/4bet。 */
export type FlopRbPot = 'SRP' | '3bet' | '4bet';
export type FlopDonkPot = 'SRP' | '3bet' | '4bet';

/** バケット別頻度 (0..1)。キー = CB 選択肢ラベル (check / 各サイズ)。 */
export type FlopCbStrat = Record<string, number>;

interface CbBoard {
  variant: string;
  hero: string;
  villain: string;
  pot: 'SRP';
  board: string;
  strat: FlopCbStrat;
}
interface DonkBoard {
  variant: string;
  hero: string;
  villain: string;
  pot: FlopDonkPot;
  board: string;
  donkRate: number; // 0..1 (OOP ディフェンダーの flop 先制ベット率)
}

export interface FlopRbData {
  cb_choices: string[];
  preflop: Record<string, ActionItem[]>;
  cb: CbBoard[];
  donk: Record<FlopDonkPot, DonkBoard[]>;
}

/** CB問題 (複数選択)。 */
export interface FlopCbQuestion {
  kind: 'cb';
  id: number;
  pot: 'SRP';
  variant: string;
  hero: Position;
  villain: Position;
  board: [Card, Card, Card];
  choices: string[];
  strat: FlopCbStrat;
  preflopActions: ActionItem[];
}
/** Donk問題 (スライダー)。 */
export interface FlopDonkQuestion {
  kind: 'donk';
  id: number;
  pot: FlopDonkPot;
  variant: string;
  hero: Position;
  villain: Position;
  board: [Card, Card, Card];
  /** 正解のドンク頻度 (0..1)。 */
  donkRate: number;
  preflopActions: ActionItem[];
}
export type FlopRbQuestion = FlopCbQuestion | FlopDonkQuestion;

/** 回答: 複数選択 (CB) / スライダー (Donk) / スキップ (スライダーのみ)。 */
export type FlopRbResponse =
  | { kind: 'select'; selections: ReadonlyArray<string> }
  | { kind: 'slider'; pct: number }
  | { kind: 'skip' };

/** 1問の回答記録 (結果画面の振り返り用)。 */
export type FlopRbRecord = FlopRbQuestion & {
  recordId: number;
  response: FlopRbResponse;
  finalScore: number; // -1 / 0 / 1 / 2
};

export const FLOP_RB_COUNT = 25;
export const FLOP_RB_POINTS_PER_Q = 2;
export const FLOP_RB_MAX_SCORE = FLOP_RB_COUNT * FLOP_RB_POINTS_PER_Q; // 50
/** クリア = 満点の 90% (= 45pt)。 */
export const FLOP_RB_CLEAR_SCORE = Math.ceil(FLOP_RB_MAX_SCORE * 0.9); // 45

/** CB問題数 (全SRP)。 */
export const FLOP_RB_CB_COUNT = 15;
/** Donk問題の内訳 (合計10。5bp は donk が存在しないため 4bp に含める)。 */
export const FLOP_RB_DONK_DISTRIBUTION: ReadonlyArray<{ pot: FlopDonkPot; count: number }> = [
  { pot: 'SRP', count: 4 },
  { pot: '3bet', count: 3 },
  { pot: '4bet', count: 3 },
];

// ---------------------------------------------------------------------------
// ベットサイズ → 選択肢バケットの丸めルール (SRP の CB 用。build-flop-rangebet.cjs と同一)
// ---------------------------------------------------------------------------

function nearestAnchor(pct: number, anchors: number[]): string {
  let best = anchors[0];
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(pct - a);
    if (d < bestD || (d === bestD && a > best)) {
      best = a;
      bestD = d;
    }
  }
  return String(best);
}

/** SRP のベットサイズ(%pot) を選択肢バケット (33/50/75/125) に丸める。allin/RAI→125。 */
export function flopCbBucket(sizePct: number, allin = false): string {
  if (allin) return '125';
  return nearestAnchor(sizePct, [33, 50, 75, 125]);
}

// ---------------------------------------------------------------------------
// CB問題の採点 (preflopIntermediate と同一方式 + 多数派サイド必須、頻度は 0..1)
// ---------------------------------------------------------------------------

const INSTANT_PENALTY = 0.05; // <5% を選ぶと即 -1
const MISSED_MAJOR = 0.7; // >=70% を取りこぼすと即 -1
const MAJOR_FOR_MAX = 0.2; // 満点は主要 (>=20%) アクションだけで算出 (少数サイズ取りこぼしは減点しない)
const MAJOR_FALLBACK = 0.1;
const BAND_ZERO = 0.1;
const BAND_HALF = 0.2;
const BAND_FULL = 0.7;

export interface FlopCbScore {
  rawScore: number;
  finalScore: number;
  theoreticalMax: number;
}

function bandScore(f: number): number {
  if (f < BAND_ZERO) return 0;
  if (f < BAND_HALF) return 0.5;
  if (f < BAND_FULL) return 1;
  return 2;
}

export function getTheoreticalMax(strat: FlopCbStrat): number {
  const sumOver = (thr: number) => {
    let s = 0;
    for (const f of Object.values(strat)) if (f >= thr) s += bandScore(f);
    return Math.floor(s);
  };
  const major = sumOver(MAJOR_FOR_MAX);
  return major > 0 ? major : sumOver(MAJOR_FALLBACK);
}

function isInstantPenalty(strat: FlopCbStrat, sel: ReadonlyArray<string>): boolean {
  return sel.some((s) => (strat[s] ?? 0) < INSTANT_PENALTY);
}
function isMissedMajor(strat: FlopCbStrat, sel: ReadonlyArray<string>): boolean {
  for (const [k, f] of Object.entries(strat)) if (f >= MISSED_MAJOR && !sel.includes(k)) return true;
  return false;
}
function betTotalOf(strat: FlopCbStrat): number {
  let s = 0;
  for (const [k, f] of Object.entries(strat)) if (k !== 'check') s += f;
  return s;
}
/** 多数派サイド (ベット合計 vs チェック) を外していたら true (毎回チェック/毎回ベット対策)。 */
function isMissedPrimary(strat: FlopCbStrat, sel: ReadonlyArray<string>): boolean {
  const bet = betTotalOf(strat);
  const check = strat.check ?? 0;
  const pickedBet = sel.some((s) => s !== 'check');
  if (bet > check && !pickedBet) return true;
  if (check > bet && !sel.includes('check')) return true;
  return false;
}

/** CB問題 (複数選択) の採点。 */
export function scoreFlopCb(strat: FlopCbStrat, sel: ReadonlyArray<string>): FlopCbScore {
  const theoreticalMax = getTheoreticalMax(strat);
  if (sel.length === 0) return { rawScore: 0, finalScore: 0, theoreticalMax };
  if (isInstantPenalty(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  if (isMissedMajor(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  if (isMissedPrimary(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  let sum = 0;
  for (const s of sel) sum += bandScore(strat[s] ?? 0);
  const rawScore = Math.floor(sum);
  const finalScore = theoreticalMax <= 0 ? 0 : Math.min(2, Math.round((rawScore / theoreticalMax) * 2));
  return { rawScore, finalScore, theoreticalMax };
}

/** 1問の最終スコア (-1/0/1/2)。CB=複数選択採点 / Donk=スライダー採点。 */
export function scoreFlopRb(q: FlopRbQuestion, res: FlopRbResponse): number {
  if (q.kind === 'cb') {
    if (res.kind !== 'select') return 0;
    return scoreFlopCb(q.strat, res.selections).finalScore;
  }
  // donk (slider)
  if (res.kind === 'slider') return scoreSlider(Math.round(q.donkRate * 100), res.pct);
  return SLIDER_SKIP_POINTS; // skip → 0
}

// ---------------------------------------------------------------------------
// データ取得
// ---------------------------------------------------------------------------

const DATA_URL = '/data/flop/flop_rangebet_v1.json';
let cached: FlopRbData | null = null;

export async function loadFlopRbData(): Promise<FlopRbData> {
  if (cached) return cached;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`failed to load flop range-bet data: ${res.status}`);
  cached = (await res.json()) as FlopRbData;
  return cached;
}

// ---------------------------------------------------------------------------
// 出題生成
// ---------------------------------------------------------------------------

function parseBoard(s: string): [Card, Card, Card] {
  const cards: Card[] = [];
  for (let i = 0; i < s.length; i += 2) cards.push({ rank: s[i] as Rank, suit: s[i + 1] as Suit });
  return [cards[0], cards[1], cards[2]];
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

/** pool から count 件を variant:board 重複なしで抽選。 */
function sample<T extends { variant: string; board: string }>(pool: ReadonlyArray<T>, count: number, seen: Set<string>): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    let rec: T | null = null;
    for (let attempt = 0; attempt < 40 && pool.length > 0; attempt++) {
      const cand = pickRandom(pool);
      const key = `${cand.variant}:${cand.board}`;
      if (seen.has(key) && attempt < 30) continue;
      seen.add(key);
      rec = cand;
      break;
    }
    if (rec) out.push(rec);
  }
  return out;
}

/** ロード済みデータから25問を生成 (純粋関数)。CB15(SRP) + Donk10(SRP4/3bp3/4bp3)。 */
export function buildFlopRbQuestions(data: FlopRbData): FlopRbQuestion[] {
  const out: FlopRbQuestion[] = [];
  const seen = new Set<string>();
  let id = 0;
  const preflopOf = (v: string) => data.preflop?.[v] ?? [];

  for (const rec of sample(data.cb ?? [], FLOP_RB_CB_COUNT, seen)) {
    id += 1;
    out.push({
      kind: 'cb',
      id,
      pot: 'SRP',
      variant: rec.variant,
      hero: rec.hero as Position,
      villain: rec.villain as Position,
      board: parseBoard(rec.board),
      choices: data.cb_choices ?? ['check', '33', '50', '75', '125'],
      strat: rec.strat,
      preflopActions: preflopOf(rec.variant),
    });
  }

  for (const { pot, count } of FLOP_RB_DONK_DISTRIBUTION) {
    for (const rec of sample(data.donk?.[pot] ?? [], count, seen)) {
      id += 1;
      out.push({
        kind: 'donk',
        id,
        pot: rec.pot,
        variant: rec.variant,
        hero: rec.hero as Position,
        villain: rec.villain as Position,
        board: parseBoard(rec.board),
        donkRate: rec.donkRate,
        preflopActions: preflopOf(rec.variant),
      });
    }
  }

  return shuffle(out);
}

export async function generateFlopRbQuestions(): Promise<FlopRbQuestion[]> {
  return buildFlopRbQuestions(await loadFlopRbData());
}

/** シナリオラベル: 「{srp|3bp|4bp} {ヒーロー} vs {相手}」。 */
export function flopRbScenarioLabel(q: { pot: FlopRbPot; hero: Position; villain: Position }): string {
  const tag = q.pot === 'SRP' ? 'srp' : q.pot === '3bet' ? '3bp' : '4bp';
  return `${tag} ${q.hero} vs ${q.villain}`;
}

/** テスト用: キャッシュ注入 / クリア。 */
export const __testing__ = {
  setData(d: FlopRbData | null) {
    cached = d;
  },
};
