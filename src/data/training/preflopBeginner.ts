// プリフロップ初級トレーニング用の問題生成ロジック。
//
// 仕様:
//   - 5 ポジション (UTG/HJ/CO/BTN/SB) の RFI データを fetch
//   - 各ハンド × 各ポジションを (raise+allin >= 90%) → "open", (fold >= 90%) → "fold" で分類
//   - 中間 (どっちも 90% 未満) は出題対象外
//   - 20 問: open / fold をできるだけバランスよく抽選 (~10:10)
//
// 注:
//   - 結果保存 = 結果画面到達時のみ。途中離脱で DB 影響なし (確認ダイアログは別途 Play 画面)
//   - 各問題はランダム生成、リロード時に状態破棄

import type { Position, Hand } from '../../types/strategy';

const RFI_POSITIONS: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
const QUESTION_COUNT = 20;
const OPEN_THRESHOLD_PCT = 90;
const FOLD_THRESHOLD_PCT = 90;

interface RawHand {
  fold: number;
  call: number;
  raise: number;
  allin: number;
}
interface RawNode {
  hands: Record<string, RawHand>;
}

export type CorrectAnswer = 'participate' | 'fold';

export interface PreflopQuestion {
  /** 自分のポジション。 */
  myPosition: Position;
  /** ハンド表記 (AA / AKs / 72o)。 */
  hand: Hand;
  /** 出題された 2 枚のカード (UI 表示用、suit は表記から導出)。 */
  cards: [{ rank: string; suit: 's' | 'h' | 'd' | 'c' }, { rank: string; suit: 's' | 'h' | 'd' | 'c' }];
  /** 正解。 */
  correct: CorrectAnswer;
}

/** モジュールスコープのキャッシュ (再 mount でも保持)。 */
const rfiCache: Partial<Record<Position, RawNode>> = {};
let loadingPromise: Promise<void> | null = null;

async function loadAllRFI(): Promise<void> {
  if (RFI_POSITIONS.every((p) => rfiCache[p])) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      await Promise.all(
        RFI_POSITIONS.map(async (pos) => {
          if (rfiCache[pos]) return;
          const url = `${PREFLOP_DATA_ROOT}/${pos.toLowerCase()}.json`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`failed to load ${pos}: ${res.status}`);
          rfiCache[pos] = (await res.json()) as RawNode;
        }),
      );
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function classifyHand(s: RawHand): CorrectAnswer | null {
  const opens = (s.raise ?? 0) + (s.allin ?? 0);
  if (opens >= OPEN_THRESHOLD_PCT) return 'participate';
  if ((s.fold ?? 0) >= FOLD_THRESHOLD_PCT) return 'fold';
  return null; // 中間 (出題対象外)
}

/** ハンド表記 ("AKs" / "QQ" / "72o") から SVG / PlayingCard 用の suit 付きカード 2 枚を生成。 */
function handToCards(hand: Hand): PreflopQuestion['cards'] {
  // ペア
  if (hand.length === 2) {
    const r = hand[0];
    return [
      { rank: r, suit: 's' },
      { rank: r, suit: 'h' },
    ];
  }
  // suited / offsuit
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

/** 全 RFI データから 20 問を生成 (open:fold ≒ 10:10)。 */
export async function generatePreflopQuestions(
  count: number = QUESTION_COUNT,
): Promise<PreflopQuestion[]> {
  await loadAllRFI();

  // (position, hand, answer) の pool を構築
  const openPool: PreflopQuestion[] = [];
  const foldPool: PreflopQuestion[] = [];

  for (const pos of RFI_POSITIONS) {
    const data = rfiCache[pos];
    if (!data) continue;
    for (const [hand, s] of Object.entries(data.hands)) {
      const ans = classifyHand(s);
      if (!ans) continue;
      const handTyped = hand as Hand;
      const q: PreflopQuestion = {
        myPosition: pos,
        hand: handTyped,
        cards: handToCards(handTyped),
        correct: ans,
      };
      if (ans === 'participate') openPool.push(q);
      else foldPool.push(q);
    }
  }

  if (openPool.length === 0 || foldPool.length === 0) {
    throw new Error('preflop RFI data insufficient: no open or no fold hands found');
  }

  // 半々で抽選 (count が奇数なら open を 1 件多く)
  const openCount = Math.ceil(count / 2);
  const foldCount = count - openCount;
  const openSamples: PreflopQuestion[] = [];
  const foldSamples: PreflopQuestion[] = [];
  for (let i = 0; i < openCount; i++) openSamples.push(pickRandom(openPool));
  for (let i = 0; i < foldCount; i++) foldSamples.push(pickRandom(foldPool));
  return shuffle([...openSamples, ...foldSamples]);
}
