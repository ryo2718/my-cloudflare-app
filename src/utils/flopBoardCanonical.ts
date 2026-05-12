// Flop ボードのスート同値類化 (suit-isomorphism canonicalization)。
//
// GTOWizard のソルバーは「カード抽象化」で計算しており、52 枚から 3 枚を選ぶ全
// C(52,3) = 22,100 通りのフロップが 1,755 個の iso class に縮退する。各 class
// 内の全フロップは戦略的に等価 (スートのラベルが違うだけで全アクション頻度が同じ)。
//
// JSON には各 iso class の代表 1 枚だけが含まれる (e.g. `"2h2d2c"`)。ユーザーが
// 入力した任意のフロップ (例: `"AsKhQd"`) を、対応する代表ボード名にマップする
// ために、本モジュールは **iso signature** を計算する純関数を提供する。
//
// 同 iso class の任意 2 ボードは同じ signature を返す。アプリ層は `Map<signature,
// canonical board name>` を別途構築 (src/data/flopBoardMap.ts) して O(1) lookup。
//
// アルゴリズム:
//  1. ランク降順ソート (同 rank では位置入替の余地あり)
//  2. paired-rank の入替パターンを全列挙 (1/2/6 通り)
//  3. 各パターンでスート同値類を first-occurrence で `A`/`B`/`C` 再ラベル
//  4. signature = `"<R0><R1><R2>|<C0><C1><C2>"` の lex-smallest を採用

import type { Card, Rank } from '../types/card';
import { stringToCard } from '../types/card';

const RANK_VALUE: Record<Rank, number> = {
  '2': 2,  '3': 3,  '4': 4,  '5': 5,  '6': 6,  '7': 7,  '8': 8,  '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// ----------------------------------------------------------------------------
// Board name parsing
// ----------------------------------------------------------------------------

/**
 * JSON 内のボード名 (例: `"2h2d2c"`, `"AsKhQd"`) を `[Card, Card, Card]` に
 * パース。形式不正 / 重複カードはエラー。
 */
export function parseBoardName(name: string): [Card, Card, Card] {
  if (name.length !== 6) {
    throw new Error(`Invalid board name length (expected 6 chars): "${name}"`);
  }
  const c0 = stringToCard(name.slice(0, 2));
  const c1 = stringToCard(name.slice(2, 4));
  const c2 = stringToCard(name.slice(4, 6));
  if (!c0 || !c1 || !c2) {
    throw new Error(`Invalid board name format: "${name}"`);
  }
  if (isSame(c0, c1) || isSame(c0, c2) || isSame(c1, c2)) {
    throw new Error(`Duplicate cards in board: "${name}"`);
  }
  return [c0, c1, c2];
}

function isSame(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// ----------------------------------------------------------------------------
// Iso signature
// ----------------------------------------------------------------------------

/**
 * 3 枚カードの iso signature を計算する。
 *
 * 同 iso class (= スート全置換で重なるフロップ) は必ず同じ signature を返す。
 * 例:
 *   isoSignature(parseBoardName("AsKhQd")) === isoSignature(parseBoardName("AhKdQc"))  // 共に "AKQ|ABC"
 *   isoSignature(parseBoardName("AsKsQs")) === isoSignature(parseBoardName("AhKhQh"))  // 共に "AKQ|AAA"
 */
export function isoSignature(cards: [Card, Card, Card]): string {
  if (isSame(cards[0], cards[1]) || isSame(cards[0], cards[2]) || isSame(cards[1], cards[2])) {
    throw new Error('Duplicate cards in flop input');
  }

  // Rank 降順ソート
  const sorted = [...cards].sort(
    (a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank],
  ) as [Card, Card, Card];

  // 同 rank 群の入替パターンを列挙 → 各 signature を計算 → lex-smallest
  let best: string | null = null;
  for (const perm of orderedPermutations(sorted)) {
    const sig = computeSignature(perm);
    if (best === null || sig < best) best = sig;
  }
  return best!;
}

/** Card 3 枚に対し、rank が非昇順を保つ permutation を全列挙。 */
function orderedPermutations(cards: [Card, Card, Card]): Array<[Card, Card, Card]> {
  const all: Array<[Card, Card, Card]> = [
    [cards[0], cards[1], cards[2]],
    [cards[0], cards[2], cards[1]],
    [cards[1], cards[0], cards[2]],
    [cards[1], cards[2], cards[0]],
    [cards[2], cards[0], cards[1]],
    [cards[2], cards[1], cards[0]],
  ];
  return all.filter((p) =>
    RANK_VALUE[p[0].rank] >= RANK_VALUE[p[1].rank] &&
    RANK_VALUE[p[1].rank] >= RANK_VALUE[p[2].rank],
  );
}

/** First-occurrence でスート同値類を `A`/`B`/`C` にラベル付け → signature 文字列。 */
function computeSignature(cards: [Card, Card, Card]): string {
  const classMap = new Map<string, string>();
  let nextLetterCode = 'A'.charCodeAt(0);
  const classes: string[] = [];
  for (const c of cards) {
    let label = classMap.get(c.suit);
    if (label === undefined) {
      label = String.fromCharCode(nextLetterCode++);
      classMap.set(c.suit, label);
    }
    classes.push(label);
  }
  const ranks = cards.map((c) => c.rank).join('');
  return `${ranks}|${classes.join('')}`;
}
