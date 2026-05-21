// コンボ key (例 "AdQd") を、スート記号付き・スート色のカードビジュアルで表示。
// コンボ詳細パネルと役フィルター内訳で共用する。

import type { CSSProperties } from 'react';
import { SUIT_SYMBOL, SUIT_COLOR, stringToCard, type Card } from '../../types/card';

export function ComboCards({ comboKey }: { comboKey: string }) {
  const a = stringToCard(comboKey.slice(0, 2));
  const b = stringToCard(comboKey.slice(2, 4));
  if (!a || !b) return null;
  return (
    <span style={wrapStyle}>
      <CardText card={a} />
      <CardText card={b} />
    </span>
  );
}

function CardText({ card }: { card: Card }) {
  return (
    <span style={{ color: SUIT_COLOR[card.suit] }}>
      {card.rank}
      {SUIT_SYMBOL[card.suit]}
    </span>
  );
}

const wrapStyle: CSSProperties = { display: 'inline-flex', gap: 2, fontWeight: 700 };
