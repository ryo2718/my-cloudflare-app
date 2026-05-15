// § 1: FLOP 入力 (常時表示)。
//
// state モデル (改修):
//   - cards: (Card | null)[] 固定長 3
//   - 3 slot は個別にクリア可 (slot click → そのインデックスを null に)
//   - グリッド click → 「最初の null スロット」に挿入
//   - 既選択カードはグリッドで disabled、3 スロットが全部埋まれば自動 canonicalize
//
// メリット: 真ん中だけ間違えた等のケースで 1 タップ修正できる。

import { useState, useCallback, useEffect, type CSSProperties } from 'react';
import type { Card } from '../types/card';
import { SUIT_COLOR, SUIT_SYMBOL, isSameCard } from '../types/card';
import { FlopKeyboard } from './FlopKeyboard';
import { getCanonicalBoardName } from '../data/flopBoardMap';
import { THEME } from '../styles/theme';

interface Props {
  /** 親 (FlopStrategyView) 側で保持する正準ボード名 (null = 未選択)。 */
  selectedBoard: string | null;
  /** 確定 (3 枚揃って canonicalize 完了) or 解除 (Reset / slot 個別 click) で通知。 */
  onBoardSelect: (canonicalName: string | null) => void;
}

const EMPTY_SLOTS: ReadonlyArray<Card | null> = [null, null, null];

export function FlopBoardInput({ selectedBoard, onBoardSelect }: Props) {
  const [cards, setCards] = useState<(Card | null)[]>(() => [...EMPTY_SLOTS]);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // 親側で selectedBoard が null に戻された (= 別所からの解除) ら local cards もクリア。
  // 既存パターン: prop 変化を internal state に sync する controlled-input 風挙動。
  useEffect(() => {
    if (selectedBoard === null && cards.some((c) => c !== null)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCards([...EMPTY_SLOTS]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBoard]);

  const resolveBoard = useCallback(
    async (triplet: [Card, Card, Card]): Promise<void> => {
      setResolving(true);
      setError(null);
      try {
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

  /** グリッドから card 選択 → 最初の null スロットに入れる。 */
  const handleGridCardClick = (c: Card) => {
    // 既に選択中のカードは無視
    if (cards.some((x) => x !== null && isSameCard(x, c))) return;
    const emptyIndex = cards.findIndex((x) => x === null);
    if (emptyIndex === -1) return; // 空きなし
    const next = [...cards];
    next[emptyIndex] = c;
    setCards(next);
    // 3 枚揃ったら canonicalize
    if (next.every((x) => x !== null)) {
      void resolveBoard(next as [Card, Card, Card]);
    }
  };

  /** スロット click → そのインデックスを null に (個別削除)。 */
  const handleSlotClick = (index: number) => {
    if (cards[index] === null) return;
    const next = [...cards];
    next[index] = null;
    setCards(next);
    setError(null);
    // canonicalize 済の board は無効化
    if (selectedBoard !== null) {
      onBoardSelect(null);
    }
  };

  const handleReset = () => {
    setCards([...EMPTY_SLOTS]);
    setError(null);
    onBoardSelect(null);
  };

  // FlopKeyboard には non-null だけ渡す (それが disabled 判定の元)
  const filledCards = cards.filter((c): c is Card => c !== null);
  const hasAny = filledCards.length > 0;

  return (
    <div style={containerStyle}>
      <div style={headerRowStyle}>
        <div style={labelStyle}>Flop 入力</div>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasAny && selectedBoard === null}
          style={!hasAny && selectedBoard === null ? resetDisabledStyle : resetStyle}
        >
          ↻ Reset
        </button>
      </div>

      {/* 3 slot 表示。filled は button (click で個別削除)、empty は静的 div */}
      <div style={slotsStyle}>
        {[0, 1, 2].map((i) => {
          const c = cards[i];
          if (!c) {
            return (
              <div key={i} style={slotEmptyStyle} aria-label={`empty slot ${i + 1}`}>
                □
              </div>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSlotClick(i)}
              style={slotFilledStyle}
              title={`${c.rank}${SUIT_SYMBOL[c.suit]} (タップで削除)`}
              aria-label={`Remove ${c.rank}${c.suit}`}
            >
              <span style={slotRankStyle}>{c.rank}</span>
              <span style={{ ...slotSuitStyle, color: SUIT_COLOR[c.suit] }}>
                {SUIT_SYMBOL[c.suit]}
              </span>
            </button>
          );
        })}
      </div>

      {/* 状態表示 */}
      {resolving && <div style={infoStyle}>正準化中…</div>}
      {error && <div style={errorStyle}>⚠ {error}</div>}
      {selectedBoard && filledCards.length === 3 && !error && !resolving && (
        <div style={resolvedHintStyle}>
          正準ボード: <code>{selectedBoard}</code>
        </div>
      )}

      {/* 13×4 grid */}
      <FlopKeyboard selectedCards={filledCards} onSelect={handleGridCardClick} />
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
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
  // hover で削除可能と示唆するための subtle transition
  transition: 'background 0.1s, border-color 0.1s',
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
