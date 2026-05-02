// 具体的なカード2枚 (combo) を扱う型 + ヘルパー。
// 169ハンド粒度 (AKs/AKo) ではなく、52枚から2枚を選ぶ "starting hand combo" 用。

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 's' | 'h' | 'd' | 'c'; // spade, heart, diamond, club

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type HandPair = [Card, Card];

export const RANKS: ReadonlyArray<Rank> =
  ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: ReadonlyArray<Suit> = ['s', 'h', 'd', 'c'];

const RANK_SET = new Set<string>(RANKS);
const SUIT_SET = new Set<string>(SUITS);

/** カード → 文字列 (例: {rank:'A', suit:'h'} → "Ah") */
export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

/** 文字列 → カード。2文字のみ受理。不正なら null。 (rank=大文字, suit=小文字を期待) */
export function stringToCard(s: string): Card | null {
  if (s.length !== 2) return null;
  const r = s[0].toUpperCase();
  const u = s[1].toLowerCase();
  if (!RANK_SET.has(r) || !SUIT_SET.has(u)) return null;
  return { rank: r as Rank, suit: u as Suit };
}

/** 2枚のカードが完全一致 (同じ rank かつ同じ suit) か */
export function isSameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** HandPair → 文字列 (例: [Ah, Ks] → "AhKs") */
export function formatHandPair(pair: HandPair): string {
  return cardToString(pair[0]) + cardToString(pair[1]);
}

/**
 * ユーザー入力文字列を HandPair にパースする。
 *
 * 受理する形式:
 *  - "AhKs" / "ahks" — 連続4文字
 *  - "Ah Ks" / "AH KS" — 空白区切り
 *  - "Ah,Ks" / "Ah-Ks" — カンマ・ハイフン区切り
 *
 * 拒否する条件:
 *  - 全文字数が 4 でない (空白等を除去後)
 *  - 不正な rank / suit を含む
 *  - 同じカード2枚 ("AhAh" 等)
 */
export function parseCardString(input: string): HandPair | null {
  const cleaned = input.replace(/[\s,\-]/g, '');
  if (cleaned.length !== 4) return null;
  const c1 = stringToCard(cleaned.slice(0, 2));
  const c2 = stringToCard(cleaned.slice(2, 4));
  if (!c1 || !c2) return null;
  if (isSameCard(c1, c2)) return null;
  return [c1, c2];
}

/** カード配列に特定のカードが含まれるか (object identity ではなく値で判定) */
export function containsCard(cards: ReadonlyArray<Card>, target: Card): boolean {
  return cards.some((c) => isSameCard(c, target));
}

/** スート → 表示シンボル */
export const SUIT_SYMBOL: Record<Suit, string> = {
  s: '♠', // ♠
  h: '♥', // ♥
  d: '♦', // ♦
  c: '♣', // ♣
};

/** スート → カラー (ビジュアル統一用、theme.ts と独立) */
export const SUIT_COLOR: Record<Suit, string> = {
  s: '#9ca3af', // gray
  h: '#dc2626', // red
  d: '#2563eb', // blue
  c: '#16a34a', // green
};
