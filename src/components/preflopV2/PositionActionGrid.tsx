// Phase X4: 全6ポジション (UTG/HJ/CO/BTN/SB/BB) × 4選択肢 (allin/raise/call|limp/fold) の
// グリッド。1画面に全ポジションの全選択肢が並び、各セル 1 タップでそのシナリオへ遷移する。
//   - 未行動の列: 4 セル。そのアクションがデータにあれば色付きタップ可、無ければグレーアウト。
//   - 行動済み (= 現 actor 以外で既に確定) / 降りた列: 確定アクションを該当行に 1 セルのみ表示。
//   - 現 actor の列は常に 4 セル (今の決定)。フォーカス強調枠は廃止。
// 行き先は foldAround で「間の席を全員 fold」して各ポジションの決定ノードへ skip-connect。
// 色: アクションボタンは actionColors (濃色)。グレーは uiColors。色は全て import。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { ACTION_COLOR } from '../../styles/actionColors';
import { THEME } from '../../styles/theme';
import {
  SEAT_ORDER,
  type Seat,
  type ActionKind,
  actorPosition,
  countRaisesInChain,
  foldAroundStem,
  raiseName,
  simulateChain,
} from '../../data/preflopV2/chain';
import { PREFLOP_UI } from '../../data/preflopV2/uiColors';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

// 行の固定順 (上→下)。call 行は limp ノードで "limp" 表示。
const ROW_KINDS: ActionKind[] = ['allin', 'raise', 'call', 'fold'];

function kindColor(kind: ActionKind): string {
  if (kind === 'allin') return ACTION_COLOR.allin;
  if (kind === 'raise') return ACTION_COLOR.raise;
  if (kind === 'call' || kind === 'limp') return ACTION_COLOR.call;
  return ACTION_COLOR.fold;
}

function classifyToken(token: string): ActionKind {
  if (token === 'F') return 'fold';
  if (token === 'RAI') return 'allin';
  if (token === 'C' || token === 'X') return 'call';
  return 'raise';
}
function sizeOf(token: string): number {
  const m = token.match(/^R(\d+(?:[._]\d+)?)$/);
  return m ? Number(m[1].replace('_', '.')) : 0;
}

interface Cell {
  kind: 'empty' | 'committed' | 'action' | 'grey';
  label?: string;
  actionKind?: ActionKind; // 色決定用
  toStem?: string | null;
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
  const chain = node._meta.preflop_actions;
  const sim = simulateChain(chain);
  const actor = actorPosition(node) as Seat;
  const priorRaises = countRaisesInChain(chain);

  // 確定アクション (最新)。現 actor は除外 (4 択を出すため)。
  const committed = new Map<Seat, { kind: ActionKind; label: string }>();
  for (const a of sim.actions) {
    const label = a.kind === 'raise' || a.kind === 'allin' ? a.raiseLabel ?? a.kind : a.kind;
    committed.set(a.seat, { kind: a.kind, label });
  }

  // 列 (ポジション) ごとに 4 行分の Cell を作る。
  const columns: { seat: Seat; cells: Cell[] }[] = SEAT_ORDER.map((seat) => {
    const done = seat !== actor ? committed.get(seat) : undefined;
    if (done) {
      // 確定 / 降りた列: 該当行のみ 1 セル。
      const cells = ROW_KINDS.map<Cell>((rowKind) => {
        const matches = rowKind === 'call' ? done.kind === 'call' || done.kind === 'limp' : rowKind === done.kind;
        if (!matches) return { kind: 'empty' };
        const label = done.kind === 'limp' ? 'limp' : done.label;
        // fold (= 降りた/auto) はグレー、それ以外は確定色。
        if (done.kind === 'fold') return { kind: 'grey', label: 'fold' };
        return { kind: 'committed', actionKind: done.kind, label };
      });
      return { seat, cells };
    }

    // 未行動 (現 actor 含む): foldAround で この席の決定ノードへ。
    const pStem = foldAroundStem(chain, seat, index);
    const children = pStem ? index.nodes[pStem] ?? [] : [];
    const limp = priorRaises === 0;
    const cells = ROW_KINDS.map<Cell>((rowKind) => {
      // この行に該当する子ノード (raise は最小サイズ)。
      const matches = children
        .map((cs) => ({ cs, token: pStem === 'root' ? cs : cs.slice((pStem as string).length + 1) }))
        .filter(({ token }) => {
          const k = classifyToken(token);
          return rowKind === 'call' ? k === 'call' : k === rowKind;
        })
        .sort((a, b) => sizeOf(a.token) - sizeOf(b.token));
      let label: string;
      if (rowKind === 'allin') label = 'All-in';
      else if (rowKind === 'raise') label = raiseName(priorRaises);
      else if (rowKind === 'call') label = limp ? 'limp' : 'call';
      else label = 'fold';
      if (matches.length === 0) return { kind: 'grey', label };
      return {
        kind: 'action',
        actionKind: rowKind === 'call' && limp ? 'limp' : rowKind,
        label,
        toStem: matches[0].cs,
      };
    });
    return { seat, cells };
  });

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
  fontSize: '11px',
  fontWeight: 600,
  color: THEME.textSecondary,
  padding: '2px 0',
};
const headActiveStyle: CSSProperties = { ...headStyle, fontWeight: 800, color: THEME.textPrimary };
const cellBase: CSSProperties = {
  width: '100%',
  minWidth: 0,
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: 1.1,
  padding: '8px 2px',
  borderRadius: '6px',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const emptyCellStyle: CSSProperties = { width: '100%', minHeight: '31px' };
