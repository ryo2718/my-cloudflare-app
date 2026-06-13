// フロップトレーニング初級の出題ロジック。
//   - 全20問・1問1pt・正解1/不正解0 (マイナスなし)・満点20。
//   - 2択ボタン形式 (打つ / 打たない)。
//   - CB問題15 (閾値70%) + ドンク問題5 (閾値60%)。
//   - データ: public/data/flop/flop_training_v1.json (scripts/build-flop-training.cjs 生成)。

import type { Rank, Suit, Card } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { ActionItem } from './actionHistory';
import { sampleByClusterRoundRobin } from './boardClusters';
import { shuffleWithRunLimit } from './runAwareShuffle';

export type FlopQuestionType = 'cb' | 'donk';
export type FlopPot = 'SRP' | '3bet';
export type FlopChoice = 'bet' | 'check';

/** アクション頻度 (フィードバック表示用)。bp = betsize_by_pot (X/check は 0)。 */
export interface FlopActionFreq {
  code: string;
  freq: number;
  bp: number;
}

/** データ1ボード分。 */
interface BoardRecord {
  variant: string;
  hero: string;
  villain: string;
  pot: FlopPot;
  board: string; // 例 "8h8d8c"
  rate: number; // CB or donk 頻度 (0..1)
  actions: ReadonlyArray<FlopActionFreq>;
}

export interface FlopTrainingData {
  cb: Record<FlopPot, Record<string, BoardRecord[]>>;
  donk: Record<string, BoardRecord[]>;
  cb_threshold: number;
  donk_threshold: number;
  /** 変種 → アニメ用プリフロップ アクション列。 */
  preflop: Record<string, ActionItem[]>;
}

export interface FlopQuestion {
  id: number;
  type: FlopQuestionType;
  pot: FlopPot;
  variant: string;
  hero: Position;
  /** 相手 (CB問題=ディフェンダー / ドンク問題=アグレッサー)。シナリオラベル用。 */
  villain: Position;
  board: [Card, Card, Card];
  /** CB or donk 頻度 (0..1)。 */
  rate: number;
  /** 打つ判定の閾値 (CB=0.7 / donk=0.6)。 */
  threshold: number;
  /** 正解 (rate >= threshold なら bet)。 */
  correct: FlopChoice;
  /** フィードバック用のアクション頻度分布 (bp = betsize_by_pot)。 */
  actions: ReadonlyArray<FlopActionFreq>;
  /** アニメ用プリフロップ アクション列 (open/3bet/fold/call → board)。 */
  preflopActions: ActionItem[];
}

/** 回答 (2択 or 時間切れ)。初級は時間制限なしだが共通ハーネスに合わせ timedOut を持つ。 */
export interface FlopResponse {
  choice: FlopChoice | null; // null = 無回答/時間切れ
}

/** 1問の回答記録 (結果画面の振り返り用)。 */
export interface FlopRecord extends FlopQuestion {
  /** 1〜20 (1-indexed)。出題順。 */
  recordId: number;
  /** プレイヤーの解答 (bet / check / 無回答)。 */
  choice: FlopChoice | null;
  /** 正解と一致するか。 */
  isCorrect: boolean;
}

export const FLOP_BEGINNER_COUNT = 20;
export const CB_THRESHOLD = 0.7;
export const DONK_THRESHOLD = 0.6;

