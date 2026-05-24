// フロップトレーニング中級CB の出題・採点ロジック。
//   - 全30問・1問2pt・満点60。複数選択 (プリフロ中級と同じ採点方式)。
//   - 出題内訳: SRP 17 / 3bp 8 / 4bp・5bp 5。
//   - 選択肢 (ポット種別別):
//       SRP     : check / 33 / 50 / 75 / 125
//       3bet    : check / 20 / 33 / 50 / 75 / 125 / ALLIN
//       4bet5bet: check / 10 / 25 / 33 / 50 / ALLIN
//   - データ: public/data/flop/flop_intermediate_cb_v1.json (scripts/build-flop-intermediate-cb.cjs 生成)。
//   - 採点: preflopIntermediate と同一の帯別基礎点 + 正規化。頻度は 0..1 で保持するため
//     しきい値も小数で扱う (5%→0.05 等)。1問の finalScore は -1/0/1/2。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';

export type FlopCbPotCat = 'SRP' | '3bet' | '4bet5bet';
/** ポット種別の表示用 (3bet/4bet/5bet を区別)。 */
export type FlopCbPot = 'SRP' | '3bet' | '4bet' | '5bet';

/** バケット別頻度 (0..1)。キー = 選択肢ラベル (check / 各サイズ / ALLIN)。 */
export type FlopCbStrat = Record<string, number>;

interface BoardRecord {
  variant: string;
  hero: string;
  villain: string;
  pot: FlopCbPot;
  board: string;
  strat: FlopCbStrat;
}

export interface FlopCbData {
  choices: Record<FlopCbPotCat, string[]>;
  preflop: Record<string, ActionItem[]>;
  pots: Record<FlopCbPotCat, BoardRecord[]>;
}

export interface FlopCbQuestion {
  id: number;
  potCat: FlopCbPotCat;
  pot: FlopCbPot;
  variant: string;
  hero: Position;
  villain: Position;
  board: [Card, Card, Card];
  /** この問題の選択肢 (ポット種別別)。 */
  choices: string[];
  /** バケット別頻度 (採点・フィードバック用)。 */
  strat: FlopCbStrat;
  /** アニメ用プリフロップ アクション列。 */
  preflopActions: ActionItem[];
}

/** 回答 (複数選択 or 時間切れ)。 */
export interface FlopCbResponse {
  selections: ReadonlyArray<string>;
  timedOut: boolean;
}

/** 1問の回答記録 (結果画面の振り返り用)。 */
export interface FlopCbRecord extends FlopCbQuestion {
  recordId: number;
  selections: ReadonlyArray<string>;
  timedOut: boolean;
  rawScore: number;
  finalScore: number; // -1 / 0 / 1 / 2
  theoreticalMax: number;
}

export const FLOP_CB_COUNT = 30;
export const FLOP_CB_POINTS_PER_Q = 2;
export const FLOP_CB_MAX_SCORE = FLOP_CB_COUNT * FLOP_CB_POINTS_PER_Q; // 60
/** クリア = 満点の 90% (= 54pt)。 */
export const FLOP_CB_CLEAR_SCORE = Math.ceil(FLOP_CB_MAX_SCORE * 0.9); // 54

/** 出題内訳 (合計30)。 */
export const FLOP_CB_DISTRIBUTION: ReadonlyArray<{ cat: FlopCbPotCat; count: number }> = [
  { cat: 'SRP', count: 17 },
  { cat: '3bet', count: 8 },
  { cat: '4bet5bet', count: 5 },
];

// ---------------------------------------------------------------------------
// ベットサイズ → 選択肢バケットの丸めルール (scripts/build-flop-intermediate-cb.cjs と同一)
//   - SRP     : 33/50/75/125 の最近傍 (同点は大きい方)
//   - 3bet    : 20/33/50/75/125 の最近傍 → 10,25→20 / 100,150→125
//   - 4bet5bet: 50%超は ALLIN、それ以外は 10/25/33/50 の最近傍
//   - RAI/ALLIN: SRP は 125、他は ALLIN
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

/** ベットサイズ(%pot) を potCat の選択肢バケットに丸める。allin=true でオールイン/RAI。 */
export function flopCbBucket(potCat: FlopCbPotCat, sizePct: number, allin = false): string {
  if (allin) return potCat === 'SRP' ? '125' : 'ALLIN';
  if (potCat === 'SRP') return nearestAnchor(sizePct, [33, 50, 75, 125]);
  if (potCat === '3bet') return nearestAnchor(sizePct, [20, 33, 50, 75, 125]);
  if (sizePct > 50) return 'ALLIN'; // 4bet5bet: 50%超は ALLIN
  return nearestAnchor(sizePct, [10, 25, 33, 50]);
}

// ---------------------------------------------------------------------------
// 採点 (preflopIntermediate と同一方式、頻度は 0..1)
// ---------------------------------------------------------------------------

const INSTANT_PENALTY = 0.05; // <5% を選ぶと即 -1
const MISSED_MAJOR = 0.7; // >=70% を取りこぼすと即 -1
// 満点判定は「主要アクション (>=20%) だけ」で算出する (易化)。少数 (<20%) サイズの
// 取りこぼしは減点しない。主要が無いボードのみ >=10% にフォールバック。
const MAJOR_FOR_MAX = 0.2;
const MAJOR_FALLBACK = 0.1;
const BAND_ZERO = 0.1;
const BAND_HALF = 0.2;
const BAND_FULL = 0.7;

export interface FlopCbScore {
  rawScore: number;
  finalScore: number; // -1 / 0 / 1 / 2
  theoreticalMax: number;
}

