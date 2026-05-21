// 13×13 ハンドマトリクスのポップアップ (頻度付き)。
//   - グレー=未選択(weight 0) / 黄色=全コンボ weight 1 / 緑=一部 or 部分頻度
//   - ハンドをタップ: 全選択 (グレー/緑→黄, weight 1) or 全解除 (黄→グレー) + コンボ詳細を展開
//   - コンボ詳細 (4×4) で個別コンボをトグル (タップ→weight 1, 再タップ→0)
//   - プリセット (GTO) ピッカーで頻度付きレンジを読み込み → そこから手動調整可
//   - 全選択 / クリアの一括ボタン、選択コンボ割合% を表示
//   - 閉じる (✕) / 背景タップで確定

import { useState, type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';
import { TOTAL_COMBOS, allComboKeys, handAt, handKeys, type MatrixHand } from '../../utils/combos';
import type { AppliedPreset, PresetInfo } from '../../utils/presetRange';
import { ComboDetail } from './ComboDetail';
import { PresetRangePicker } from './PresetRangePicker';

const CELL_FULL = '#fcd34d';
const CELL_PARTIAL = '#86efac';

export interface RangeMatrixProps {
  /** コンボ key → weight (0..1)。 */
  initialRange: ReadonlyMap<string, number>;
  /** 既に適用済みのプリセット (再編集時に引き継ぐ)。 */
  initialPreset: AppliedPreset | null;
  onCommit: (range: Map<string, number>, preset: AppliedPreset | null) => void;
  onCancel: () => void;
}

export function RangeMatrix({ initialRange, initialPreset, onCommit }: RangeMatrixProps) {
  const [selected, setSelected] = useState<Map<string, number>>(() => new Map(initialRange));
  const [presetApplied, setPresetApplied] = useState<AppliedPreset | null>(initialPreset);
  const [expanded, setExpanded] = useState<{ row: number; col: number } | null>(null);

  const pct = ((selected.size / TOTAL_COMBOS) * 100).toFixed(1);

  const handState = (h: MatrixHand): 'empty' | 'partial' | 'full' => {
    const keys = handKeys(h);
    let any = false;
    let allFull = true;
    for (const k of keys) {
      const w = selected.get(k) ?? 0;
      if (w > 0) any = true;
      if (w < 1) allFull = false;
    }
    if (!any) return 'empty';
    if (allFull) return 'full';
    return 'partial';
  };

  const onHandClick = (row: number, col: number) => {
    const keys = handKeys(handAt(row, col));
    setSelected((prev) => {
      const next = new Map(prev);
      const full = keys.every((k) => (next.get(k) ?? 0) >= 1);
      if (full) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.set(k, 1));
      return next;
    });
    setExpanded({ row, col });
  };

  // 手動タップ: weight 1 ↔ 0 (部分頻度のコンボは 1 に引き上げ)。
  const toggleCombo = (key: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if ((next.get(key) ?? 0) >= 1) next.delete(key);
      else next.set(key, 1);
      return next;
    });
  };

  const selectAll = () => setSelected(new Map(allComboKeys().map((k) => [k, 1])));
  const clearAll = () => setSelected(new Map());

  const applyPreset = (range: Map<string, number>, info: PresetInfo) => {
    setSelected(new Map(range));
    setPresetApplied({ info, snapshot: new Map(range) });
    setExpanded(null);
  };

  const close = () => onCommit(selected, presetApplied);

  const expandedHand = expanded ? handAt(expanded.row, expanded.col) : null;

  return (
    <div style={overlayStyle} onClick={close} role="dialog" aria-label="レンジ選択">
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={headerTitleStyle}>レンジ {selected.size}コンボ ({pct}%)</span>
          <button type="button" onClick={close} style={closeBtnStyle} aria-label="閉じる">✕</button>
        </div>

        <PresetRangePicker onApply={applyPreset} />

        <div style={toolbarStyle}>
          <button type="button" style={toolBtnStyle} onClick={selectAll}>全選択</button>
          <button type="button" style={toolBtnStyle} onClick={clearAll}>クリア</button>
        </div>
        <div style={gridStyle}>
          {Array.from({ length: 13 }, (_, row) =>
            Array.from({ length: 13 }, (_, col) => {
              const h = handAt(row, col);
              const st = handState(h);
              const bg = st === 'full' ? CELL_FULL : st === 'partial' ? CELL_PARTIAL : THEME.cellEmpty;
              const isExp = expanded?.row === row && expanded?.col === col;
              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  onClick={() => onHandClick(row, col)}
                  style={{ ...cellStyle, background: bg, ...(isExp ? cellExpStyle : null) }}
                >
                  {h.label}
                </button>
              );
            }),
          )}
        </div>
        {expandedHand && <ComboDetail hand={expandedHand} selected={selected} onToggle={toggleCombo} />}
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
  maxHeight: '92vh',
  overflowY: 'auto',
};
const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};
const headerTitleStyle: CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: THEME.textPrimary };
const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.2rem',
  color: THEME.textSecondary,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const toolbarStyle: CSSProperties = { display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' };
const toolBtnStyle: CSSProperties = {
  padding: '0.35rem 0.7rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gap: 2,
};
const cellStyle: CSSProperties = {
  aspectRatio: '1 / 1',
  border: `1px solid ${THEME.border}`,
  borderRadius: 3,
  fontSize: 'clamp(7px, 1.7vw, 11px)',
  fontWeight: 600,
  color: THEME.textPrimary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
};
const cellExpStyle: CSSProperties = { outline: `2px solid ${THEME.accent}`, outlineOffset: -2 };
