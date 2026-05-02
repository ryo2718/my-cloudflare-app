import type { CSSProperties, MouseEvent } from 'react';
import type { PositionSelection } from '../../types/mobile';

interface Props {
  selection: PositionSelection;
  /** Home タップ → 全選択クリア */
  onReset: () => void;
  /** 中間セグメント (opener) タップ → responder のみクリア */
  onResetResponder: () => void;
}

// Phase 2B: open サイズは固定 (将来は SOLUTION 情報から動的取得)
const OPEN_SIZE_BB = '2.5bb';

interface Segment {
  label: string;
  onClick?: () => void;
  isCurrent: boolean;
}

/**
 * モバイル版 Breadcrumb (PC版とは独立)。
 * - opener のみ → 青系
 * - responder まで → 赤系
 * - "Home" は常にタップ可、中間 (opener) は responder 居る時のみタップ可、現在地は無効
 */
export function Breadcrumb({ selection, onReset, onResetResponder }: Props) {
  if (!selection.opener) return null;

  const isResponderActive = selection.responder !== null;

  const colors = isResponderActive
    ? { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' }
    : { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' };

  const segments: Segment[] = [
    { label: 'Home', onClick: onReset, isCurrent: false },
    {
      label: `${selection.opener} open (${OPEN_SIZE_BB})`,
      onClick: isResponderActive ? onResetResponder : undefined,
      isCurrent: !isResponderActive,
    },
  ];

  if (isResponderActive && selection.responder) {
    segments.push({
      label: `${selection.responder} action?`,
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
          <SegmentText seg={seg} hoverColor={colors.text} />
        </span>
      ))}
    </div>
  );
}

function SegmentText({ seg, hoverColor }: { seg: Segment; hoverColor: string }) {
  const isClickable = !!seg.onClick;

  const style: CSSProperties = {
    opacity: seg.isCurrent ? 1 : 0.7,
    fontWeight: seg.isCurrent ? 500 : 400,
    cursor: isClickable ? 'pointer' : 'default',
    textDecoration: 'underline',
    textDecorationColor: 'transparent',
    transition: 'text-decoration-color 0.15s',
  };

  const onMouseEnter = (e: MouseEvent<HTMLSpanElement>) => {
    if (isClickable) e.currentTarget.style.textDecorationColor = hoverColor;
  };
  const onMouseLeave = (e: MouseEvent<HTMLSpanElement>) => {
    if (isClickable) e.currentTarget.style.textDecorationColor = 'transparent';
  };

  return (
    <span
      onClick={seg.onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      {seg.label}
    </span>
  );
}
