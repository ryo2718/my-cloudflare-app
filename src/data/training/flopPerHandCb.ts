// フロップトレーニング「中級CB(個別ハンド)」の出題・採点ロジック。
//   - 全30問・1問1pt・満点30。指定ボード×指定ハンドで「CBをどう打つ?」を複数選択。
//   - 出題内訳: SRP 20 / 3bp 7 / 4bp 3。decision="cbet" (ヒーロー=OOPアグレッサー) のみ。
//   - 100%チェックのハンドは出題しない。スートはランク・パターンを保ち無作為化 (戦略不変)。
//   - 採点: 既存のCB複数選択採点 (scoreFlopCb)。満点相当 (finalScore=2) のみ 1pt。
//   - 解答後はハンドレンジgrid (HandRangeMatrix) を表示。
//   - データ: public/data/flop/flop_perhand_v1.json (scripts/build-flop-perhand.cjs 生成)。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';
import { scoreFlopCb, type FlopCbStrat } from './flopIntermediateCb';

export type FlopPhScenario = 'SRP' | '3bet' | '4bet';
export const FLOP_PH_CHOICES = ['check', '33', '50', '75', '125'] as const;

interface RawHand {
  s: number[]; // [check,33,50,75,125] %% (末尾0は省略され得る)
  w: number; // レンジ重み (permille)
}
interface RawBoard {
  board: string;
  pot: number;
  hands: Record<string, RawHand>;
}
interface RawNode {
  scenario: FlopPhScenario;
  label: string;
  hero: string;
  villain: string;
  aggressor: string;
  decision: 'cbet' | 'lead';
  preflop?: ActionItem[];
  boards: RawBoard[];
}
export interface FlopPhData {
  buckets: string[];
  nodes: RawNode[];
}

export interface FlopPhQuestion {
  id: number;
  scenario: FlopPhScenario;
  label: string;
  hero: Position;
  villain: Position;
  board: [Card, Card, Card];
  hand: string; // "QQ" / "AKs" / "72o"
  heroCards: [Card, Card];
  choices: string[];
  /** 出題ハンドの戦略 (採点 + 答え合わせのサイズ混合表示用, 0..1)。 */
  strat: FlopCbStrat;
  /** grid 用: ボードのレンジ全ハンドのバケット別頻度 (0..1)。6色積み上げ表示。 */
  rangeHands: Record<string, FlopCbStrat>;
  /** アニメ用プリフロップ アクション列 (中級レンジから流用)。 */
  preflopActions: ActionItem[];
}

export interface FlopPhResponse {
  selections: ReadonlyArray<string>;
}

export interface FlopPhRecord extends FlopPhQuestion {
  recordId: number;
  selections: ReadonlyArray<string>;
  correct: boolean;
  points: number; // 0 / 1
}

export const FLOP_PH_COUNT = 30;
export const FLOP_PH_MAX_SCORE = 30;
export const FLOP_PH_CLEAR_SCORE = Math.ceil(FLOP_PH_MAX_SCORE * 0.9); // 27
export const FLOP_PH_DISTRIBUTION: ReadonlyArray<{ scenario: FlopPhScenario; count: number }> = [
  { scenario: 'SRP', count: 20 },
  { scenario: '3bet', count: 7 },
  { scenario: '4bet', count: 3 },
];

// ---------------------------------------------------------------------------
// 採点: 満点相当 (finalScore=2) のみ 1pt。
// ---------------------------------------------------------------------------

/** s(%, 末尾0省略あり) → バケット別頻度 (0..1)。 */
function stratFromS(s: number[]): FlopCbStrat {
  const pad = [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0, s[3] ?? 0, s[4] ?? 0];
  return { check: pad[0] / 100, '33': pad[1] / 100, '50': pad[2] / 100, '75': pad[3] / 100, '125': pad[4] / 100 };
}

export function scoreFlopPh(strat: FlopCbStrat, res: FlopPhResponse): { correct: boolean; points: number } {
  const correct = scoreFlopCb(strat, res.selections).finalScore === 2;
  return { correct, points: correct ? 1 : 0 };
}

// ---------------------------------------------------------------------------
// スート無作為化 + ハンド配牌
// ---------------------------------------------------------------------------

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickRandom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseBoard(s: string): [Card, Card, Card] {
  const cards: Card[] = [];
  for (let i = 0; i < s.length; i += 2) cards.push({ rank: s[i] as Rank, suit: s[i + 1] as Suit });
  return [cards[0], cards[1], cards[2]];
}

