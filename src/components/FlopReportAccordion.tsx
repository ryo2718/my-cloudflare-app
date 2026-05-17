// Phase 4: 単一アコーディオン (DONK or CB)。
//
// 構造:
//   - ヘッダー (タップで開閉)
//   - 展開時:
//     - depth pill (srp / 3bp / 4bp / 5bp)
//     - 6×6 FlopReportMatrix
//     - 「既存のボードを選択」プレースホルダー (後日実装用)
//
// depth state は本 component が持つ (各アコーディオンが独立)。
// expanded は親 (FlopReportSection) が複数アコーディオンに跨る state として管理。

import { useState, type CSSProperties } from 'react';
import { THEME } from '../styles/theme';
import {
  FLOP_REPORT_DEPTHS,
  type BetRateThresholds,
  type FlopReportDepth,
} from '../data/flopReport';
import { FlopReportMatrix } from './FlopReportMatrix';

export interface FlopReportAccordionProps {
  title: string;
  scenario: 'donk' | 'cb';
  board: string | null;
  expanded: boolean;
  onToggle: () => void;
  thresholds?: BetRateThresholds;
}

export function FlopReportAccordion({
  title,
  scenario,
  board,
  expanded,
  onToggle,
  thresholds,
}: FlopReportAccordionProps) {
  const [depth, setDepth] = useState<FlopReportDepth>('srp');

  return (
    <div style={accordionStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={headerStyle}
        aria-expanded={expanded}
      >
        <span style={chevronStyle} aria-hidden>
          {expanded ? '▲' : '▼'}
        </span>
        <span style={titleStyle}>{title}</span>
        <span style={scenarioHintStyle}>
          ({scenario === 'cb' ? 'CB = 攻撃側の最初の bet' : 'Donk = 守備側 OOP の lead'})
        </span>
      </button>

      {expanded && (
        <div style={bodyStyle}>
          {/* Depth pill */}
          <div style={pillRowStyle} role="tablist" aria-label="Pot depth">
            {FLOP_REPORT_DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === depth}
                onClick={() => setDepth(d)}
                style={d === depth ? pillActiveStyle : pillStyle}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Matrix */}
          <FlopReportMatrix
            depth={depth}
            scenario={scenario}
            board={board}
            thresholds={thresholds}
          />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const accordionStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.7rem 0.95rem',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  color: THEME.textPrimary,
  textAlign: 'left',
};

const chevronStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  minWidth: '14px',
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  letterSpacing: '0.04em',
};

const scenarioHintStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  fontWeight: 400,
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
  padding: '0.85rem 1rem 1.1rem',
  borderTop: `1px solid ${THEME.border}`,
};

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  flexWrap: 'wrap',
};

const pillBaseStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: '999px',
  padding: '0.25rem 0.75rem',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const pillStyle: CSSProperties = {
  ...pillBaseStyle,
  background: 'transparent',
  color: THEME.textSecondary,
};

const pillActiveStyle: CSSProperties = {
  ...pillBaseStyle,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 600,
};

