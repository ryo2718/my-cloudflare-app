import type { CSSProperties, MouseEvent } from 'react';
import { labelForNodePath } from '../../data/scenarios';
import { heroFromPath, type Position } from '../../types/mobile';

interface Props {
  /** preflop node_path の累積。末尾が現在地。 空なら何も表示しない。 */
  historyPaths: string[];
  /** state の opener (色判定: 現在地 hero === opener なら青、!== なら赤) */
  opener: Position | null;
  /** Home 押下: 全リセット */
  onReset: () => void;
  /** index 0..length-2 を押下: そこまで戻す (= historyPaths.slice(0, index+1)) */
  onTruncate: (index: number) => void;
}

interface Segment {
  label: string;
  onClick?: () => void;
  isCurrent: boolean;
}

/**
 * モバイル版 Breadcrumb (paths-based, Phase 3 対応)。
 *
 * 表示ルール:
 *  - "Home" — 常に左端、タップで全リセット
 *  - 各 historyPath:
 *    - 過去 (last でない): labelForNodePath() 結果。RFI root はフォールバックで "{POS} open (2.5bb)"
 *    - 現在 (last): RFI root なら同じく "{POS} open (2.5bb)"、それ以外は "{hero} action?"
 *  - 色: 現在地の hero === opener → 青、!== → 赤 (responder 側)
 */
export function Breadcrumb({ historyPaths, opener, onReset, onTruncate }: Props) {
  if (historyPaths.length === 0 || !opener) return null;

  const currentPath = historyPaths[historyPaths.length - 1];
  const currentHero = heroFromPath(currentPath);
  const isOpenerColor = currentHero === opener;

  const colors = isOpenerColor
    ? { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' }
    : { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' };

  const segments: Segment[] = [{ label: 'Home', onClick: onReset, isCurrent: false }];
  for (let i = 0; i < historyPaths.length; i++) {
    const path = historyPaths[i];
    const isLast = i === historyPaths.length - 1;
    segments.push({
      label: makeLabel(path, isLast),
      onClick: isLast ? undefined : () => onTruncate(i),
      isCurrent: isLast,
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
          <SegmentText seg={seg} hoverColor={colors.text} />
        </span>
      ))}
    </div>
  );
}

/** path → 表示ラベル。RFI root と current 非root で形式が違う */
function makeLabel(path: string, isLast: boolean): string {
  const segs = path.split('_');
  if (segs.length === 1) {
    // RFI root (e.g. "utg") — labelForNodePath は null を返すのでフォールバック
    return `${segs[0].toUpperCase()} open (2.5bb)`;
  }
  if (isLast) {
    // 現在地 — "{hero} action?" 形式
    const hero = segs[segs.length - 1].toUpperCase();
    return `${hero} action?`;
  }
  // 過去の non-root segment — 取られたアクションそのもの
  return labelForNodePath(path) ?? path;
}

function SegmentText({ seg, hoverColor }: { seg: Segment; hoverColor: string }) {
  const clickable = !!seg.onClick;
  const style: CSSProperties = {
    opacity: seg.isCurrent ? 1 : 0.7,
    fontWeight: seg.isCurrent ? 500 : 400,
    cursor: clickable ? 'pointer' : 'default',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    transition: 'text-decoration-color 0.15s',
  };
  const onMouseEnter = (e: MouseEvent<HTMLSpanElement>) => {
    if (clickable) e.currentTarget.style.textDecorationColor = hoverColor;
  };
  const onMouseLeave = (e: MouseEvent<HTMLSpanElement>) => {
    if (clickable) e.currentTarget.style.textDecorationColor = 'transparent';
  };
  return (
    <span onClick={seg.onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={style}>
      {seg.label}
    </span>
  );
}
