// § 1 (FLOP 入力) の grid 部分 — 4 行 (♠ ♥ ♦ ♣) × 13 列 (A-2)。
//
// Phase 5: 各セルは共通 <PlayingCard size="sm" /> に統一。スーツ色が背景全面、
// ランクが白文字で表示される。横 1 列に 13 ボタン収まるコンパクトレイアウト。

import type { CSSProperties } from 'react';
import type { Card } from '../types/card';
import { RANKS, SUITS, containsCard } from '../types/card';
import { PlayingCard } from './PlayingCard';

interface Props {
  selectedCards: ReadonlyArray<Card>;
  onSelect: (card: Card) => void;
}

export function FlopKeyboard({ selectedCards, onSelect }: Props) {
  return (
    <div style={gridStyle}>
      {SUITS.map((s) =>
        RANKS.map((r) => {
          const card: Card = { rank: r, suit: s };
          const selected = containsCard(selectedCards, card);
          return (
            <PlayingCard
              key={`${r}${s}`}
              rank={r}
              suit={s}
              size="sm"
              disabled={selected}
              onClick={() => onSelect(card)}
            />
          );
        }),
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, max-content)',
  gap: '3px',
  width: 'max-content',
  justifyContent: 'center',
  margin: '0 auto',
};
