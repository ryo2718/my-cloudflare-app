// Phase X5: ハンドのセルをタップしたとき、その混合戦略 (各アクション頻度) を拡大表示。
// 旧 2.5x の HandPopup 相当を preflopV2 で再実装。色はマトリクスと同じパレットを参照
// (色のハードコードなし)。背景タップ or × で閉じる。

import { type CSSProperties } from 'react';
import type { Action } from '../../types/strategy';
import { THEME } from '../../styles/theme';

export function HandDetailPopup({
  hand,
  frequencies,
  actions,
  onClose,
}: {
  hand: string;
  /** [fold, call, raise, allin] を 0-1 で。actions と同順。 */
  frequencies: number[];
  actions: ReadonlyArray<Action>;
  onClose: () => void;
}) {
  return (
    <div style={overlayStyle} onClick={onClose} role="presentation">
      <div style={cardStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${hand} strategy`}>
        <div style={headerRowStyle}>
          <span style={handNameStyle}>{hand}</span>
          <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {actions.map((a, i) => {
            const pct = Math.round((frequencies[i] ?? 0) * 1000) / 10;
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={labelStyle}>{a.label}</span>
                <div style={barTrackStyle}>
                  <div style={{ ...barFillStyle, width: `${pct}%`, background: a.color }} />
                </div>
                <span style={pctStyle}>{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
};
const cardStyle: CSSProperties = {
  background: THEME.card,
  border: `2px solid ${THEME.borderStrong}`,
  borderRadius: '0.8rem',
  padding: '1rem 1.1rem',
  width: '100%',
  maxWidth: '360px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
};
const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.8rem',
};
const handNameStyle: CSSProperties = { fontSize: '1.8rem', fontWeight: 800, color: THEME.textPrimary };
const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.6rem',
  lineHeight: 1,
  color: THEME.textSecondary,
  cursor: 'pointer',
  padding: '0 0.3rem',
};
const labelStyle: CSSProperties = {
  flex: '0 0 56px',
  fontSize: '0.85rem',
  fontWeight: 700,
  color: THEME.textSecondary,
};
const barTrackStyle: CSSProperties = {
  flex: 1,
  height: '18px',
  background: THEME.cellEmpty,
  borderRadius: '4px',
  overflow: 'hidden',
};
const barFillStyle: CSSProperties = { height: '100%', borderRadius: '4px' };
const pctStyle: CSSProperties = {
  flex: '0 0 52px',
  textAlign: 'right',
  fontSize: '0.85rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
