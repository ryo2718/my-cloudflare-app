// カード選択パネル: 4 スート × 13 ランクのグリッド。
// 既に他スロットで使用中のカードはグレーアウト (選択不可)。

import type { CSSProperties } from 'react';
import { PlayingCard } from '../PlayingCard';
import { RANKS, SUITS, cardToString, type Card, type Suit } from '../../types/card';
import { THEME } from '../../styles/theme';

export interface CardSelectorProps {
  /** 使用中カードの文字列集合 (例: "Ah")。これらは選択不可。 */
  usedCards: ReadonlySet<string>;
  onSelect: (card: Card) => void;
  onClose: () => void;
}

const SUIT_LABEL: Record<Suit, string> = { s: 'スペード', h: 'ハート', d: 'ダイヤ', c: 'クラブ' };

export function CardSelector({ usedCards, onSelect, onClose }: CardSelectorProps) {
  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-label="カード選択">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={headerTitleStyle}>カードを選択</span>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="閉じる">✕</button>
        </div>
        <div style={gridStyle}>
          {SUITS.map((suit) => (
            <div key={suit} style={rowStyle} aria-label={SUIT_LABEL[suit]}>
              {RANKS.map((rank) => {
                const card: Card = { rank, suit };
                const used = usedCards.has(cardToString(card));
                return (
                  <PlayingCard
                    key={rank}
                    rank={rank}
                    suit={suit}
                    size="sm"
                    disabled={used}
                    onClick={() => onSelect(card)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  zIndex: 1000,
};

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: THEME.bg,
  borderTopLeftRadius: '0.8rem',
  borderTopRightRadius: '0.8rem',
  padding: '0.9rem',
  boxShadow: '0 -2px 12px rgba(0,0,0,0.2)',
  maxHeight: '80vh',
  overflowY: 'auto',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.7rem',
};
const headerTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: THEME.textPrimary };
const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.1rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const gridStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gap: '0.2rem',
};
