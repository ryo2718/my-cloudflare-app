// § 1: FLOP 入力 (常時表示)。
//
// 構造:
//   - 上段: 3 slot [□] [□] [□] 表示 (空 / 選択中カード)
//   - 中段: 13×4 grid (FlopKeyboard)
//   - 下段: Reset + 正準化結果のヒント
//
// 動作:
//   - grid click → 最初の空 slot に追加
//   - 3 枚揃ったら getCanonicalBoardName で正準化 → 親に通知
//   - Reset で全クリア + 親に通知 (null)
//   - 選択済みカードは grid で disabled

import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import type { Card } from '../types/card';
import { SUIT_COLOR, SUIT_SYMBOL, containsCard } from '../types/card';
import { FlopKeyboard } from './FlopKeyboard';
import { getCanonicalBoardName } from '../data/flopBoardMap';
import { THEME } from '../styles/theme';

interface Props {
  /** 親 (FlopStrategyView) 側で保持する正準ボード名 (null = 未選択)。 */
  selectedBoard: string | null;
  /** 確定 (3 枚揃って canonicalize 完了) or 解除 (Reset) で通知。 */
  onBoardSelect: (canonicalName: string | null) => void;
}

export function FlopBoardInput({ selectedBoard, onBoardSelect }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // 親側で selectedBoard が null に戻された (= 別所からの解除) ら local cards もクリア
  useEffect(() => {
    if (selectedBoard === null && cards.length > 0) {
      // 親が外側でリセットした → local も合わせる (variant 切替時など)
      setCards([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoard]);

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
      <div style={headerRowStyle}>
        <div style={labelStyle}>Flop 入力</div>
        <button
          type="button"
          onClick={handleReset}
          disabled={cards.length === 0 && selectedBoard === null}
          style={
            cards.length === 0 && selectedBoard === null
              ? resetDisabledStyle
              : resetStyle
          }
        >
          ↻ Reset
        </button>
      </div>

      {/* 3 slot 表示 */}
      <div style={slotsStyle}>
        {[0, 1, 2].map((i) => {
          const c = cards[i];
          if (!c) {
            return (
              <div key={i} style={slotEmptyStyle} aria-label="empty slot">
                □
              </div>
            );
          }
          return (
            <div key={i} style={slotFilledStyle}>
              <span style={slotRankStyle}>{c.rank}</span>
              <span style={{ ...slotSuitStyle, color: SUIT_COLOR[c.suit] }}>
                {SUIT_SYMBOL[c.suit]}
              </span>
            </div>
          );
        })}
      </div>

      {/* 状態表示 */}
      {resolving && <div style={infoStyle}>正準化中…</div>}
      {error && <div style={errorStyle}>⚠ {error}</div>}
      {selectedBoard && cards.length === 3 && !error && !resolving && (
        <div style={resolvedHintStyle}>
          正準ボード: <code>{selectedBoard}</code>
        </div>
      )}

      {/* 13×4 grid */}
      <FlopKeyboard selectedCards={cards} onSelect={handleSelectCard} />
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
  padding: '0.85rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const labelStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: THEME.textSecondary,
  fontWeight: 700,
};

const slotsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.55rem',
  justifyContent: 'center',
};

const slotBaseStyle: CSSProperties = {
  width: '48px',
  height: '64px',
  borderRadius: '0.35rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.1rem',
  flexDirection: 'column',
};

const slotEmptyStyle: CSSProperties = {
  ...slotBaseStyle,
  background: THEME.bg,
  border: `1.5px dashed ${THEME.border}`,
  color: THEME.textFaint,
  fontSize: '1.5rem',
};

const slotFilledStyle: CSSProperties = {
  ...slotBaseStyle,
  background: '#fff',
  border: `1.5px solid ${THEME.borderStrong}`,
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
};

const slotRankStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#1f2937',
  lineHeight: 1,
};

const slotSuitStyle: CSSProperties = {
  fontSize: '1.1rem',
  lineHeight: 1,
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

const resolvedHintStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.accent,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};

const resetStyle: CSSProperties = {
  background: 'transparent',
  color: THEME.accent,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.25rem 0.65rem',
  fontSize: '0.74rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const resetDisabledStyle: CSSProperties = {
  ...resetStyle,
  color: THEME.textFaint,
  cursor: 'not-allowed',
};
