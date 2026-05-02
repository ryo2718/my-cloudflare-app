import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Action, Strategy } from '../../types/strategy';
import { RANKS, getHandName } from '../../utils/hands';
import { HandPopup } from './HandPopup';

interface Props {
  strategy: Strategy;
  actions: Action[];
}

/** モバイル版の薄め色パレット (action.id → hex)。元 action.color を上書き。 */
const MOBILE_COLOR_MAP: Record<string, string> = {
  fold: '#60a5fa',
  call: '#4ade80',
  raise: '#f87171',
  allin: '#c084fc',
};

const POPUP_W = 110;
const POPUP_H = 140;
const PRESS_DELAY_MS = 300;
const VIEWPORT_PADDING = 4;

interface PinnedState {
  hand: string;
  freqs: number[];
  position: { top: number; left: number; width: number; height: number };
}

/**
 * モバイル版 HandMatrix。
 * - 13×13 セル + 黒グリッド線 (PC版と同レイアウト)
 * - 色は MOBILE_COLOR_MAP で薄めに上書き
 * - 各セル: 300ms の長押しで HandPopup を pin 表示
 *   - 指を離しても popup は閉じない (pinned)
 *   - 別のセルを長押し → そのセルに pin が切替
 *   - セル外 (Breadcrumb / ボタン / Aggregate / 余白等) をタップ → close
 *   - セルへのタップ (短押し) は no-op (pin 維持)
 *   - touchmove で timer をキャンセル → スクロール優先
 *   - PC でも mouseDown/Up で動作確認可
 */
export function MobileHandMatrix({ strategy, actions }: Props) {
  const [pinned, setPinned] = useState<PinnedState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lighterActions = useMemo<Action[]>(
    () => actions.map((a) => ({ ...a, color: MOBILE_COLOR_MAP[a.id] ?? a.color })),
    [actions],
  );

  const startPress = (hand: string, freqs: number[], el: HTMLElement) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let left = cx - POPUP_W / 2;
      let top = cy - POPUP_H / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
      if (left + POPUP_W > vw - VIEWPORT_PADDING) left = vw - POPUP_W - VIEWPORT_PADDING;
      if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;
      if (top + POPUP_H > vh - VIEWPORT_PADDING) top = vh - POPUP_H - VIEWPORT_PADDING;
      setPinned({ hand, freqs, position: { top, left, width: POPUP_W, height: POPUP_H } });
      timerRef.current = null;
    }, PRESS_DELAY_MS);
  };

  const cancelPendingTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // touchend / mouseup ではタイマーキャンセルだけ。pin は維持して「指を離しても表示し続ける」。
  const handleReleaseOnly = () => cancelPendingTimer();

  // 外部クリックで close。ただしハンドセル上のタップは no-op (pin 維持、長押しなら別セルに切替)。
  useEffect(() => {
    if (!pinned) return;
    const onOutside = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-mobile-cell="true"]')) return;
      setPinned(null);
    };
    document.addEventListener('touchstart', onOutside);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('touchstart', onOutside);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [pinned]);

  return (
    <>
      <div style={containerStyle}>
        <div style={gridStyle}>
          {RANKS.map((_, row) =>
            RANKS.map((_, col) => {
              const hand = getHandName(row, col);
              const freqs = (strategy as Record<string, number[]>)[hand];
              const key = `${row}-${col}`;
              if (!freqs) {
                return <div key={key} style={emptyCellStyle} />;
              }
              return (
                <Cell
                  key={key}
                  hand={hand}
                  frequencies={freqs}
                  actions={lighterActions}
                  onPressStart={(el) => startPress(hand, freqs, el)}
                  onPressEnd={handleReleaseOnly}
                  onPressMove={cancelPendingTimer}
                />
              );
            }),
          )}
        </div>
      </div>
      {pinned && (
        <HandPopup
          hand={pinned.hand}
          freqs={pinned.freqs}
          actions={lighterActions}
          position={pinned.position}
        />
      )}
    </>
  );
}

interface CellProps {
  hand: string;
  frequencies: number[];
  actions: Action[];
  onPressStart: (el: HTMLElement) => void;
  onPressEnd: () => void;
  /** スクロール開始時に長押しタイマーをキャンセル (popup未表示時のみ) */
  onPressMove: () => void;
}

function Cell({ hand, frequencies, actions, onPressStart, onPressEnd, onPressMove }: CellProps) {
  let cumulative = 0;
  const stops: string[] = [];
  frequencies.forEach((freq, i) => {
    if (freq <= 0) return;
    const start = cumulative * 100;
    cumulative += freq;
    const end = cumulative * 100;
    stops.push(`${actions[i].color} ${start}%, ${actions[i].color} ${end}%`);
  });
  const background =
    stops.length > 0 ? `linear-gradient(to top, ${stops.join(', ')})` : '#ede5d4';

  return (
    <div
      data-mobile-cell="true"
      style={cellStyle(background)}
      onTouchStart={(e) => onPressStart(e.currentTarget)}
      onTouchEnd={onPressEnd}
      onTouchCancel={onPressEnd}
      onTouchMove={onPressMove}
      onMouseDown={(e) => onPressStart(e.currentTarget)}
      onMouseUp={onPressEnd}
      onMouseLeave={onPressEnd}
    >
      {hand}
    </div>
  );
}

function cellStyle(background: string): CSSProperties {
  return {
    background,
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.55rem',
    fontWeight: 700,
    color: '#ffffff',
    textShadow:
      '0 1px 2px rgba(0,0,0,0.65), 0 0 1px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.45)',
    border: '1px solid #000000',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
  };
}

const containerStyle: CSSProperties = {
  background: '#fefdf9',
  borderRadius: '0.5rem',
  padding: '0.4rem',
  border: '2px solid #000000',
  width: '100%',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gap: 0,
};

const emptyCellStyle: CSSProperties = {
  background: '#ede5d4',
  border: '1px solid #000000',
  aspectRatio: '1',
};
