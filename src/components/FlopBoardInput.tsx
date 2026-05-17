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
import { isSameCard } from '../types/card';
import { FlopKeyboard } from './FlopKeyboard';
import { getCanonicalBoardName } from '../data/flopBoardMap';
import { PlayingCard } from './PlayingCard';
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

  // 親側で selectedBoard が null に戻された場合 (e.g. variant 切替時の external reset、
  // 「Flop に進む」ボタンからの遷移) ら local cards もクリア。
  //
  // ⚠ ここの条件は `every` でないとダメ。`some` だと slot 個別 click → onBoardSelect(null)
  // の経路でも発火してしまい、残り 2 スロットを全消しするバグになる。
  // 「cards が完全に 3 枚揃ったまま selectedBoard だけ外部から null 化された」場合のみ
  // 外部リセットとみなす。部分状態 (slot click 直後の 2/3) は internal trigger とみなして
  // 保持する。
  useEffect(() => {
    if (selectedBoard === null && cards.every((c) => c !== null)) {
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

      {/* 3 slot 表示。filled は <PlayingCard size="lg"> (click で個別削除)、empty は静的 div */}
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
            <PlayingCard
              key={i}
              rank={c.rank}
              suit={c.suit}
              size="lg"
              onClick={() => handleSlotClick(i)}
              ariaLabel={`Remove ${c.rank}${c.suit}`}
            />
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

// 空 slot: PlayingCard.lg と同じサイズ (36×48) で見た目を揃える。
const slotEmptyStyle: CSSProperties = {
  width: 36,
  height: 48,
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: THEME.bg,
  border: `1.5px dashed ${THEME.border}`,
  color: THEME.textFaint,
  fontSize: '1.25rem',
  boxSizing: 'border-box',
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