/** 出題レシピ: CB15 + donk5 = 20。 */
interface Pick {
  type: FlopQuestionType;
  pot: FlopPot; // donk は便宜上 'SRP' を入れるが pot 別プールは引かない
  band: string;
  count: number;
}
export const FLOP_BEGINNER_RECIPE: ReadonlyArray<Pick> = [
  // CB SRP 打つ
  { type: 'cb', pot: 'SRP', band: '70-80', count: 2 },
  { type: 'cb', pot: 'SRP', band: '80-90', count: 2 },
  { type: 'cb', pot: 'SRP', band: '90-100', count: 2 },
  // CB 3bet 打つ
  { type: 'cb', pot: '3bet', band: '70-80', count: 1 },
  { type: 'cb', pot: '3bet', band: '80-90', count: 1 },
  { type: 'cb', pot: '3bet', band: '90-100', count: 1 },
  // CB SRP 打たない
  { type: 'cb', pot: 'SRP', band: '0-10', count: 1 },
  { type: 'cb', pot: 'SRP', band: '10-20', count: 1 },
  { type: 'cb', pot: 'SRP', band: '20-40', count: 1 },
  // CB 3bet 打たない
  { type: 'cb', pot: '3bet', band: '0-10', count: 1 },
  { type: 'cb', pot: '3bet', band: '10-20', count: 1 },
  { type: 'cb', pot: '3bet', band: '20-40', count: 1 },
  // ドンク (閾値60%)。打たない(0-5%)×2 / 打つ(70%〜)×3
  { type: 'donk', pot: 'SRP', band: '0-5', count: 2 },
  { type: 'donk', pot: 'SRP', band: '70-100', count: 3 },
];

const DATA_URL = '/data/flop/flop_training_v1.json';
let cached: FlopTrainingData | null = null;

/** データ取得 (キャッシュ)。 */
export async function loadFlopTrainingData(): Promise<FlopTrainingData> {
  if (cached) return cached;
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`failed to load flop training data: ${res.status}`);
  cached = (await res.json()) as FlopTrainingData;
  return cached;
}

function parseBoard(s: string): [Card, Card, Card] {
  const cards: Card[] = [];
  for (let i = 0; i < s.length; i += 2) {
    cards.push({ rank: s[i] as Rank, suit: s[i + 1] as Suit });
  }
  return [cards[0], cards[1], cards[2]];
}

function pickRandom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Fisher-Yates シャッフル (プリフロップ各モードと同じく出題順をランダム化)。 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function poolFor(data: FlopTrainingData, pick: Pick): BoardRecord[] {
  return pick.type === 'donk' ? (data.donk[pick.band] ?? []) : (data.cb[pick.pot][pick.band] ?? []);
}

// --- ハイブリッド出題 (意図的 + ランダム) --------------------------------------
//
// 1 セッション = 意図的問題 N (4..8、開始時ランダム決定) + ランダム枠 (20 - N)。
//   意図的: 既存レシピ (CB打つ:CB打たない:ドンク = 9:6:5) の比率を保って N に按分し、
//           band 内 pickRandom で従来通り選ぶ。
//   ランダム枠: 49(+被覆穴)クラスタから層化ラウンドロビンで網羅的に散らして抽出。
//   同一ボードは意図的・ランダム間で重複させない。

/** 意図的総数の範囲 (初級)。 */
export const BEGINNER_INTENTIONAL_MIN = 4;
export const BEGINNER_INTENTIONAL_MAX = 8;
/** CB打つ : CB打たない : ドンク の比率 (= レシピのスロット数)。 */
export const BEGINNER_CATEGORY_RATIO = [9, 6, 5] as const;

type BeginnerCategory = 'cb_bet' | 'cb_check' | 'donk';

function categoryOf(pick: Pick): BeginnerCategory {
  if (pick.type === 'donk') return 'donk';
  return parseInt(pick.band.split('-')[0], 10) >= 70 ? 'cb_bet' : 'cb_check';
}

/** 最大剰余法 (Hamilton)。weights 比で n を整数按分。N>=カテゴリ数 のとき各 >=1 を保証。 */
export function apportionByRatio(n: number, weights: ReadonlyArray<number>): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (n * w) / total);
  const base = raw.map((r) => Math.floor(r));
  let rem = n - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rem > 0 && order.length > 0; k++, rem--) base[order[k % order.length].i] += 1;
  // 各カテゴリ最低 1 保証 (n>=カテゴリ数 のとき)。0 のカテゴリへ最大カテゴリから移す。
  if (n >= weights.length) {
    for (let i = 0; i < base.length; i++) {
      if (base[i] === 0) {
        let mx = 0;
        for (let j = 1; j < base.length; j++) if (base[j] > base[mx]) mx = j;
        base[mx] -= 1;
        base[i] += 1;
      }
    }
  }
  return base;
}