/** スートのパターン (どのカードが同スートか) を保って無作為に再割当。戦略不変。 */
function resuitBoard(cards: [Card, Card, Card]): [Card, Card, Card] {
  const distinct = [...new Set(cards.map((c) => c.suit))];
  const remap = new Map<Suit, Suit>();
  const pool = shuffle([...SUITS]);
  distinct.forEach((s, i) => remap.set(s, pool[i]));
  return cards.map((c) => ({ rank: c.rank, suit: remap.get(c.suit)! })) as [Card, Card, Card];
}

/** ハンド表記 ("QQ"/"AKs"/"AKo") から、ボードと衝突しない2枚を配る。失敗時 null。 */
function dealHandCards(hand: string, board: [Card, Card, Card]): [Card, Card] | null {
  const used = new Set(board.map((c) => c.rank + c.suit));
  const r1 = hand[0] as Rank;
  const r2 = hand[1] as Rank;
  const freeSuits = (r: Rank) => shuffle(SUITS.filter((s) => !used.has(r + s)));
  if (hand.length === 2) {
    // ペア: 同ランク2スート
    const fs = freeSuits(r1);
    if (fs.length < 2) return null;
    return [{ rank: r1, suit: fs[0] }, { rank: r1, suit: fs[1] }];
  }
  const suited = hand[2] === 's';
  if (suited) {
    const common = shuffle(SUITS).find((s) => !used.has(r1 + s) && !used.has(r2 + s));
    if (!common) return null;
    return [{ rank: r1, suit: common }, { rank: r2, suit: common }];
  }
  // オフスート: 異なるスート
  const s1 = freeSuits(r1);
  for (const a of s1) {
    const s2 = freeSuits(r2).find((b) => b !== a);
    if (s2) return [{ rank: r1, suit: a }, { rank: r2, suit: s2 }];
  }
  return null;
}

// ---------------------------------------------------------------------------
// データ取得
// ---------------------------------------------------------------------------

const DATA_URL = '/data/flop/flop_perhand_v1.json';
let cached: FlopPhData | null = null;

export async function loadFlopPhData(): Promise<FlopPhData> {
  if (cached) return cached;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`failed to load flop per-hand data: ${res.status}`);
  cached = (await res.json()) as FlopPhData;
  return cached;
}

// ---------------------------------------------------------------------------
// 出題生成
// ---------------------------------------------------------------------------

/** ロード済みデータから30問を生成 (純粋関数)。同一 node:board:hand は重複させない。 */
export function buildFlopPhQuestions(data: FlopPhData): FlopPhQuestion[] {
  const cbet = data.nodes.filter((n) => n.decision === 'cbet');
  const out: FlopPhQuestion[] = [];
  const seen = new Set<string>();
  let id = 0;

  for (const { scenario, count } of FLOP_PH_DISTRIBUTION) {
    const nodes = cbet.filter((n) => n.scenario === scenario);
    if (nodes.length === 0) continue;
    let made = 0;
    for (let attempt = 0; attempt < count * 60 && made < count; attempt++) {
      const node = pickRandom(nodes);
      const rb = pickRandom(node.boards);
      const hands = Object.keys(rb.hands).filter((h) => (rb.hands[h].s[0] ?? 0) < 100); // 100%check除外
      if (hands.length === 0) continue;
      const hand = pickRandom(hands);
      const key = `${node.label}:${rb.board}:${hand}`;
      if (seen.has(key)) continue;
      const board = resuitBoard(parseBoard(rb.board));
      const heroCards = dealHandCards(hand, board);
      if (!heroCards) continue;
      seen.add(key);
      made += 1;
      id += 1;
      const rangeHands: Record<string, FlopCbStrat> = {};
      for (const [h, v] of Object.entries(rb.hands)) rangeHands[h] = stratFromS(v.s);
      out.push({
        id,
        scenario,
        label: node.label,
        hero: node.hero as Position,
        villain: node.villain as Position,
        board,
        hand,
        heroCards,
        choices: [...FLOP_PH_CHOICES],
        strat: stratFromS(rb.hands[hand].s),
        rangeHands,
        preflopActions: node.preflop ?? [],
      });
    }
  }
  return shuffle(out);
}

export async function generateFlopPhQuestions(): Promise<FlopPhQuestion[]> {
  return buildFlopPhQuestions(await loadFlopPhData());
}

/** シナリオラベル: 「{srp|3bp|4bp} {ラベル}」。 */
export function flopPhScenarioLabel(q: { scenario: FlopPhScenario; label: string }): string {
  const tag = q.scenario === 'SRP' ? 'srp' : q.scenario === '3bet' ? '3bp' : '4bp';
  return `${tag} ${q.label}`;
}

export const __testing__ = {
  setData(d: FlopPhData | null) {
    cached = d;
  },
};
