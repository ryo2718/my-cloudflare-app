// 「フロップを指定」専用ボタンで開閉する flop 入力 UI。
// FlopKeyboard で 3 枚選ばせ、揃った瞬間に flopBoardMap で正準化 → 親に通知。
//
// 注: 親 (FlopStrategyView) は `selectedBoard` state を持ち、本コンポーネントの
// onBoardSelect 通知で更新。本コンポーネント自体は visual な選択 cards を local state で持つ。

import { useState, useCallback, type CSSProperties } from 'react';
import type { Card } from '../types/card';
import { containsCard } from '../types/card';
import { FlopKeyboard } from './FlopKeyboard';
import { getCanonicalBoardName } from '../data/flopBoardMap';
import { THEME } from '../styles/theme';

interface Props {
  /** 現在選択中の正準 board 名 (null = 未選択)。表示用。 */
  selectedBoard: string | null;
  /** 確定時 or 解除時に呼ばれる。null は「未選択に戻す」。 */
  onBoardSelect: (canonicalName: string | null) => void;
}

export function FlopBoardInput({ selectedBoard, onBoardSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const resolveBoard = useCallback(
    async (flop: Card[]): Promise<void> => {
      setResolving(true);
      setError(null);
      try {
        const triplet: [Card, Card, Card] = [flop[0], flop[1], flop[2]];
        const canonical = await getCanonicalBoardName(triplet);
        if (canonical === null) {
          setError('該当 iso class データなし');
        } else {
          onBoardSelect(canonical);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setResolving(false);
      }
    },
    [onBoardSelect],
  );

  const handleSelectCard = (c: Card) => {
    if (cards.length >= 3) return;
    if (containsCard(cards, c)) return;
    const next = [...cards, c];
    setCards(next);
    if (next.length === 3) {
      // 3 枚揃い次第、即 canonicalize
      void resolveBoard(next);
    }
  };

  const handleReset = () => {
    setCards([]);
    setError(null);
    onBoardSelect(null);
  };

  return (
    <div style={containerStyle}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={toggleStyle}
      >
        <span>{open ? '▲' : '▼'} フロップを指定</span>
        {selectedBoard && (
          <span style={selectedHintStyle}>
            選択中: <code>{selectedBoard}</code>
          </span>
        )}
      </button>
      {open && (
        <div style={panelStyle}>
          <FlopKeyboard
            selectedCards={cards}
            onSelect={handleSelectCard}
            onReset={handleReset}
          />
          {resolving && <div style={infoStyle}>正準化中…</div>}
          {error && <div style={errorStyle}>⚠ {error}</div>}
          <div style={hintStyle}>
            3 枚選ぶと自動的にデータの正準代表ボードに変換され、「Board 別解」リストの
            該当ボードがハイライトされます。「Reset」で選択解除。
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.55rem 0.75rem',
};

const toggleStyle: CSSProperties = {
  background: 'transparent',
  color: THEME.textSecondary,
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  fontFamily: 'inherit',
  padding: '0.25rem 0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
};

const selectedHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.accent,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 600,
};

const panelStyle: CSSProperties = {
  marginTop: '0.65rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const infoStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
};

const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.35rem 0.55rem',
};

const hintStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textFaint,
  fontStyle: 'italic',
};
