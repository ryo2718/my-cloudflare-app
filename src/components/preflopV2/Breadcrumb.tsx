// Phase 2a: 折りたたみ可能なパンくず。config ラベル + アクション連鎖のステップを表示。

import { type CSSProperties, useState } from 'react';
import { THEME } from '../../styles/theme';
import { chainSteps } from '../../data/preflopV2/chain';

export function Breadcrumb({ configLabel, chain }: { configLabel: string; chain: string }) {
  const [open, setOpen] = useState(false);
  const steps = chainSteps(chain);
  const summary = steps.length === 0 ? 'Root (UTG first)' : steps.join(' → ');

  return (
    <div style={wrapStyle}>
      <button
        type="button"
        style={headerStyle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={configStyle}>{configLabel}</span>
        <span style={caretStyle}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <ol style={listStyle}>
          {steps.length === 0 ? (
            <li style={itemStyle}>Root (UTG first to act)</li>
          ) : (
            steps.map((s, i) => (
              <li key={`${i}-${s}`} style={itemStyle}>
                {s}
              </li>
            ))
          )}
        </ol>
      ) : (
        <div style={summaryStyle}>{summary}</div>
      )}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.4rem 0.6rem',
  marginBottom: '0.6rem',
};
const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: THEME.textPrimary,
};
const configStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 700 };
const caretStyle: CSSProperties = { fontSize: '0.7rem', color: THEME.textMuted };
const summaryStyle: CSSProperties = {
  marginTop: '0.25rem',
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  whiteSpace: 'nowrap',
  overflowX: 'auto',
};
const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
  listStyle: 'none',
  margin: '0.4rem 0 0',
  padding: 0,
};
const itemStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  padding: '0.1rem 0.4rem',
};
