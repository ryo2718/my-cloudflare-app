// Phase 2b': /strategy プリフロップ上部の 3 セレクタ (Open / Rake / Stack)。
// Open 起点の cascading: Open を選ぶと有効な Rake、Rake を選ぶと有効な Stack に絞り込む。
// 変更時は対応コンフィグの URL へ navigate (gto は root ノード、legacy 2.5x は config 直下)。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';
import {
  type OpenSize,
  type Rake,
  type PreflopV2Config,
  openOptions,
  rakeOptions,
  rakeLabel,
  stackOptions,
  resolveConfig,
} from '../../data/preflopV2/configs';

function targetUrl(cfg: PreflopV2Config): string {
  return cfg.source === 'gto' ? `/strategy/${cfg.id}/root` : `/strategy/${cfg.id}`;
}

function go(open: OpenSize, rake: Rake, stackBb: number) {
  const cfg = resolveConfig(open, rake, stackBb);
  if (cfg) navigate(targetUrl(cfg));
}

export function ConfigSelector({ current }: { current: PreflopV2Config }) {
  const opens = openOptions();
  const rakes = rakeOptions(current.open);
  const stacks = stackOptions(current.open, current.rake);

  const onOpen = (open: OpenSize) => {
    if (open === current.open) return;
    const rake = rakeOptions(open)[0];
    const stackBb = stackOptions(open, rake)[0];
    go(open, rake, stackBb);
  };
  const onRake = (rake: Rake) => {
    if (rake === current.rake) return;
    const stackBb = stackOptions(current.open, rake)[0];
    go(current.open, rake, stackBb);
  };
  const onStack = (stackBb: number) => {
    if (stackBb === current.stackBb) return;
    go(current.open, current.rake, stackBb);
  };

  return (
    <div style={wrapStyle}>
      <div style={rowStyle}>
        <span style={labelStyle}>Open</span>
        {opens.map((o) => (
          <button
            key={o}
            type="button"
            style={o === current.open ? activeBtn : btn}
            onClick={() => onOpen(o)}
          >
            {o}
          </button>
        ))}
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Rake</span>
        {rakes.map((r) => (
          <button
            key={r}
            type="button"
            style={r === current.rake ? activeBtn : btn}
            onClick={() => onRake(r)}
          >
            {rakeLabel(r)}
          </button>
        ))}
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Stack</span>
        <select
          style={selectStyle}
          value={current.stackBb}
          onChange={(e) => onStack(Number(e.target.value))}
        >
          {stacks.map((s) => (
            <option key={s} value={s}>
              {s}bb
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.6rem',
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  marginBottom: '0.9rem',
};
const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.4rem',
};
const labelStyle: CSSProperties = {
  minWidth: 48,
  fontSize: '0.78rem',
  fontWeight: 700,
  color: THEME.textSecondary,
};
const btn: CSSProperties = {
  minHeight: 44,
  padding: '0.4rem 0.9rem',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  fontSize: '0.9rem',
  color: THEME.textPrimary,
  cursor: 'pointer',
};
const activeBtn: CSSProperties = {
  ...btn,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 700,
};
const selectStyle: CSSProperties = {
  minHeight: 44,
  padding: '0.4rem 0.7rem',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  fontSize: '0.9rem',
  color: THEME.textPrimary,
};