/** 意図的総数 N を [min,max] でロール。 */
export function rollIntentionalCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** board 文字列 → 収録レコード一覧 (type 付き)。ランダム枠の解決に使う。 */
function indexByBoard(data: FlopTrainingData): Map<string, Array<{ rec: BoardRecord; type: FlopQuestionType }>> {
  const m = new Map<string, Array<{ rec: BoardRecord; type: FlopQuestionType }>>();
  const add = (rec: BoardRecord, type: FlopQuestionType) => {
    const g = m.get(rec.board) ?? [];
    g.push({ rec, type });
    m.set(rec.board, g);
  };
  for (const byBand of Object.values(data.cb ?? {})) for (const arr of Object.values(byBand)) for (const rec of arr) add(rec, 'cb');
  for (const arr of Object.values(data.donk ?? {})) for (const rec of arr) add(rec, 'donk');
  return m;
}

function buildQuestion(id: number, type: FlopQuestionType, rec: BoardRecord, data: FlopTrainingData): FlopQuestion {
  const threshold = type === 'cb' ? data.cb_threshold : data.donk_threshold;
  return {
    id,
    type,
    pot: rec.pot,
    variant: rec.variant,
    hero: rec.hero as Position,
    villain: rec.villain as Position,
    board: parseBoard(rec.board),
    rate: rec.rate,
    threshold,
    correct: rec.rate >= threshold ? 'bet' : 'check',
    actions: rec.actions,
    preflopActions: data.preflop?.[rec.variant] ?? [],
  };
}

/** ロード済みデータから20問を生成 (純粋関数)。意図的 N + ランダム枠。同一 board は重複させない。 */
export function buildFlopQuestions(data: FlopTrainingData): FlopQuestion[] {
  const out: FlopQuestion[] = [];
  const seenBoards = new Set<string>(); // 採用済み board 文字列 (意図的・ランダム共通)
  let id = 0;

  // --- 意図的問題 (N) ---
  const N = rollIntentionalCount(BEGINNER_INTENTIONAL_MIN, BEGINNER_INTENTIONAL_MAX);
  const [nBet, nCheck, nDonk] = apportionByRatio(N, BEGINNER_CATEGORY_RATIO);
  const byCat: Record<BeginnerCategory, Pick[]> = { cb_bet: [], cb_check: [], donk: [] };
  for (const pick of FLOP_BEGINNER_RECIPE) for (let i = 0; i < pick.count; i++) byCat[categoryOf(pick)].push(pick);
  const slots = [
    ...shuffle(byCat.cb_bet).slice(0, nBet),
    ...shuffle(byCat.cb_check).slice(0, nCheck),
    ...shuffle(byCat.donk).slice(0, nDonk),
  ];
  for (const pick of slots) {
    const pool = poolFor(data, pick);
    let rec: BoardRecord | null = null;
    for (let attempt = 0; attempt < 40 && pool.length > 0; attempt++) {
      const cand = pickRandom(pool);
      if (seenBoards.has(cand.board) && attempt < 30) continue;
      rec = cand;
      break;
    }
    if (!rec) continue;
    seenBoards.add(rec.board);
    out.push(buildQuestion((id += 1), pick.type, rec, data));
  }

  // --- ランダム枠 (20 - N) をクラスタ層化で網羅抽出 ---
  const byBoard = indexByBoard(data);
  const poolBoards = [...byBoard.keys()];
  const need = FLOP_BEGINNER_COUNT - out.length;
  const picks = sampleByClusterRoundRobin(poolBoards, need, { excludeBoards: seenBoards });
  for (const board of picks) {
    const recs = byBoard.get(board);
    if (!recs || recs.length === 0) continue;
    const { rec, type } = pickRandom(recs);
    seenBoards.add(board);
    out.push(buildQuestion((id += 1), type, rec, data));
  }

  // 出題順を run-aware シャッフル: 正解 (打つ/打たない) が長く連続しないよう散らす
  // (「次もチェック」という学習バイアス・単調さを防ぐ)。
  return shuffleWithRunLimit(out, (q) => q.correct, 3);
}

