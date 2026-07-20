// Phase X4: 全6ポジション (UTG/HJ/CO/BTN/SB/BB) × 4選択肢 (allin/raise/call|limp/fold) の
// グリッド。1画面に全ポジションの全選択肢が並び、各セル 1 タップでそのシナリオへ遷移する。
// セル判定 (どのセルが色付き/グレー/確定か、遷移先 stem) は data/preflopV2/gridColumns.ts。
// 本ファイルは描画のみ。
// 色: アクションボタンは actionColors (濃色)。グレーは uiColors。色は全て import。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { ACTION_COLOR } from '../../styles/actionColors';
import { THEME } from '../../styles/theme';
import { actorPosition, type ActionKind, type Seat } from '../../data/preflopV2/chain';
import { buildGridColumns, ROW_KINDS, type Cell } from '../../data/preflopV2/gridColumns';
import { PREFLOP_UI } from '../../data/preflopV2/uiColors';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

function kindColor(kind: ActionKind): string {
  if (kind === 'allin') return ACTION_COLOR.allin;
  if (kind === 'raise') return ACTION_COLOR.raise;
  if (kind === 'call' || kind === 'limp') return ACTION_COLOR.call;
  return ACTION_COLOR.fold;
}

export function PositionActionGrid({
  config,
  node,
  index,
}: {
  config: string;
  node: PreflopV2Node;
  index: PreflopV2Index;
}) {
  const actor = actorPosition(node) as Seat;
  const columns = buildGridColumns(node, index);

  return (
    <div style={rowStyle}>
      {columns.map(({ seat, cells }) => (
        <div key={seat} style={colStyle}>
          <div style={seat === actor ? headActiveStyle : headStyle}>{seat}</div>
          <div style={cellsColStyle}>
            {cells.map((c, i) => (
              <GridCell key={`${seat}-${ROW_KINDS[i]}`} cell={c} config={config} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GridCell({ cell, config }: { cell: Cell; config: string }) {
  if (cell.kind === 'empty') return <div style={emptyCellStyle} />;
  if (cell.kind === 'grey') {
    return (
      <div style={{ ...cellBase, background: PREFLOP_UI.disabledBg, color: PREFLOP_UI.disabledText }}>
        {cell.label}
      </div>
    );
  }
  const bg = kindColor(cell.actionKind ?? 'fold');
  if (cell.kind === 'committed' || !cell.toStem) {
    return <div style={{ ...cellBase, background: bg, color: '#ffffff' }}>{cell.label}</div>;
  }
  return (
    <button
      type="button"
      style={{ ...cellBase, background: bg, color: '#ffffff', border: 'none', cursor: 'pointer' }}
      onClick={() => navigate(`/strategy/${config}/${cell.toStem}`)}
    >
      {cell.label}
    </button>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: '3px',
  alignItems: 'flex-start',
  width: '100%',
};
const colStyle: CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};
const cellsColStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const headStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '13px',
  fontWeight: 600,
  color: THEME.textSecondary,
  padding: '2px 0',
};
const headActiveStyle: CSSProperties = { ...headStyle, fontWeight: 800, color: THEME.textPrimary };
const cellBase: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: '46px',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.1,
  padding: '12px 2px',
  borderRadius: '10px',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const emptyCellStyle: CSSProperties = { width: '100%', minHeight: '46px' };
