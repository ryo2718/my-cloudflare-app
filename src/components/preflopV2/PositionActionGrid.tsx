// Phase 2c: 6 列 (UTG/HJ/CO/BTN/SB/BB) のポジション別アクショングリッド。
// 縦並びボタン (旧 NextActionButtons) の代替。
//   - 確定済の席: 1 セルに圧縮 (履歴)。auto-fold はグレー。
//   - 現在の actor 列: フォーカス (赤い丸枠)。available actions を縦に表示しタップで前進。
//     順序 = allin(紫) / raise(赤, open/3bet/...) / call|limp(緑) / fold(青)。
//   - 未行動の席: 自動補完ショートカット (間を全員 fold して その席の決定ノードへ)。
// 色は単一定義 src/styles/actionColors.ts を参照。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { ACTION_COLOR } from '../../styles/actionColors';
import { THEME } from '../../styles/theme';
import {
  SEAT_ORDER,
  ROOT_STEM,
  type Seat,
  type ActionKind,
  actorPosition,
  chainToStem,
  tokenToStem,
  countRaisesInChain,
  foldAroundStem,
  isLimpNode,
  raiseName,
  simulateChain,
} from '../../data/preflopV2/chain';
import { PREFLOP_UI } from '../../data/preflopV2/uiColors';
import type { PreflopV2Index, PreflopV2Node } from '../../data/preflopV2/types';

function kindColor(kind: ActionKind): string {
  if (kind === 'allin') return ACTION_COLOR.allin;
  if (kind === 'raise') return ACTION_COLOR.raise;
  if (kind === 'call' || kind === 'limp') return ACTION_COLOR.call;
  return ACTION_COLOR.fold;
}

interface Cell {
  label: string;
  kind: ActionKind;
  /** タップで遷移する stem。null なら非タップ (確定済表示)。 */
  toStem: string | null;
  auto?: boolean; // auto-fold (グレー)
  disabled?: boolean; // データ無しでグレーアウト (call 等)
}

function classifyToken(token: string): ActionKind {
  if (token === 'F') return 'fold';
  if (token === 'RAI') return 'allin';
  if (token === 'C' || token === 'X') return 'call';
  return 'raise';
}

const KIND_RANK: Record<ActionKind, number> = { allin: 0, raise: 1, limp: 2, call: 2, fold: 3 };

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
  const limp = isLimpNode(node);

  // 各席の確定済アクション (最新)。
  const committed = new Map<Seat, { kind: ActionKind; label: string }>();
  for (const a of sim.actions) {
    let label: string;
    if (a.kind === 'raise' || a.kind === 'allin') label = a.raiseLabel ?? a.kind;
    else label = a.kind; // call / limp / fold
    committed.set(a.seat, { kind: a.kind, label });
  }

  // フォーカス列 (現 actor) の選択肢。legend 駆動 + データ無しはグレーアウト。
  //   - raise(3bet/...): legend にあれば常に表示 (子ノードは常に実在)
  //   - call: 常に表示。子が無ければグレーアウト (消さない)
  //   - fold: 常に表示
  //   - allin: legend に RAI かつ子が実在する場合のみ
  const stem = chainToStem(chain);
  const kids = new Set(index.nodes[stem] ?? []);
  const focusCells: Cell[] = [];
  for (const token of Object.keys(node.actions_legend)) {
    const kind = classifyToken(token);
    const childStem = stem === ROOT_STEM ? tokenToStem(token) : `${stem}_${tokenToStem(token)}`;
    const has = kids.has(childStem);
    if ((kind === 'raise' || kind === 'allin') && !has) continue; // 取れない raise/allin は出さない
    let label: string;
    let cellKind: ActionKind = kind;
    if (kind === 'raise') label = raiseName(priorRaises);
    else if (kind === 'allin') label = 'All-in';
    else if (kind === 'call') {
      label = limp ? 'limp' : 'call';
      cellKind = limp ? 'limp' : 'call';
    } else label = 'fold';
    focusCells.push({ label, kind: cellKind, toStem: has ? childStem : null, disabled: !has });
  }
  focusCells.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);

  const actorIdx = SEAT_ORDER.indexOf(actor);

  return (
    <div style={rowStyle}>
      {SEAT_ORDER.map((seat) => {
        const isFocus = seat === actor;
        const done = committed.get(seat);
        const seatIdx = SEAT_ORDER.indexOf(seat);

        let cells: Cell[] = [];
        if (isFocus) {
          cells = focusCells;
        } else if (done) {
          const auto = done.kind === 'fold';
          cells = [{ label: done.label, kind: done.kind, toStem: null, auto }];
        } else if (seatIdx > actorIdx) {
          // 未行動の席: 自動補完で その席の決定ノードへ。
          const jumpStem = foldAroundStem(chain, seat, index);
          if (jumpStem && jumpStem !== stem) {
            cells = [{ label: raiseName(priorRaises), kind: 'raise', toStem: jumpStem }];
          }
        }

        return (
          <div key={seat} style={colStyle}>
            <div style={isFocus ? headFocusStyle : headStyle}>{seat}</div>
            <div style={isFocus ? cellsFocusStyle : cellsStyle}>
              {cells.map((c, i) => (
                <CellButton key={`${seat}-${i}`} cell={c} config={config} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CellButton({ cell, config }: { cell: Cell; config: string }) {
  const grey = cell.auto || cell.disabled;
  const bg = grey ? PREFLOP_UI.disabledBg : kindColor(cell.kind);
  const fg = grey ? PREFLOP_UI.disabledText : '#ffffff';
  if (!cell.toStem) {
    return (
      <div style={{ ...cellBase, background: bg, color: fg, cursor: 'default' }}>{cell.label}</div>
    );
  }
  return (
    <button
      type="button"
      style={{ ...cellBase, background: bg, color: fg, border: 'none', cursor: 'pointer' }}
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
const headStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 600,
  color: THEME.textSecondary,
  padding: '2px 0',
};
const headFocusStyle: CSSProperties = {
  ...headStyle,
  fontWeight: 800,
  color: PREFLOP_UI.focusBorder,
};
const cellsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '2px',
  border: '2.5px solid transparent',
  borderRadius: '13px',
};
const cellsFocusStyle: CSSProperties = {
  ...cellsStyle,
  border: `2.5px solid ${PREFLOP_UI.focusBorder}`,
};
const cellBase: CSSProperties = {
  width: '100%',
  minWidth: 0,
  fontSize: '11px',
  fontWeight: 700,
  lineHeight: 1.1,
  padding: '8px 2px',
  borderRadius: '7px',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
