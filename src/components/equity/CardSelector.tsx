// カード選択パネル: 4 スート × 13 ランクのグリッドを画面上部にポップアップ。
//   - 個別モード (max=1): タップした 1 枚で即確定して閉じる (枠色なし / トグルなし)
//   - 範囲モード (max≥2): max 枚を連続選択。順番に格納、再タップで解除、
//     selectionColors[index] の枠色が付く。必要枚数に達したら自動で確定して閉じる
//   - 「閉じる」ボタンは無し。背景タップでキャンセル (変更を破棄)
//   - 他グループで使用中のカードはグレーアウト (選択不可)

import { useState, type CSSProperties } from 'react';
import { RANKS, SUITS, cardToString, type Card, type Suit } from '../../types/card';
import { SUIT_BG_COLORS, defaultPlayingCardAriaLabel } from '../PlayingCard.helpers';
import { THEME } from '../../styles/theme';

export interface CardSelectorProps {
  /** 選択する枚数。1=個別 (1枚で即確定)、2/3/5=範囲 (連続選択)。 */
  max: number;
  /** index → 枠色 (範囲モードのみ使用)。 */
  selectionColors: ReadonlyArray<string>;
  /** 既にこの対象に入っているカード (順序付き)。範囲モードは選択済み状態で開く。 */
  initialSelected: ReadonlyArray<Card>;
  /** 他で使用中のカード文字列集合 (例: "Ah")。選択不可。 */
  usedByOthers: ReadonlySet<string>;
  /** 確定 (必要枚数に到達) 時に順序付き選択カードを返す。 */
  onCommit: (cards: Card[]) => void;
  /** 背景タップで閉じる (変更を破棄)。 */
  onCancel: () => void;
}

const SUIT_LABEL: Record<Suit, string> = { s: 'スペード', h: 'ハート', d: 'ダイヤ', c: 'クラブ' };

export function CardSelector({ max, selectionColors, initialSelected, usedByOthers, onCommit, onCancel }: CardSelectorProps) {
  const single = max === 1;
  const [selected, setSelected] = useState<Card[]>(() => [...initialSelected]);

  const colorFor = (index: number): string =>
    selectionColors[Math.min(index, selectionColors.length - 1)] ?? THEME.accent;

  const handleTap = (card: Card) => {
    if (single) {
      // 個別モード: 1 枚タップで即確定。
      onCommit([card]);
      return;
    }
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
    <div style={overlayStyle} onClick={onCancel} role="dialog" aria-label="カード選択">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={headerTitleStyle}>カードを選択</span>
        </div>
        <div style={gridStyle}>
          {SUITS.map((suit) => (
            <div key={suit} style={rowStyle} aria-label={SUIT_LABEL[suit]}>
              {RANKS.map((rank) => {
                const card: Card = { rank, suit };
                const key = cardToString(card);
                const usedElsewhere = usedByOthers.has(key);
                const selIdx = single ? -1 : selected.findIndex((c) => cardToString(c) === key);
                const isSelected = selIdx >= 0;
                return (
                  <button
                    key={rank}
                    type="button"
                    disabled={usedElsewhere}
                    aria-pressed={isSelected}
                    onClick={usedElsewhere ? undefined : () => handleTap(card)}
                    aria-label={defaultPlayingCardAriaLabel(rank, suit)}
                    style={{
                      ...cellStyle,
                      background: SUIT_BG_COLORS[suit],
                      ...(usedElsewhere ? cellDisabledStyle : null),
                      ...(isSelected ? { boxShadow: `inset 0 0 0 3px ${colorFor(selIdx)}` } : null),
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
  marginBottom: '0.6rem',
};
const headerTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: THEME.textPrimary };

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