function bandScore(f: number): number {
  if (f < BAND_ZERO) return 0;
  if (f < BAND_HALF) return 0.5;
  if (f < BAND_FULL) return 1;
  return 2;
}

/** 理論最高点 = 主要アクション (>=20%) の基礎点合計 (少数サイズは要求しない)。 */
export function getTheoreticalMax(strat: FlopCbStrat): number {
  const sumOver = (thr: number) => {
    let s = 0;
    for (const f of Object.values(strat)) if (f >= thr) s += bandScore(f);
    return Math.floor(s);
  };
  const major = sumOver(MAJOR_FOR_MAX);
  return major > 0 ? major : sumOver(MAJOR_FALLBACK);
}

function isInstantPenalty(strat: FlopCbStrat, selections: ReadonlyArray<string>): boolean {
  return selections.some((s) => (strat[s] ?? 0) < INSTANT_PENALTY);
}

function isMissedMajor(strat: FlopCbStrat, selections: ReadonlyArray<string>): boolean {
  for (const [k, f] of Object.entries(strat)) {
    if (f >= MISSED_MAJOR && !selections.includes(k)) return true;
  }
  return false;
}

/** ベット合計頻度 (check 以外の全バケット)。 */
function betTotalOf(strat: FlopCbStrat): number {
  let s = 0;
  for (const [k, f] of Object.entries(strat)) if (k !== 'check') s += f;
  return s;
}

/**
 * 多数派サイド (ベット合計 vs チェック) を取りこぼしているか。
 *   - ベット合計 > チェック なのにベットを1つも選ばない → 取りこぼし (= 毎回チェック対策)。
 *   - チェック > ベット合計 なのにチェックを選ばない → 取りこぼし。
 * サイズが分散して単一バケットが70%未満でも、ベット/チェックの主決定を外したら -1 にする。
 */
function isMissedPrimary(strat: FlopCbStrat, selections: ReadonlyArray<string>): boolean {
  const bet = betTotalOf(strat);
  const check = strat.check ?? 0;
  const pickedBet = selections.some((s) => s !== 'check');
  if (bet > check && !pickedBet) return true;
  if (check > bet && !selections.includes('check')) return true;
  return false;
}

/** 複数選択の採点。プリフロ中級と同じ規則 + 多数派サイド必須 (ベット/チェックの主決定)。 */
export function scoreFlopCb(strat: FlopCbStrat, res: FlopCbResponse): FlopCbScore {
  const theoreticalMax = getTheoreticalMax(strat);
  if (res.timedOut) return { rawScore: -1, finalScore: -1, theoreticalMax };
  const sel = res.selections;
  if (sel.length === 0) return { rawScore: 0, finalScore: 0, theoreticalMax };
  if (isInstantPenalty(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  if (isMissedMajor(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  if (isMissedPrimary(strat, sel)) return { rawScore: -1, finalScore: -1, theoreticalMax };
  let sum = 0;
  for (const s of sel) sum += bandScore(strat[s] ?? 0);
  const rawScore = Math.floor(sum);
  // 少数サイズも選べば raw が max を超え得るので 2 で頭打ち。
  const finalScore = theoreticalMax <= 0 ? 0 : Math.min(2, Math.round((rawScore / theoreticalMax) * 2));
  return { rawScore, finalScore, theoreticalMax };
}

// ---------------------------------------------------------------------------
// データ取得
// ---------------------------------------------------------------------------

const DATA_URL = '/data/flop/flop_intermediate_cb_v1.json';
let cached: FlopCbData | null = null;

export async function loadFlopCbData(): Promise<FlopCbData> {
  if (cached) return cached;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`failed to load flop intermediate CB data: ${res.status}`);
  cached = (await res.json()) as FlopCbData;
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

/** ロード済みデータから30問を生成 (純粋関数)。同一 variant:board は重複させない。 */
export function buildFlopCbQuestions(data: FlopCbData): FlopCbQuestion[] {
  const out: FlopCbQuestion[] = [];
  const seen = new Set<string>();
  let id = 0;
  for (const { cat, count } of FLOP_CB_DISTRIBUTION) {
    const pool = data.pots[cat] ?? [];
    const choices = data.choices[cat] ?? [];
    for (let i = 0; i < count; i++) {
      let rec: BoardRecord | null = null;
      for (let attempt = 0; attempt < 40 && pool.length > 0; attempt++) {
        const cand = pickRandom(pool);
        const key = `${cand.variant}:${cand.board}`;
        if (seen.has(key) && attempt < 30) continue;
        seen.add(key);
        rec = cand;
        break;
      }
      if (!rec) continue;
      id += 1;
      out.push({
        id,
        potCat: cat,
        pot: rec.pot,
        variant: rec.variant,
        hero: rec.hero as Position,
        villain: rec.villain as Position,
        board: parseBoard(rec.board),
        choices,
        strat: rec.strat,
        preflopActions: data.preflop?.[rec.variant] ?? [],
      });
    }
  }
  return shuffle(out);
}

export async function generateFlopCbQuestions(): Promise<FlopCbQuestion[]> {
  return buildFlopCbQuestions(await loadFlopCbData());
}

/** シナリオラベル: 「{srp|3bp|4bp|5bp} {ヒーロー} vs {相手}」。 */
export function flopCbScenarioLabel(q: { pot: FlopCbPot; hero: Position; villain: Position }): string {
  const tag = q.pot === 'SRP' ? 'srp' : q.pot === '3bet' ? '3bp' : q.pot === '4bet' ? '4bp' : '5bp';
  return `${tag} ${q.hero} vs ${q.villain}`;
}

/** テスト用: キャッシュ注入 / クリア。 */
export const __testing__ = {
  setData(d: FlopCbData | null) {
    cached = d;
  },
};
