// フロップトレーニング「中級レンジベット」の出題・採点ロジック。
//   - 全30問・1問2pt・満点60・クリア90% (54pt)。全問 CB(サイズ複数選択)。
//       内訳: SRP 15 / 3bet 10 / 4bet5bet 5 (4bp+5bp 統合)。
//   - コンセプト = ボード × ベット頻度。支配サイズが偏らないよう多様に出題し、
//     即時フィードバック/答え合わせで「正解サイズ構成が近いボード」を併せて紹介する。
//   - データ: public/data/flop/flop_rangebet_v1.json (scripts/build-flop-rangebet.cjs 生成)。
//   - training_type は既存の flop_intermediate をそのまま流用 (サーバ変更不要)。
// ※ファイル名は履歴上 *Cb のまま。採点 (scoreFlopCb 等) は中級CB(個別ハンド) と共用。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';

/** ポット種別 (実際のポット)。 */
export type FlopRbPot = 'SRP' | '3bet' | '4bet' | '5bet';
/** 出題プールのカテゴリ (4bet+5bet は統合)。 */
export type FlopPotCat = 'SRP' | '3bet' | '4bet5bet';

/** バケット別頻度 (0..1)。キー = CB 選択肢ラベル (check / 各サイズ)。 */
export type FlopCbStrat = Record<string, number>;

interface CbBoard {
  variant: string;
  hero: string;
  villain: string;
  pot: FlopRbPot;
  board: string;
  strat: FlopCbStrat;
}

export interface FlopRbData {
  cb_choices: string[];
  preflop: Record<string, ActionItem[]>;
  cb: Record<FlopPotCat, CbBoard[]>;
}

/** 似たサイズ構成のボード (即時FB/答え合わせで紹介)。 */
export interface SimilarBoard {
  board: [Card, Card, Card];
  pot: FlopRbPot;
  strat: FlopCbStrat;
}

/** CB問題 (複数選択)。 */
export interface FlopRbQuestion {
  id: number;
  pot: FlopRbPot;
  variant: string;
  hero: Position;
  villain: Position;
  board: [Card, Card, Card];
  choices: string[];
  strat: FlopCbStrat;
  preflopActions: ActionItem[];
  /** 正解サイズ構成が近いボード (同ポット, 数枚)。 */
  similar: SimilarBoard[];
}

/** 回答: サイズ複数選択。 */
export type FlopRbResponse = { kind: 'select'; selections: ReadonlyArray<string> };

/** 1問の回答記録 (結果画面の振り返り用)。 */
export type FlopRbRecord = FlopRbQuestion & {
  recordId: number;
  response: FlopRbResponse;
  finalScore: number; // -1 / 0 / 1 / 2
};

export const FLOP_RB_POINTS_PER_Q = 2;
/** 出題内訳 (合計30)。 */
export const FLOP_RB_DISTRIBUTION: ReadonlyArray<{ cat: FlopPotCat; count: number }> = [
  { cat: 'SRP', count: 15 },
  { cat: '3bet', count: 10 },
  { cat: '4bet5bet', count: 5 },
];
export const FLOP_RB_COUNT = FLOP_RB_DISTRIBUTION.reduce((s, d) => s + d.count, 0); // 30
export const FLOP_RB_MAX_SCORE = FLOP_RB_COUNT * FLOP_RB_POINTS_PER_Q; // 60
/** クリア = 満点の 90% (= 54pt)。 */
export const FLOP_RB_CLEAR_SCORE = Math.ceil(FLOP_RB_MAX_SCORE * 0.9); // 54
/** 1問あたり紹介する「似たボード」数。 */
export const FLOP_RB_SIMILAR_COUNT = 3;

// ---------------------------------------------------------------------------
// ベットサイズ → 選択肢バケットの丸めルール (build-flop-rangebet.cjs と同一)
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

/** ベットサイズ(%pot) を選択肢バケット (33/50/75/125) に丸める。allin/RAI→125。 */
export function flopCbBucket(sizePct: number, allin = false): string {
  if (allin) return '125';
  return nearestAnchor(sizePct, [33, 50, 75, 125]);
}

// ---------------------------------------------------------------------------
// CB問題の採点 (preflopIntermediate と同一方式 + 多数派サイド必須、頻度は 0..1)
//   ※ 中級CB(個別ハンド, flopPerHandCb) と共用のためシグネチャは変更しない。
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

