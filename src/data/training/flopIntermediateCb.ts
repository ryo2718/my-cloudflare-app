// フロップトレーニング「CB」(レンジベット) の出題・採点ロジック。
//   - 2モードに分割。各 全30問・1問2pt・満点60・クリア90% (54pt)。全問 CB(サイズ複数選択)。
//       CB SRP        (flop_cb_srp): SRP 30 (ランダム抽選)。
//       CB 3BP/4BP/5BP (flop_cb_3bp): 3bet 21 / 4bet 6 / 5bet 3 (= 7:2:1)。
//   - コンセプト = ボード × ベット頻度。支配サイズが偏らないよう多様に出題し、
//     即時フィードバック/答え合わせで「正解サイズ構成が近いボード」を併せて紹介する。
//   - 選択肢はポット別 (cb_choices_by_pot)。4bp/5bp は実体がオールインのため ALLIN を表示
//     (5bp は check/33/50/ALLIN, 4bp は check/33/50/75/ALLIN)。
//   - データ: public/data/flop/flop_rangebet_v1.json (scripts/build-flop-rangebet.cjs 生成)。
//   - training_type は level.key (flop_cb_srp / flop_cb_3bp) をそのまま使用。
// ※ファイル名は履歴上 *Cb のまま。採点 (scoreFlopCb 等) は中級CB(個別ハンド) と共用。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';
import { sampleByClusterRoundRobin } from './boardClusters';
import { apportionByRatio } from './flopBeginner';

/** ポット種別 (実際のポット)。 */
export type FlopRbPot = 'SRP' | '3bet' | '4bet' | '5bet';
/** 出題プールのカテゴリ (4bet+5bet は統合)。 */
export type FlopPotCat = 'SRP' | '3bet' | '4bet5bet';
/** 設問の種類。cb=アグレッサーのCB / donk=OOPリード / bmcb=相手チェック後IPスタブ。 */
export type FlopCbKind = 'cb' | 'donk' | 'bmcb';

/** バケット別頻度 (0..1)。キー = CB 選択肢ラベル (check / 各サイズ)。 */
export type FlopCbStrat = Record<string, number>;

interface CbBoard {
  variant: string;
  hero: string;
  villain: string;
  pot: FlopRbPot;
  board: string;
  strat: FlopCbStrat;
  kind?: FlopCbKind;
}

export interface FlopRbData {
  cb_choices: string[];
  /** ポット別の表示選択肢 (例: 5bet=check/33/50/ALLIN)。無い場合は cb_choices にフォールバック。 */
  cb_choices_by_pot?: Record<string, string[]>;
  preflop: Record<string, ActionItem[]>;
  cb: Record<FlopPotCat, CbBoard[]>;
  /** ドンク問題 (OOP ディフェンダーが先にリード)。 */
  donk?: CbBoard[];
  /** BMCB問題 (アグレッサーがチェック後、IP ディフェンダーがスタブ)。 */
  bmcb?: CbBoard[];
}

/** 出題モード。CB SRP / CB 3BP・4BP・5BP / ドンク・BMCB。 */
export type FlopRbMode = 'srp' | '3bp' | 'donkbmcb';

/** level.key → 出題モード。 */
export function flopRbModeOf(levelKey: string): FlopRbMode {
  if (levelKey === 'flop_cb_srp') return 'srp';
  if (levelKey === 'flop_donk_bmcb') return 'donkbmcb';
  return '3bp';
}

