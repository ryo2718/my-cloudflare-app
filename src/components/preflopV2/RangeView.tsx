// Phase 2a: メインのレンジ表示画面。パンくず + HandMatrix (既存流用) + 次手ボタン +
// 戻る / 最初に戻る。multiway / 2way いずれも actor 視点の 4 アクション頻度で描画。

import { type CSSProperties, useMemo, useState } from 'react';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';
import { HandMatrix } from '../HandMatrix';
import { AggregateReport } from '../AggregateReport';
import { Breadcrumb } from './Breadcrumb';
import { PositionActionGrid } from './PositionActionGrid';
import { findConfig } from '../../data/preflopV2/configs';
import { usePreflopIndex, usePreflopNode } from '../../hooks/usePreflopStrategy';
import { nodeToStrategy, PREFLOP_V2_ACTIONS, PREFLOP_V2_MATRIX_ACTIONS } from '../../data/preflopV2/strategy';
import { actorPosition, activePositions, parentStem } from '../../data/preflopV2/chain';
import { PREFLOP_UI } from '../../data/preflopV2/uiColors';

export function RangeView({ config, stem }: { config: string; stem: string }) {
  const cfg = findConfig(config);
  const node = usePreflopNode(cfg ? config : null, cfg ? stem : null);
  const index = usePreflopIndex(cfg ? config : null);
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);

  const strategy = useMemo(
    () => (node.data ? nodeToStrategy(node.data) : null),
    [node.data],
  );

  if (!cfg) return <Info text={`未知の config: ${config}`} />;
  if (node.loading || index.loading) return <Info text="読み込み中…" />;
  if (node.error || !node.data || !strategy) {
    return <Info text="ノードを取得できませんでした (R2 未アップロードの可能性)" />;
  }

  const actor = actorPosition(node.data);
  const active = activePositions(node.data);
  const parent = parentStem(node.data._meta.preflop_actions);

  const goBack = () => {
    if (parent) navigate(`/strategy/${config}/${parent}`);
    else navigate(`/strategy/${config}/root`);
  };

  return (
    <div>
      <Breadcrumb config={config} chain={node.data._meta.preflop_actions} />

      <div style={titleRowStyle}>
        <span style={actorTitleStyle}>現在: {actor} の戦略</span>
        <span style={wayStyle}>{active.length}way</span>
      </div>

      <div style={matrixWrapStyle}>
        <div style={matrixFrameStyle}>
          <HandMatrix
            strategy={strategy}
            actions={[...PREFLOP_V2_MATRIX_ACTIONS]}
            hoveredHand={hoveredHand}
            onHover={setHoveredHand}
          />
        </div>
      </div>

      <div style={aggregateWrapStyle}>
        <AggregateReport strategy={strategy} actions={[...PREFLOP_V2_ACTIONS]} />
      </div>

      {index.data ? (
        <PositionActionGrid config={config} node={node.data} index={index.data} />
      ) : null}

      <div style={navRowStyle}>
        <button type="button" style={navBtnStyle} onClick={goBack}>
          ← 戻る
        </button>
        <button
          type="button"
          style={navBtnStyle}
          onClick={() => navigate(`/strategy/${config}/root`)}
        >
          最初に戻る
        </button>
      </div>
    </div>
  );
}

function Info({ text }: { text: string }) {
  return (
    <div>
      <p style={{ textAlign: 'center', color: THEME.textSecondary, padding: '1.5rem 0' }}>
        {text}
      </p>
      <div style={navRowStyle}>
        <button type="button" style={navBtnStyle} onClick={() => navigate('/strategy')}>
          最初に戻る
        </button>
      </div>
    </div>
  );
}

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};
const actorTitleStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const wayStyle: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#fff',
  background: THEME.textSecondary,
  borderRadius: '0.3rem',
  padding: '0.15rem 0.5rem',
};
const matrixWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '0.9rem',
};
const matrixFrameStyle: CSSProperties = {
  border: `2px solid ${PREFLOP_UI.matrixFrame}`,
  borderRadius: '4px',
  padding: '2px',
  background: PREFLOP_UI.matrixFrame,
};
const aggregateWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '0.9rem',
};
const navRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  marginTop: '1rem',
};
const navBtnStyle: CSSProperties = {
  flex: 1,
  minHeight: 48,
  padding: '0.6rem',
  background: 'transparent',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.6rem',
  color: THEME.textSecondary,
  fontSize: '0.9rem',
  cursor: 'pointer',
};
