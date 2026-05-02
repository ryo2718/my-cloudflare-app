import type { CSSProperties } from 'react';

interface Props {
  /** 吹き出しに表示するテキスト (例: "3bet", "4bet", "All-in") */
  label: string;
  /** opener=blue / responder=red */
  color: 'red' | 'blue';
}

/**
 * ポジションボタンの上に浮く吹き出し (再利用可能)。
 * - 親要素が position:relative の前提
 * - 矢印は2層 (外側=border色、内側=background色) で枠線まで再現
 * - pointer-events:'none' で下のボタンのタップを邪魔しない
 */
export function ActionTooltip({ label, color }: Props) {
  const c =
    color === 'red'
      ? { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' }
      : { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: '11px',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: '5px',
        whiteSpace: 'nowrap',
        zIndex: 10,
        pointerEvents: 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {label}
      {/* 矢印 外側 (border 色) */}
      <div style={arrowOuter(c.border)} />
      {/* 矢印 内側 (background 色) */}
      <div style={arrowInner(c.bg)} />
    </div>
  );
}

const arrowOuter = (color: string): CSSProperties => ({
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '5px solid transparent',
  borderRight: '5px solid transparent',
  borderTop: `5px solid ${color}`,
});

const arrowInner = (color: string): CSSProperties => ({
  position: 'absolute',
  top: 'calc(100% - 1px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '4px solid transparent',
  borderRight: '4px solid transparent',
  borderTop: `4px solid ${color}`,
});
