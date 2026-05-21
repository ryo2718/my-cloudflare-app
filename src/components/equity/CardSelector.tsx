// カード選択パネル: 4 スート × 13 ランクのグリッドを画面上部にポップアップ。
// 連続選択モード:
//   - ボード用 (最大5枚) / ハンド用 (2枚) を mode で切替
//   - タップで選択 (順番に格納)。再タップで選択解除 (トグル)
//   - 選択済みカードは「何枚目か」が分かる枠色が付く
//       ボード: 1〜3枚目=青(フロップ) / 4枚目=緑(ターン) / 5枚目=赤(リバー)
//       ハンド: 1枚目=青 / 2枚目=緑
//   - 必要枚数に達したら自動で確定して閉じる (ハンド2枚 / ボード5枚)
//   - ボードは「閉じる」(✕) で 3〜4枚でも途中確定できる
//   - 他グループで使用中のカードはグレーアウト (選択不可)

import { useState, type CSSProperties } from 'react';
import { RANKS, SUITS, cardToString, type Card, type Suit } from '../../types/card';
import { SUIT_BG_COLORS, defaultPlayingCardAriaLabel } from '../PlayingCard.helpers';
import { THEME } from '../../styles/theme';

export type SelectorMode = 'board' | 'hand';

export interface CardSelectorProps {
  mode: SelectorMode;
  /** 既にこのグループに入っているカード (順序付き)。選択済み状態で開く。 */
  initialSelected: ReadonlyArray<Card>;
  /** 他グループで使用中のカード文字列集合 (例: "Ah")。選択不可。 */
  usedByOthers: ReadonlySet<string>;
  /** 確定時に順序付き選択カードを返す (パネルを閉じる)。 */
  onCommit: (cards: Card[]) => void;
}

const SUIT_LABEL: Record<Suit, string> = { s: 'スペード', h: 'ハート', d: 'ダイヤ', c: 'クラブ' };

// 何枚目かを示す枠色。
const SEL_BLUE = '#2563eb';
const SEL_GREEN = '#16a34a';
const SEL_RED = '#dc2626';

function selectionColor(mode: SelectorMode, index: number): string {
  if (mode === 'hand') return index === 0 ? SEL_BLUE : SEL_GREEN;
  // board
  if (index <= 2) return SEL_BLUE;
  if (index === 3) return SEL_GREEN;
  return SEL_RED;
}

export function CardSelector({ mode, initialSelected, usedByOthers, onCommit }: CardSelectorProps) {
  const max = mode === 'board' ? 5 : 2;
  const [selected, setSelected] = useState<Card[]>(() => [...initialSelected]);

  const close = () => onCommit(selected);

  const toggle = (card: Card) => {
    const key = cardToString(card);
    const idx = selected.findIndex((c) => cardToString(c) === key);
    if (idx >= 0) {
      // 再タップ → 選択解除。
      setSelected((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    if (selected.length >= max) return; // 既に必要枚数 → 追加不可。
    const next = [...selected, card];
    if (next.length >= max) {
      onCommit(next); // 必要枚数に達したので自動確定。
      return;
    }
    setSelected(next);
  };

  return (
    <div style={overlayStyle} onClick={close} role="dialog" aria-label="カード選択">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={headerTitleStyle}>カードを選択</span>
          <button type="button" onClick={close} style={closeBtnStyle} aria-label="閉じる">✕</button>
        </div>
        <div style={gridStyle}>
          {SUITS.map((suit) => (
            <div key={suit} style={rowStyle} aria-label={SUIT_LABEL[suit]}>
              {RANKS.map((rank) => {
                const card: Card = { rank, suit };
                const key = cardToString(card);
                const usedElsewhere = usedByOthers.has(key);
                const selIdx = selected.findIndex((c) => cardToString(c) === key);
                const isSelected = selIdx >= 0;
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={usedElsewhere}
                    aria-pressed={isSelected}
                    onClick={usedElsewhere ? undefined : () => toggle(card)}
                    aria-label={defaultPlayingCardAriaLabel(rank, suit)}
                    style={{
                      ...cellStyle,
                      background: SUIT_BG_COLORS[suit],
                      ...(usedElsewhere ? cellDisabledStyle : null),
                      ...(isSelected
                        ? { boxShadow: `inset 0 0 0 3px ${selectionColor(mode, selIdx)}` }
                        : null),
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
