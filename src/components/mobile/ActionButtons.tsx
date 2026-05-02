import type { CSSProperties } from 'react';
import {
  computeAllinNodePath,
  computeRaisedNodePath,
  isAvailableNodePath,
} from '../../data/scenarios';
import {
  heroFromPath,
  nextRaiseLabel,
  oppositeHero,
  type Position,
} from '../../types/mobile';

interface Props {
  /** 現在表示中の node_path */
  currentPath: string;
  opener: Position;
  responder: Position;
  /** ボタン押下 → 新しい path を historyPaths に push */
  onAdvance: (newPath: string) => void;
}

/**
 * Phase 3 アクションボタン。「3bet/4bet/5bet/6bet」と「All-in」を横並び。
 *  - 次の path を computeRaisedNodePath / computeAllinNodePath で算出
 *  - manifest にあれば enable、無ければ button 自体を非表示 (両方無ければ ActionButtons 自体 null)
 *  - 押下で onAdvance(newPath) を発火
 */
export function ActionButtons({ currentPath, opener, responder, onAdvance }: Props) {
  const currentHero = heroFromPath(currentPath);
  // 現在 hero と opener/responder のどちらか一方が一致するはず — 不一致は理論上ありえない
  if (currentHero !== opener && currentHero !== responder) return null;

  const oppHero = oppositeHero(currentHero, opener, responder);

  const raiseTarget = computeRaisedNodePath(currentPath, oppHero);
  const allinTarget = computeAllinNodePath(currentPath, oppHero);
  const raiseAvailable = isAvailableNodePath(raiseTarget);
  const allinAvailable = isAvailableNodePath(allinTarget);

  // 両方とも進めない (= 終端ノード) なら何も出さない
  if (!raiseAvailable && !allinAvailable) return null;

  const raiseLabel = nextRaiseLabel(currentPath);

  return (
    <div style={containerStyle}>
      {raiseAvailable && (
        <button
          type="button"
          onClick={() => onAdvance(raiseTarget)}
          style={{ ...buttonBase, background: '#ef4444' }}
        >
          {raiseLabel} ▸
        </button>
      )}
      {allinAvailable && (
        <button
          type="button"
          onClick={() => onAdvance(allinTarget)}
          style={{ ...buttonBase, background: '#a855f7' }}
        >
          All-in ▸
        </button>
      )}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
  marginBottom: '0.75rem',
};

const buttonBase: CSSProperties = {
  padding: '10px',
  border: 'none',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
};
