// 複数の <PlayingCard /> を一定の隙間 (デフォルト 3px) で並べる薄いラッパー。
// ボード (3 枚)・手札 (2 枚)・カード履歴 (n 枚) 等で再利用する。

import type { Rank, Suit } from '../types/card';
import { PlayingCard } from './PlayingCard';
import type { CardSize } from './PlayingCard.helpers';
import { getCardSetStyle } from './CardSet.helpers';

export interface CardSetCard {
  rank: Rank;
  suit: Suit;
  disabled?: boolean;
  selected?: boolean;
}

export interface CardSetProps {
  cards: ReadonlyArray<CardSetCard>;
  size?: CardSize;
  /** カード間の隙間 px。デフォルト 3。 */
  gap?: number;
  /** クリック可能にしたい時のみ指定。インデックスで識別。 */
  onCardClick?: (index: number) => void;
  /** a11y 用のグループラベル。 */
  ariaLabel?: string;
}

export function CardSet({
  cards,
  size = 'md',
  gap = 3,
  onCardClick,
  ariaLabel,
}: CardSetProps) {
  return (
    <span
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
      style={getCardSetStyle(gap)}
    >
      {cards.map((c, i) => (
        <PlayingCard
          key={`${c.rank}${c.suit}-${i}`}
          rank={c.rank}
          suit={c.suit}
          size={size}
          disabled={c.disabled}
          selected={c.selected}
          onClick={onCardClick ? () => onCardClick(i) : undefined}
        />
      ))}
    </span>
  );
}
