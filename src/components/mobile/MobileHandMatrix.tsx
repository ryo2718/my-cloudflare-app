import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
const VIEWPORT_PADDING = 4;

interface PinnedState {
  hand: string;
  freqs: number[];
  position: { top: number; left: number; width: number; height: number };
}

/**
 * モバイル版 HandMatrix。
 *  - タップで HandPopup を pin 表示 (黄色枠 + 拡大)
 *  - 同ハンド再タップ → 閉じる
 *  - 別ハンドタップ → 切替
 *  - セル外 (data-hand-cell が無い要素) をタップ → 閉じる
 *  - 長押しロジックは持たない (普通の click のみ)
 */
export function MobileHandMatrix({ strategy, actions }: Props) {
  const [pinned, setPinned] = useState<PinnedState | null>(null);

  const lighterActions = useMemo<Action[]>(
    () => actions.map((a) => ({ ...a, color: MOBILE_COLOR_MAP[a.id] ?? a.color })),
    [actions],
  );

  const handleTap = (hand: string, freqs: number[], el: HTMLElement) => {
    // 同じハンド再タップ → 閉じる
    if (pinned?.hand === hand) {
      setPinned(null);
      return;
    }
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
  };

  // popup 表示中、セル以外をタップで close。セル onClick は stopPropagation するので
  // セル内タップはここに来ない (= toggle/switch ロジックは onClick 側で完結)。
  useEffect(() => {
    if (!pinned) return;
    const onOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest('[data-hand-cell]')) {
        setPinned(null);
      }
    };
    document.addEventListener('click', onOutside);
    return () => document.removeEventListener('click', onOutside);
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
              // 親ノードに含まれないハンド (= sparse strategy で key 未定義) は空セル。
              // key が存在するハンドは GTO レンジ内なので、 fold 100% でも色塗り (青) する。
              const isUnreachable = !freqs || freqs.length === 0;
              if (isUnreachable) {
                return <div key={key} style={emptyCellStyle} />;
              }
              return (
                <Cell
                  key={key}
                  hand={hand}
                  frequencies={freqs}
                  actions={lighterActions}
                  onTap={(el) => handleTap(hand, freqs, el)}
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
  onTap: (el: HTMLElement) => void;
}

function Cell({ hand, frequencies, actions, onTap }: CellProps) {
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
      data-hand-cell="true"
      style={cellStyle(background)}
      onClick={(e) => {
        e.stopPropagation();
        onTap(e.currentTarget);
      }}
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
    cursor: 'pointer',
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