/** ロード + 生成。 */
export async function generateFlopBeginnerQuestions(): Promise<FlopQuestion[]> {
  return buildFlopQuestions(await loadFlopTrainingData());
}

/**
 * 復習(再出題)用: variant + board から 1 問を再構築する。
 * rate / actions / preflopActions は実データから取り直す。見つからなければ null。
 */
export function recordToFlopBeginnerQuestion(
  data: FlopTrainingData,
  variant: string,
  board: string,
): FlopQuestion | null {
  const all: Array<{ rec: BoardRecord; type: FlopQuestionType }> = [];
  for (const byVariant of Object.values(data.cb ?? {})) {
    for (const arr of Object.values(byVariant)) {
      for (const rec of arr) all.push({ rec, type: 'cb' });
    }
  }
  for (const arr of Object.values(data.donk ?? {})) {
    for (const rec of arr) all.push({ rec, type: 'donk' });
  }
  const hit = all.find((x) => x.rec.variant === variant && x.rec.board === board);
  if (!hit) return null;
  const threshold = hit.type === 'cb' ? data.cb_threshold : data.donk_threshold;
  return {
    id: 1,
    type: hit.type,
    pot: hit.rec.pot,
    variant: hit.rec.variant,
    hero: hit.rec.hero as Position,
    villain: hit.rec.villain as Position,
    board: parseBoard(hit.rec.board),
    rate: hit.rec.rate,
    threshold,
    correct: hit.rec.rate >= threshold ? 'bet' : 'check',
    actions: hit.rec.actions,
    preflopActions: data.preflop?.[hit.rec.variant] ?? [],
  };
}

/** シナリオラベル: 「{srp|3bp} {ヒーロー} vs {相手}」。 */
export function flopScenarioLabel(q: { pot: FlopPot; hero: Position; villain: Position }): string {
  return `${q.pot === 'SRP' ? 'srp' : '3bp'} ${q.hero} vs ${q.villain}`;
}

/** ポストフロップのアクション順 (先 = OOP)。 */
const POSTFLOP_ORDER: ReadonlyArray<Position> = ['SB', 'BB', 'UTG', 'HJ', 'MP', 'CO', 'BTN'];

/** 2席のうち OOP (先に行動する側) を返す。 */
export function flopOop(a: Position, b: Position): Position {
  return POSTFLOP_ORDER.indexOf(a) <= POSTFLOP_ORDER.indexOf(b) ? a : b;
}

/**
 * ヒーローの手番の前に、相手(OOP)の check 表示を挟むか。
 *   - CB問題でヒーローが IP (相手が OOP) のときだけ true。
 *     その c-bet ノードは「相手が check した後」の局面なので、相手 check → ヒーロー手番。
 *   - ドンク問題、および CB でヒーロー自身が OOP の場合は先頭手番なので false (即ヒーロー手番)。
 */
export function flopShowsVillainCheck(q: { type: FlopQuestionType; hero: Position; villain: Position }): boolean {
  return q.type === 'cb' && flopOop(q.hero, q.villain) === q.villain;
}

/** 採点: 正解で1pt、不正解/無回答で0pt (マイナスなし)。 */
export function scoreFlopAnswer(q: FlopQuestion, choice: FlopChoice | null): { points: number; correct: boolean } {
  const correct = choice !== null && choice === q.correct;
  return { points: correct ? 1 : 0, correct };
}

/** テスト用: キャッシュ注入 / クリア。 */
export const __testing__ = {
  setData(d: FlopTrainingData | null) {
    cached = d;
  },
};
