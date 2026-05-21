// カード選択パネル: 4 スート × 13 ランクのグリッド。
// 画面上部にポップアップし、カードは行幅いっぱいに広げてタップしやすくする。
// 既に他スロットで使用中のカードはグレーアウト (選択不可)。

import type { CSSProperties } from 'react';
import { RANKS, SUITS, cardToString, type Card, type Suit } from '../../types/card';
import { SUIT_BG_COLORS, defaultPlayingCardAriaLabel } from '../PlayingCard.helpers';
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
                  <button
                    key={rank}
                    type="button"
                    disabled={used}
                    onClick={used ? undefined : () => onSelect(card)}
                    aria-label={defaultPlayingCardAriaLabel(rank, suit)}
                    style={{
                      ...cellStyle,
                      background: SUIT_BG_COLORS[suit],
                      ...(used ? cellDisabledStyle : null),
                    }}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '0.5rem',
};

const panelStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  background: THEME.bg,
  borderRadius: '0.8rem',
  padding: '0.8rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  marginTop: '0.5rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.6rem',
};
const headerTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: THEME.textPrimary };
const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.2rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const gridStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gap: '0.25rem',
};
const cellStyle: CSSProperties = {
  width: '100%',
  aspectRatio: '3 / 4',
  border: 'none',
  borderRadius: 5,
  color: '#fff',
  fontWeight: 600,
  fontSize: 'clamp(13px, 3.6vw, 20px)',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
};
const cellDisabledStyle: CSSProperties = { opacity: 0.3, cursor: 'not-allowed' };