/** 設問種類ごとの出題プロンプト。 */
export function flopRbPrompt(kind: FlopCbKind): string {
  if (kind === 'donk') return 'ドンクする?(複数選択可)';
  if (kind === 'bmcb') return 'ベットする?(相手チェック・複数選択可)';
  return 'CBをどう打つ?(複数選択可)';
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
  kind: FlopCbKind;
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

/** 回答: サイズ複数選択。timeout は制限時間切れ (0 点扱い)。 */
export type FlopRbResponse =
  | { kind: 'select'; selections: ReadonlyArray<string> }
  | { kind: 'timeout' };

/** 1問の回答記録 (結果画面の振り返り用)。 */
export type FlopRbRecord = FlopRbQuestion & {
  recordId: number;
  response: FlopRbResponse;
  finalScore: number; // -1 / 0 / 1 / 2
};

export const FLOP_RB_POINTS_PER_Q = 2;

/** 1 出題セグメント。source でプール元 (cb/donk/bmcb) を選ぶ。 */
interface FlopRbSegment {
  source: 'cb' | 'donk' | 'bmcb';
  kind: FlopCbKind;
  /** source=cb のときのプールキー。 */
  cat?: FlopPotCat;
  /** cb プール内をさらに実ポットで絞る (4bet5bet を 4bet/5bet に分ける用)。 */
  pot?: FlopRbPot;
  /** donk/bmcb で出題対象とする実ポット。 */
  pots?: ReadonlyArray<FlopRbPot>;
  count: number;
  /** 先に確保する「オーバーベット/オールイン主体」ボード数。 */
  overbet: number;
  /** 先に確保する「チェック主体」ボード数。 */
  check: number;
}

/** モード別の出題内訳 (各合計30)。 */
export const FLOP_RB_MODE_SEGMENTS: Record<FlopRbMode, ReadonlyArray<FlopRbSegment>> = {
  srp: [{ source: 'cb', kind: 'cb', cat: 'SRP', count: 30, overbet: 6, check: 8 }],
  // 3bet:4bet:5bet = 21:6:3 (= 7:2:1)。
  '3bp': [
    { source: 'cb', kind: 'cb', cat: '3bet', count: 21, overbet: 3, check: 7 },
    { source: 'cb', kind: 'cb', cat: '4bet5bet', pot: '4bet', count: 6, overbet: 2, check: 1 },
    { source: 'cb', kind: 'cb', cat: '4bet5bet', pot: '5bet', count: 3, overbet: 1, check: 0 },
  ],
  // ドンク 15 / BMCB 15 (= 5:5)。SRP+3bet ポットから出題。
  donkbmcb: [
    { source: 'donk', kind: 'donk', pots: ['SRP', '3bet'], count: 15, overbet: 2, check: 6 },
    { source: 'bmcb', kind: 'bmcb', pots: ['SRP', '3bet'], count: 15, overbet: 2, check: 6 },
  ],
};

export const FLOP_RB_COUNT = 30;
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

/** ベットサイズ(%pot) を選択肢バケット (33/50/75/125) に丸める。allin/RAI→ALLIN。 */
export function flopCbBucket(sizePct: number, allin = false): string {
  if (allin) return 'ALLIN';
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
 * ボードのハイカード帯 (A / broadway / mid / low) でグループ化し、ラウンドロビンで count 件抽選。
 * 出題セットが特定の帯 (特にロー) に偏らないよう散らす。overbet/check 枠もこの抽選を通すので、
 * ハイ系のオーバーベット・ロー系のチェック等を帯バランスよく拾える。
 * 重複防止は board (カード) 単位 — 同じボードはマッチアップ違いでも 1 セッション 1 回まで。
 * seen はボード文字列を保持し、セグメントを跨いで共有される。
 */
/** strat の支配サイズ (最頻アクション。check 含む)。 */
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

function sampleVaried(pool: ReadonlyArray<CbBoard>, count: number, seen: Set<string>): CbBoard[] {
  // pool をシャッフルしてから board でユニーク化 (同一ボードの採用マッチアップを毎回ランダムに)。
  // グループ化は「ハイカード帯 × 支配サイズ」の 2 軸でラウンドロビン抽選し、
  // ボードの見た目 (帯) も打ち方 (サイズ) も偏らないよう散らす。
  const groups = new Map<string, CbBoard[]>();
  const usedBoard = new Set<string>();
  for (const b of shuffle([...pool])) {
    if (seen.has(b.board) || usedBoard.has(b.board)) continue;
    usedBoard.add(b.board);
    const dk = `${textureOf(b.board).high}|${dominantKey(b.strat)}`; // 帯 × 支配サイズ
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
      seen.add(b.board);
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

// 「両極端」局面 (チェック主体 / オーバーベット・オールイン) は支配サイズ均等選抜で薄まりやすいので、
// 各セグメントで先に一定数確保する (データ量で上限キャップ)。
const CHECK_MIN = 0.5; // チェックが主体のボード
const OVERBET_MIN = 0.2; // オーバーベット(125)/オールインが実戦的なボード

const DEFAULT_CHOICES = ['check', '33', '50', '75', '125', 'ALLIN'];

/** ボードの「大きいサイズ」(オーバーベット 125 or オールイン) 頻度。 */
function bigSizeFreq(strat: FlopCbStrat): number {
  return Math.max(strat['125'] ?? 0, strat.ALLIN ?? 0);
}

/** セグメントの母集団プールを取得。 */
function poolForSegment(data: FlopRbData, seg: FlopRbSegment): CbBoard[] {
  if (seg.source === 'cb') {
    let pool = data.cb?.[seg.cat ?? 'SRP'] ?? [];
    if (seg.pot) pool = pool.filter((b) => b.pot === seg.pot);
    return pool;
  }
  const pool = (seg.source === 'donk' ? data.donk : data.bmcb) ?? [];
  return seg.pots ? pool.filter((b) => seg.pots!.includes(b.pot)) : pool;
}

/** ロード済みデータから 1 モード分 (30問) を生成 (純粋関数)。 */
/** 意図的総数の範囲 (中級)。 */
export const INTERMEDIATE_INTENTIONAL_MIN = 6;
export const INTERMEDIATE_INTENTIONAL_MAX = 12;

/** 解決済み出題候補 (どのプールの似たボードを使うかも保持)。 */
interface RbPick {
  rec: CbBoard;
  kind: FlopCbKind;
  pool: ReadonlyArray<CbBoard>;
}

/**
 * 1 モード分 (30問) を「意図的 N + ランダム枠」で生成 (純粋関数)。
 *   意図的 (N=6..12): 既存のセグメント配分 (pot 比率) を N に按分し、各セグメントで
 *     overbet/check 枠 + 帯×支配サイズ層化 (sampleVaried) を維持して選ぶ。
 *   ランダム枠 (30-N): 当該モードのプールから 49(+被覆穴)クラスタ層化ラウンドロビンで網羅抽出。
 *   同一ボードは意図的・ランダム間で重複させない (seen を共有)。
 */
export function buildFlopRbQuestions(data: FlopRbData, mode: FlopRbMode = 'srp'): FlopRbQuestion[] {
  const seen = new Set<string>();
  const choicesByPot = data.cb_choices_by_pot ?? {};
  const fallbackChoices = data.cb_choices ?? DEFAULT_CHOICES;
  const choicesFor = (pot: FlopRbPot) => choicesByPot[pot] ?? fallbackChoices;
  const preflopOf = (v: string) => data.preflop?.[v] ?? [];

  const segs = FLOP_RB_MODE_SEGMENTS[mode];
  const segPools = segs.map((seg) => ({ seg, pool: poolForSegment(data, seg) }));

  // --- 意図的問題 (N) ---
  const N = INTERMEDIATE_INTENTIONAL_MIN + Math.floor(Math.random() * (INTERMEDIATE_INTENTIONAL_MAX - INTERMEDIATE_INTENTIONAL_MIN + 1));
  const intPer = apportionByRatio(N, segPools.map(({ seg }) => seg.count));
  const intentional: RbPick[] = [];
  segPools.forEach(({ seg, pool }, i) => {
    const want = intPer[i];
    if (want <= 0) return;
    // セグメント内も overbet/check 比率を N にスケール。
    const ob = Math.round((seg.overbet * want) / seg.count);
    const ck = Math.round((seg.check * want) / seg.count);
    const picks: CbBoard[] = [];
    picks.push(...sampleVaried(pool.filter((b) => bigSizeFreq(b.strat) >= OVERBET_MIN), Math.min(ob, want - picks.length), seen));
    picks.push(...sampleVaried(pool.filter((b) => (b.strat.check ?? 0) >= CHECK_MIN), Math.min(ck, want - picks.length), seen));
    picks.push(...sampleVaried(pool, want - picks.length, seen));
    for (const rec of picks) intentional.push({ rec, kind: seg.kind, pool });
  });

  // --- ランダム枠 (30 - 意図的数) をクラスタ層化で網羅抽出 ---
  const byBoard = new Map<string, RbPick[]>();
  for (const { seg, pool } of segPools) {
    for (const rec of pool) {
      const g = byBoard.get(rec.board) ?? [];
      g.push({ rec, kind: seg.kind, pool });
      byBoard.set(rec.board, g);
    }
  }
  const need = FLOP_RB_COUNT - intentional.length;
  const randBoards = sampleByClusterRoundRobin([...byBoard.keys()], need, { excludeBoards: seen });
  const random: RbPick[] = [];
  for (const b of randBoards) {
    const recs = byBoard.get(b);
    if (!recs || recs.length === 0) continue;
    seen.add(b);
    random.push(recs[Math.floor(Math.random() * recs.length)]);
  }

  // --- 出題構築 ---
  let id = 0;
  const out: FlopRbQuestion[] = [...intentional, ...random].map(({ rec, kind, pool }) => {
    id += 1;
    const choices = choicesFor(rec.pot);
    return {
      id,
      pot: rec.pot,
      kind,
      variant: rec.variant,
      hero: rec.hero as Position,
      villain: rec.villain as Position,
      board: parseBoard(rec.board),
      choices,
      strat: rec.strat,
      preflopActions: preflopOf(rec.variant),
      similar: findSimilar(pool, rec, choices, FLOP_RB_SIMILAR_COUNT),
    };
  });

  return shuffle(out);
}

export async function generateFlopRbQuestions(mode: FlopRbMode = 'srp'): Promise<FlopRbQuestion[]> {
  return buildFlopRbQuestions(await loadFlopRbData(), mode);
}

/**
 * 復習(再出題)用: variant + board から 1 問を再構築する。
 * strat / choices / preflopActions / similar は実データから取り直す(正解は保存していない)。
 * 見つからなければ null。
 */
export function recordToFlopRbQuestion(
  data: FlopRbData,
  variant: string,
  board: string,
): FlopRbQuestion | null {
  const fallbackChoices = data.cb_choices ?? DEFAULT_CHOICES;
  const choicesFor = (pot: FlopRbPot) => (data.cb_choices_by_pot ?? {})[pot] ?? fallbackChoices;
  const pools: Array<{ arr: ReadonlyArray<CbBoard>; kind: FlopCbKind }> = [
    ...Object.values(data.cb ?? {}).map((arr) => ({ arr: arr as ReadonlyArray<CbBoard>, kind: 'cb' as FlopCbKind })),
    { arr: data.donk ?? [], kind: 'donk' as FlopCbKind },
    { arr: data.bmcb ?? [], kind: 'bmcb' as FlopCbKind },
  ];
  for (const { arr, kind } of pools) {
    const rec = arr.find((b) => b.variant === variant && b.board === board);
    if (!rec) continue;
    const choices = choicesFor(rec.pot);
    return {
      id: 1,
      pot: rec.pot,
      kind: rec.kind ?? kind,
      variant: rec.variant,
      hero: rec.hero as Position,
      villain: rec.villain as Position,
      board: parseBoard(rec.board),
      choices,
      strat: rec.strat,
      preflopActions: data.preflop?.[rec.variant] ?? [],
      similar: findSimilar(arr, rec, choices, FLOP_RB_SIMILAR_COUNT),
    };
  }
  return null;
}

/** シナリオラベル: 「[donk|bmcb ]{srp|3bp|4bp|5bp} {ヒーロー} vs {相手}」。 */
export function flopRbScenarioLabel(q: { pot: FlopRbPot; hero: Position; villain: Position; kind?: FlopCbKind }): string {
  const tag = q.pot === 'SRP' ? 'srp' : q.pot === '3bet' ? '3bp' : q.pot === '4bet' ? '4bp' : '5bp';
  const prefix = q.kind === 'donk' ? 'donk ' : q.kind === 'bmcb' ? 'bmcb ' : '';
  return `${prefix}${tag} ${q.hero} vs ${q.villain}`;
}

/** テスト用: キャッシュ注入 / クリア。 */
export const __testing__ = {
  setData(d: FlopRbData | null) {
    cached = d;
  },
};
