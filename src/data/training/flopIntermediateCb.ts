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

// --- ボードのテクスチャ (見た目) 特徴。似たボードを「見た目は多様」に選ぶための軸。 ---
const RANK_ORDER = '23456789TJQKA';

interface Texture {
  rankKey: string; // ランク多重集合 (スート無視)。完全一致=スート違いだけ
  ranks: number[]; // 3枚のランク値
  pairing: string; // trips / paired / unpaired
  suit: string; // mono / twotone / rainbow
  high: string; // A / broadway / mid / low (最高位カード帯)
  span: string; // paired / connected / gappy / wide (繋がり具合)
}

function textureOf(board: string): Texture {
  const ranks = [RANK_ORDER.indexOf(board[0]), RANK_ORDER.indexOf(board[2]), RANK_ORDER.indexOf(board[4])];
  const suits = [board[1], board[3], board[5]];
  const sorted = [...ranks].sort((a, b) => a - b);
  const nRank = new Set(ranks).size;
  const nSuit = new Set(suits).size;
  const top = Math.max(...ranks);
  const pairing = nRank === 1 ? 'trips' : nRank === 2 ? 'paired' : 'unpaired';
  const suit = nSuit === 1 ? 'mono' : nSuit === 2 ? 'twotone' : 'rainbow';
  const high = top === 12 ? 'A' : top >= 8 ? 'broadway' : top >= 4 ? 'mid' : 'low';
  const spanV = sorted[2] - sorted[0];
  const span = pairing !== 'unpaired' ? 'paired' : spanV <= 4 ? 'connected' : spanV <= 8 ? 'gappy' : 'wide';
  return { rankKey: sorted.join(','), ranks, pairing, suit, high, span };
}

/** カテゴリ特徴の相違数 (大きいほど見た目が違う)。 */
function textureDistance(a: Texture, b: Texture): number {
  return (
    (a.pairing !== b.pairing ? 1 : 0) +
    (a.suit !== b.suit ? 1 : 0) +
    (a.high !== b.high ? 1 : 0) +
    (a.span !== b.span ? 1 : 0)
  );
}

/** 共有するランク数 (2以上 = ほぼ同じボード)。 */
function rankOverlap(a: Texture, b: Texture): number {
  const sb = new Set(b.ranks);
  const counted = new Set<number>();
  let n = 0;
  for (const r of a.ranks) if (sb.has(r) && !counted.has(r)) { counted.add(r); n++; }
  return n;
}

/** 酷似ボード判定: ランク多重集合が同じ (スート違いだけ) / 2枚以上ランク共有 (1枚違い)。 */
function isNearDup(a: Texture, b: Texture): boolean {
  return a.rankKey === b.rankKey || rankOverlap(a, b) >= 2;
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

// 「サイズ構成が近い」上位プール幅。この中からテクスチャを散らして選ぶ。
const SIMILAR_BAND = 120;

/**
 * target に「打ち方 (サイズ構成) は近いが見た目は異なる」ボードを k 件選ぶ。
 *   1. サイズ構成 (strat) が近い上位 SIMILAR_BAND 件を母集団に (= 同じ打ち方)。
 *   2. その中からテクスチャの最遠点サンプリングで見た目が散らばるよう貪欲選抜。
 * 酷似ボード (同ランク・1枚違い) は除外し、「違う見た目でも同じ打ち方」を見せる。
 */
function findSimilar(
  pool: ReadonlyArray<CbBoard>,
  target: CbBoard,
  choices: ReadonlyArray<string>,
  k: number,
): SimilarBoard[] {
  const targetTex = textureOf(target.board);
  const band = pool
    .filter((b) => !(b.variant === target.variant && b.board === target.board))
    .map((b) => ({ b, d: stratDistance(target.strat, b.strat, choices), tex: textureOf(b.board) }))
    .filter((x) => !isNearDup(x.tex, targetTex))
    .sort((x, y) => x.d - y.d)
    .slice(0, SIMILAR_BAND);

  const picked: typeof band = [];
  const refs: Texture[] = [targetTex];
  const remaining = [...band];
  while (picked.length < k && remaining.length > 0) {
    let bestIdx = -1;
    let bestDiv = -Infinity;
    let bestStrat = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const t = remaining[i].tex;
      if (refs.some((r) => isNearDup(t, r))) continue; // 既選択とも酷似は避ける
      const minDiv = Math.min(...refs.map((r) => textureDistance(t, r))); // 既選択群から最も近い見た目差
      if (minDiv > bestDiv || (minDiv === bestDiv && remaining[i].d < bestStrat)) {
        bestDiv = minDiv;
        bestStrat = remaining[i].d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break; // 残りが全て既選択と酷似
    const [chosen] = remaining.splice(bestIdx, 1);
    picked.push(chosen);
    refs.push(chosen.tex);
  }
  // 不足時 (プールが小さい場合のみ) は strat 近い順で補完。
  for (const x of remaining) {
    if (picked.length >= k) break;
    picked.push(x);
  }
  return picked.slice(0, k).map(({ b }) => ({ board: parseBoard(b.board), pot: b.pot, strat: b.strat }));
}

// オーバーベット(125)が実戦的 (= この頻度以上) とみなす閾値と、各ポットで最低確保する問数。
// 125 は支配サイズになりにくく通常選抜では surface しづらいため、データのある局面を一定数確保する。
const OVERBET_MIN = 0.2;
const OVERBET_TARGET: Record<FlopPotCat, number> = { SRP: 3, '3bet': 1, '4bet5bet': 2 };

/** ロード済みデータから30問を生成 (純粋関数)。SRP15 / 3bet10 / 4bet5bet5、全問 CB。 */
export function buildFlopRbQuestions(data: FlopRbData): FlopRbQuestion[] {
  const out: FlopRbQuestion[] = [];
  const seen = new Set<string>();
  const choices = data.cb_choices ?? ['check', '33', '50', '75', '125'];
  const preflopOf = (v: string) => data.preflop?.[v] ?? [];
  let id = 0;

  for (const { cat, count } of FLOP_RB_DISTRIBUTION) {
    const pool = data.cb?.[cat] ?? [];
    // まずオーバーベット局面を確保 (学習機会の偏り解消)、残りを支配サイズ多様で埋める。
    const obTarget = Math.min(OVERBET_TARGET[cat], count);
    const obPool = pool.filter((b) => (b.strat['125'] ?? 0) >= OVERBET_MIN);
    const picks = sampleVaried(obPool, obTarget, seen);
    picks.push(...sampleVaried(pool, count - picks.length, seen));
    for (const rec of picks) {
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
