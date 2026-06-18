// Phase 2c: ピル状パンくず。アクション履歴を「ポジション + アクション」のピルで横並び。
// 各ピルはタップでそのノードへ遷移。最初の連続 fold (UTG/HJ 等) は省略。
// 色は単一定義 src/styles/actionColors.ts を参照。横スクロール対応。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { ACTION_COLOR } from '../../styles/actionColors';
import { THEME } from '../../styles/theme';
import { chainToStem, simulateChain, type ActionKind } from '../../data/preflopV2/chain';

function kindColor(kind: ActionKind): string {
  if (kind === 'allin') return ACTION_COLOR.allin;
  if (kind === 'raise') return ACTION_COLOR.raise;
  if (kind === 'call' || kind === 'limp') return ACTION_COLOR.call;
  return ACTION_COLOR.fold;
}
function actionLabel(kind: ActionKind, raiseLabel?: string): string {
  if (kind === 'raise' || kind === 'allin') return raiseLabel ?? kind;
  return kind; // call / limp / fold
}
// 暗い同系色 (現在ノードの枠) — HEX を 0.65 倍に暗くする。
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.65);
  const g = Math.round(((n >> 8) & 255) * 0.65);
  const b = Math.round((n & 255) * 0.65);
  return `rgb(${r},${g},${b})`;
}

export function Breadcrumb({ config, chain }: { config: string; chain: string }) {
  const actions = simulateChain(chain).actions;
  const tokens = chain ? chain.split('-') : [];
  // fold を全て省略 (raise系 / call / limp / allin のみピル化)。
  const pills = actions
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => a.kind !== 'fold');

  if (pills.length === 0) {
    return <div style={wrapStyle}><span style={rootStyle}>Root (UTG first)</span></div>;
  }

  return (
    <div style={wrapStyle}>
      {pills.map(({ a, idx }, i) => {
        const isLast = i === pills.length - 1;
        const prefixStem = chainToStem(tokens.slice(0, idx + 1).join('-'));
        const bg = kindColor(a.kind);
        return (
          <span key={idx} style={rowItem}>
            {i > 0 && <span style={sepStyle}>→</span>}
            <button
              type="button"
              onClick={() => navigate(`/strategy/${config}/${prefixStem}`)}
              style={{
                ...pillStyle,
                background: bg,
                border: isLast ? `2px solid ${darken(bg)}` : '2px solid transparent',
              }}
            >
              <span style={posStyle}>{a.seat}</span>
              <span>{actionLabel(a.kind, a.raiseLabel)}</span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: '2px',
  overflowX: 'auto',
  padding: '2px 0',
  marginBottom: '0.6rem',
};
const rowItem: CSSProperties = { display: 'flex', alignItems: 'center', flex: '0 0 auto' };
const sepStyle: CSSProperties = { color: THEME.textMuted, fontSize: '12px', margin: '0 2px' };
const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '5px',
  borderRadius: '999px',
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const posStyle: CSSProperties = { fontSize: '11px', opacity: 0.85 };
const rootStyle: CSSProperties = { fontSize: '13px', color: THEME.textSecondary };
