import type { CSSProperties } from 'react';
import { NODE_META } from '../../data/nodeMeta';
import { classifyAction } from '../../data/scenarios';
import { POSITION_ORDER, type MobileState, type Position } from '../../types/mobile';
import { ActionTooltip } from './ActionTooltip';

interface Props {
  state: MobileState;
  onTapOpener: (pos: Position) => void;
  onTapResponder: (pos: Position) => void;
}

interface LastAction {
  actor: Position;
  label: string;
  /** opener 側 / responder 側 — どちらのパネルに吹き出しを出すか */
  side: 'opener' | 'responder';
}

/**
 * OPENER と RESPONDER を 2 セットの 3列×2行で並べたピッカー。
 *  - グレーアウト判定はパネルごとに分離
 *  - locked (= historyPaths.length >= 3): 選択済み以外グレー
 *  - 直前のアクション (Stage 4+) は actor のボタン上に吹き出し
 */
export function DualPositionPicker({ state, onTapOpener, onTapResponder }: Props) {
  const lastAction = computeLastAction(state);
  const locked = state.historyPaths.length >= 3;

  return (
    <>
      <Panel
        title="OPENER"
        titleColor="#1e40af"
        kind="opener"
        selectedPos={state.opener}
        otherSelectedPos={state.responder}
        locked={locked}
        tooltip={lastAction?.side === 'opener' ? lastAction : null}
        onTap={onTapOpener}
      />
      <Panel
        title="RESPONDER"
        titleColor="#b91c1c"
        kind="responder"
        selectedPos={state.responder}
        otherSelectedPos={state.opener}
        locked={locked}
        tooltip={lastAction?.side === 'responder' ? lastAction : null}
        onTap={onTapResponder}
      />
    </>
  );
}

interface PanelProps {
  title: string;
  titleColor: string;
  kind: 'opener' | 'responder';
  selectedPos: Position | null;
  /** opener パネルなら responder 値、responder パネルなら opener 値 */
  otherSelectedPos: Position | null;
  locked: boolean;
  tooltip: LastAction | null;
  onTap: (pos: Position) => void;
}

function Panel({
  title,
  titleColor,
  kind,
  selectedPos,
  otherSelectedPos,
  locked,
  tooltip,
  onTap,
}: PanelProps) {
  const isTappable = (pos: Position): boolean => {
    if (kind === 'opener') {
      if (pos === 'BB') return false;
      if (locked && pos !== selectedPos) return false;
      return true;
    }
    // responder panel
    if (otherSelectedPos === null) return false; // opener 未選択
    if (pos === otherSelectedPos) return false;
    if (locked && pos !== selectedPos) return false;
    return true;
  };

  return (
    <div style={panelStyle}>
      <div style={{ ...titleStyle, color: titleColor }}>{title}</div>
      <div style={gridStyle}>
        {POSITION_ORDER.map((pos) => {
          const isSelected = selectedPos === pos;
          const tappable = isTappable(pos);
          const showTooltip = tooltip?.actor === pos;
          return (
            <button
              key={pos}
              type="button"
              onClick={() => tappable && onTap(pos)}
              disabled={!tappable}
              style={buttonStyle(kind, isSelected, tappable)}
            >
              {isSelected ? '✓ ' : ''}
              {pos}
              {showTooltip && tooltip && (
                <ActionTooltip
                  label={tooltip.label}
                  color={kind === 'opener' ? 'blue' : 'red'}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 直前 (= 現在 path) のアクションを抽出。Stage 4+ (historyPaths.length>=3) のみ非null。 */
function computeLastAction(state: MobileState): LastAction | null {
  if (state.historyPaths.length < 3) return null;
  const currentPath = state.historyPaths[state.historyPaths.length - 1];
  const meta = NODE_META[currentPath];
  if (!meta) return null;
  const cl = classifyAction(meta);
  if (!cl) return null;

  // 表示ラベル: 3bet/4bet/5bet/6bet はそのまま、all-in は "All-in"
  let label: string;
  if (
    cl.actionType === '3bet' ||
    cl.actionType === '4bet' ||
    cl.actionType === '5bet' ||
    cl.actionType === '6bet'
  ) {
    label = cl.actionType;
  } else if (cl.actionType === 'all-in') {
    label = 'All-in';
  } else {
    return null; // open/call/limp/fold は本UI で発生しない
  }

  const actor = cl.position as Position;
  const side: 'opener' | 'responder' = actor === state.opener ? 'opener' : 'responder';
  return { actor, label, side };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function buttonStyle(
  kind: 'opener' | 'responder',
  isSelected: boolean,
  tappable: boolean,
): CSSProperties {
  const base: CSSProperties = {
    padding: '12px 0',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: 'inherit',
    cursor: tappable ? 'pointer' : 'not-allowed',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    position: 'relative', // ActionTooltip の anchor
  };

  if (isSelected) {
    return kind === 'opener'
      ? {
          ...base,
          background: '#eff6ff',
          border: '1px solid #93c5fd',
          color: '#1e40af',
          fontWeight: 500,
        }
      : {
          ...base,
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#b91c1c',
          fontWeight: 500,
        };
  }

  if (!tappable) {
    return {
      ...base,
      background: '#ebe7df',
      border: '1px solid #d6cfc1',
      color: '#b0a18e',
    };
  }

  return {
    ...base,
    background: '#faf6f0',
    border: '1px solid #d6cfc1',
    color: '#3d2f1f',
  };
}

const panelStyle: CSSProperties = {
  background: '#fefdf9',
  border: '1px solid #d6cfc1',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '0.75rem',
};

const titleStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  marginBottom: '8px',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '6px',
};
