import type { CSSProperties } from 'react';
import {
  POSITION_ORDER,
  canSelectAsOpener,
  canSelectAsResponder,
  type Position,
  type PositionSelection,
} from '../../types/mobile';

interface Props {
  selection: PositionSelection;
  onTap: (pos: Position) => void;
}

/**
 * 3列×2行のポジション選択ボタン群。
 *  - 1回目タップ (opener): 青、BB は選択不可
 *  - 2回目タップ (responder): 赤、opener より後ろの席のみ
 *  - 2つ選択済み状態でもう1つ別ポジションをタップ → リセット (新 opener)
 */
export function PositionPicker({ selection, onTap }: Props) {
  /** タップ可能か (リセット時は全選択可、ただし opener と同じはNG) */
  const isTappable = (pos: Position): boolean => {
    if (selection.opener === pos || selection.responder === pos) return true; // 既選択は表示更新だけ
    if (!selection.opener) return canSelectAsOpener(pos);
    if (!selection.responder) return canSelectAsResponder(selection.opener, pos);
    // 2つ選択済み → リセットして新 opener。BBは依然 NG
    return canSelectAsOpener(pos);
  };

  const handleClick = (pos: Position) => {
    if (!isTappable(pos)) return;
    // 既に opener として選択済みのものを再タップ → no-op
    if (selection.opener === pos && selection.responder === null) return;
    // 既に responder として選択済みのものを再タップ → no-op
    if (selection.responder === pos) return;
    onTap(pos);
  };

  return (
    <div style={containerStyle}>
      {!selection.opener && <div style={titleStyle}>ポジションを選択</div>}
      <div style={gridStyle}>
        {POSITION_ORDER.map((pos) => {
          const isOpener = selection.opener === pos;
          const isResponder = selection.responder === pos;
          const checkmark = isOpener || isResponder ? '✓ ' : '';
          return (
            <button
              key={pos}
              type="button"
              onClick={() => handleClick(pos)}
              style={getButtonStyle(pos, selection)}
              disabled={!isTappable(pos)}
            >
              {checkmark}
              {pos}
            </button>
          );
        })}
      </div>
      {!selection.opener && <div style={hintStyle}>※ BB は最初に選べません</div>}
    </div>
  );
}

function getButtonStyle(pos: Position, selection: PositionSelection): CSSProperties {
  const base: CSSProperties = {
    padding: '12px 0',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'center',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
  };

  // opener (青)
  if (selection.opener === pos) {
    return {
      ...base,
      background: '#eff6ff',
      border: '1px solid #93c5fd',
      color: '#1e40af',
      fontWeight: 500,
    };
  }
  // responder (赤)
  if (selection.responder === pos) {
    return {
      ...base,
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      color: '#b91c1c',
      fontWeight: 500,
    };
  }

  // 選択不可
  const canSelect = !selection.opener
    ? canSelectAsOpener(pos)
    : !selection.responder
      ? canSelectAsResponder(selection.opener, pos)
      : canSelectAsOpener(pos); // 2つ選択済み = リセット可能 (BBは NG)

  if (!canSelect) {
    return {
      ...base,
      background: '#ebe7df',
      border: '1px solid #d6cfc1',
      color: '#b0a18e',
      cursor: 'not-allowed',
    };
  }

  // 通常
  return {
    ...base,
    background: '#faf6f0',
    border: '1px solid #d6cfc1',
    color: '#3d2f1f',
  };
}

const containerStyle: CSSProperties = {
  background: '#fefdf9',
  border: '1px solid #d6cfc1',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '0.75rem',
};

const titleStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b5a48',
  marginBottom: '8px',
  fontWeight: 500,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '6px',
};

const hintStyle: CSSProperties = {
  fontSize: '11px',
  color: '#b0a18e',
  marginTop: '8px',
  textAlign: 'center',
};