/** 1問の最終スコア (-1/0/1/2)。 */
export function scoreFlopRb(q: FlopRbQuestion, res: FlopRbResponse): number {
  if (res.kind !== 'select') return 0;
  return scoreFlopCb(q.strat, res.selections).finalScore;
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

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** strat の支配バケット (最頻サイズ。check 含む)。 */
function dominantKey(strat: FlopCbStrat): string {
  let best = '';
  let bestV = -1;
  for (const [k, v] of Object.entries(strat)) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

/** strat 間の L1 距離 (近いほどサイズ構成が似ている)。 */
function stratDistance(a: FlopCbStrat, b: FlopCbStrat, choices: ReadonlyArray<string>): number {
  let d = 0;
  for (const c of choices) d += Math.abs((a[c] ?? 0) - (b[c] ?? 0));
  return d;
}

/**
 * 支配サイズが偏らないよう、pool を支配バケット別にグループ化してラウンドロビンで count 件抽選。
 * 「毎回33%」のような偏りを避ける。variant:board 重複は seen で防ぐ。
 */
function sampleVaried(pool: ReadonlyArray<CbBoard>, count: number, seen: Set<string>): CbBoard[] {
  const groups = new Map<string, CbBoard[]>();
  for (const b of pool) {
    const key = `${b.variant}:${b.board}`;
    if (seen.has(key)) continue;
    const dk = dominantKey(b.strat);
    const g = groups.get(dk) ?? [];
    g.push(b);
    groups.set(dk, g);
  }
  for (const g of groups.values()) shuffle(g);
  const order = shuffle([...groups.keys()]);
  const out: CbBoard[] = [];
  let progressed = true;
  while (out.length < count && progressed) {
    progressed = false;
    for (const dk of order) {
      if (out.length >= count) break;
      const g = groups.get(dk);
      if (!g || g.length === 0) continue;
      const b = g.pop()!;
      seen.add(`${b.variant}:${b.board}`);
      out.push(b);
      progressed = true;
    }
  }
  return out;
}

/** target に正解サイズ構成が近いボードを pool から k 件 (自身は除く)。 */
function findSimilar(
  pool: ReadonlyArray<CbBoard>,
  target: CbBoard,
  choices: ReadonlyArray<string>,
  k: number,
): SimilarBoard[] {
  const scored: { b: CbBoard; d: number }[] = [];
  for (const b of pool) {
    if (b.variant === target.variant && b.board === target.board) continue;
    scored.push({ b, d: stratDistance(target.strat, b.strat, choices) });
  }
  scored.sort((x, y) => x.d - y.d);
  return scored.slice(0, k).map(({ b }) => ({ board: parseBoard(b.board), pot: b.pot, strat: b.strat }));
}

/** ロード済みデータから30問を生成 (純粋関数)。SRP15 / 3bet10 / 4bet5bet5、全問 CB。 */
export function buildFlopRbQuestions(data: FlopRbData): FlopRbQuestion[] {
  const out: FlopRbQuestion[] = [];
  const seen = new Set<string>();
  const choices = data.cb_choices ?? ['check', '33', '50', '75', '125'];
  const preflopOf = (v: string) => data.preflop?.[v] ?? [];
  let id = 0;

  for (const { cat, count } of FLOP_RB_DISTRIBUTION) {
    const pool = data.cb?.[cat] ?? [];
    for (const rec of sampleVaried(pool, count, seen)) {
      id += 1;
      out.push({
        id,
        pot: rec.pot,
        variant: rec.variant,
        hero: rec.hero as Position,
        villain: rec.villain as Position,
        board: parseBoard(rec.board),
        choices,
        strat: rec.strat,
        preflopActions: preflopOf(rec.variant),
        similar: findSimilar(pool, rec, choices, FLOP_RB_SIMILAR_COUNT),
      });
    }
  }

  return shuffle(out);
}

export async function generateFlopRbQuestions(): Promise<FlopRbQuestion[]> {
  return buildFlopRbQuestions(await loadFlopRbData());
}

/** シナリオラベル: 「{srp|3bp|4bp|5bp} {ヒーロー} vs {相手}」。 */
export function flopRbScenarioLabel(q: { pot: FlopRbPot; hero: Position; villain: Position }): string {
  const tag = q.pot === 'SRP' ? 'srp' : q.pot === '3bet' ? '3bp' : q.pot === '4bet' ? '4bp' : '5bp';
  return `${tag} ${q.hero} vs ${q.villain}`;
}

/** テスト用: キャッシュ注入 / クリア。 */
export const __testing__ = {
  setData(d: FlopRbData | null) {
    cached = d;
  },
};
