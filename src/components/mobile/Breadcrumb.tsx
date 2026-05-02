import { useState, type CSSProperties } from 'react';
import { labelForNodePath } from '../../data/scenarios';
import { heroFromPath, type Position } from '../../types/mobile';

interface Props {
  /** preflop node_path の累積。末尾が現在地。 空なら何も表示しない。 */
  historyPaths: string[];
  /** state.opener — 色判定 (現 hero === opener なら青、!== なら赤) */
  opener: Position | null;
  /** Home 押下: 全リセット */
  onReset: () => void;
  /**
   * 過去 segment 押下: historyPaths を newLength に切り詰める。
   *   newLength=1 → opener のみ (PositionPicker 再表示)
   *   newLength=2 → opener+responder (action 履歴クリア)
   * 等。 (Home は onReset 経由なので newLength=0 はここでは来ない)
   */
  onTruncate: (newLength: number) => void;
}

interface Segment {
  label: string;
  onClick?: () => void;
  isCurrent: boolean;
}

/**
 * モバイル版 Breadcrumb (paths-based, バグ修正版)。
 *
 * セグメント設計:
 *  - "Home" (常に index 0)
 *  - 過去 (index 1..N-1): label = labelForNodePath(historyPaths[k])
 *    historyPaths[k] の lastAction は「k 番目の遷移で取られたアクション」を返す。
 *    例) historyPaths=["utg","utgr_sb","utgr_sbr_utg"] では
 *        k=1: labelForNodePath("utgr_sb")        = "UTG open (2.5bb)" (UTGがopenした)
 *        k=2: labelForNodePath("utgr_sbr_utg")   = "SB 3bet (11bb)"   (SBが3bet した)
 *  - 現在地 (index N): "{hero} action?"。N=1 (opener のみ) は特例で "{POS} open (2.5bb)"
 *
 * 過去 segment k クリック → onTruncate(k) (= historyPaths.slice(0, k))
 *
 * 下線はホバー時のみ表示 (React state ベース、transparent underline は使わない)。
 */
export function Breadcrumb({ historyPaths, opener, onReset, onTruncate }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (historyPaths.length === 0 || !opener) return null;

  const N = historyPaths.length;
  const currentPath = historyPaths[N - 1];
  const currentHero = heroFromPath(currentPath);
  const isOpenerColor = currentHero === opener;

  const colors = isOpenerColor
    ? { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' }
    : { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' };

  const segments: Segment[] = [{ label: 'Home', isCurrent: false, onClick: onReset }];

  // 過去 (1..N-1): historyPaths[k] の lastAction が k 番目の遷移
  for (let k = 1; k <= N - 1; k++) {
    const path = historyPaths[k];
    segments.push({
      label: labelForNodePath(path) ?? path,
      onClick: () => onTruncate(k),
      isCurrent: false,
    });
  }

  // 現在地
  if (N === 1) {
    // opener のみ — opener の open 決定が現在地
    segments.push({
      label: `${historyPaths[0].toUpperCase()} open (2.5bb)`,
      isCurrent: true,
    });
  } else {
    segments.push({
      label: `${currentHero} action?`,
      isCurrent: true,
    });
  }

  return (
    <div
      style={{
        margin: '0 0 0.75rem',
        padding: '12px',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        lineHeight: 1.6,
        fontSize: '13px',
        color: colors.text,
      }}
    >
      {segments.map((seg, idx) => (
        <span key={idx}>
          {idx > 0 && <span style={{ margin: '0 4px', opacity: 0.5 }}>›</span>}
          <SegmentText
            seg={seg}
            isHovered={hoveredIdx === idx}
            onEnter={() => seg.onClick && setHoveredIdx(idx)}
            onLeave={() => setHoveredIdx(null)}
          />
        </span>
      ))}
    </div>
  );
}

function SegmentText({
  seg,
  isHovered,
  onEnter,
  onLeave,
}: {
  seg: Segment;
  isHovered: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const clickable = !!seg.onClick;
  const style: CSSProperties = {
    opacity: seg.isCurrent ? 1 : 0.7,
    fontWeight: seg.isCurrent ? 500 : 400,
    cursor: clickable ? 'pointer' : 'default',
    // ホバー時のみ underline、それ以外は完全に none (transparent ハック使わない)
    textDecoration: clickable && isHovered ? 'underline' : 'none',
  };
  return (
    <span onClick={seg.onClick} onMouseEnter={onEnter} onMouseLeave={onLeave} style={style}>
      {seg.label}
    </span>
  );
}
