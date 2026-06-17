// Phase 2a: 「次のアクション」ボタン群。現ノードの actor が取れる選択肢のうち、
// index に実在する子ノードを持つものだけをボタン化する。クリックで遷移。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';
import { actorPosition, nextActions } from '../../data/preflopV2/chain';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

export function NextActionButtons({
  config,
  node,
  index,
}: {
  config: string;
  node: PreflopV2Node;
  index: PreflopV2Index;
}) {
  const actor = actorPosition(node);
  const actions = nextActions(node, index);

  if (actions.length === 0) {
    return <p style={leafStyle}>このラインはここで終了です（リーフ）。</p>;
  }

  return (
    <div>
      <p style={labelStyle}>
        次のアクション（<strong>{actor}</strong> の選択）
      </p>
      <div style={colStyle}>
        {actions.map((a) => (
          <button
            key={a.token}
            type="button"
            style={buttonStyle}
            onClick={() => navigate(`/strategy/${config}/${a.childStem}`)}
          >
            <span style={actorBadgeStyle}>{actor}</span>
            <span>{a.actionLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.85rem',
  color: THEME.textSecondary,
};
const colStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  width: '100%',
  minHeight: 48,
  padding: '0.6rem 0.9rem',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.6rem',
  fontSize: '0.95rem',
  color: THEME.textPrimary,
  cursor: 'pointer',
  textAlign: 'left',
};
const actorBadgeStyle: CSSProperties = {
  flex: '0 0 auto',
  minWidth: 38,
  padding: '0.15rem 0.4rem',
  background: THEME.accent,
  color: '#fff',
  borderRadius: '0.3rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  textAlign: 'center',
};
const leafStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textMuted,
  textAlign: 'center',
  padding: '0.5rem 0',
};
