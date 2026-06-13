// フロップ中級CB のハンドレンジグリッド (13x13)。
// 各セルはそのハンドの混合戦略を6色ランプ (flopSizeColor) で「積み上げ」表示 (案A)。
// セルタップでそのハンドの混合戦略の内訳バー (FlopCbReviewDetail) を下に表示。
// プリフロップ用 HandRangeMatrix は4アクション固定 (共有) のため流用せず、フロップ用に新設。

import { useState, type CSSProperties } from 'react';
import { HandGrid } from '../HandGrid';
import { FlopCbReviewDetail } from './FlopCbReviewDetail';
import { flopSizeColor, flopCbLabel } from './flopCbChoiceStyle';
import type { FlopCbStrat } from '../../data/training/flopIntermediateCb';

// 積み上げ順 (上→下)。
const STACK_ORDER = ['check', '33', '50', '75', '125', 'ALLIN'] as const;
const DETAIL_CHOICES = ['check', '33', '50', '75', '125'];

interface Segment {
  color: string;
  ratio: number; // %
}
function cellSegments(strat: FlopCbStrat | undefined): Segment[] | null {
  if (!strat) return null;
  const total = STACK_ORDER.reduce((s, k) => s + (strat[k] ?? 0), 0);
  if (total <= 0) return null;
  return STACK_ORDER.filter((k) => (strat[k] ?? 0) > 0).map((k) => ({
    color: flopSizeColor(k),
    ratio: ((strat[k] ?? 0) / total) * 100,
  }));
}

export function FlopHandGrid({
  hands,
  highlightHand,
  caption,
}: {
  hands: Record<string, FlopCbStrat>;
  highlightHand?: string;
  caption?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const detail = selected && hands[selected] ? hands[selected] : null;

  return (
    <figure style={figureStyle} aria-label={caption ?? 'ハンドレンジグリッド'}>
      {caption && <figcaption style={captionStyle}>{caption}</figcaption>}
      <HandGrid
        role="grid"
        gridStyle={gridStyle}
        renderCell={(hand) => (
          <Cell
            hand={hand}
            segments={cellSegments(hands[hand])}
            highlight={hand === highlightHand}
            selected={hand === selected}
            onClick={hands[hand] ? () => setSelected((p) => (p === hand ? null : hand)) : undefined}
          />
        )}
      />
      <Legend />
      {detail && (
        <div style={detailStyle}>
          <div style={detailHeadStyle}>{selected} の混合戦略</div>
          <FlopCbReviewDetail choices={DETAIL_CHOICES} strat={detail} selections={[]} />
        </div>
      )}
    </figure>
  );
}

function Cell({
  hand,
  segments,
  highlight,
  selected,
  onClick,
}: {
  hand: string;
  segments: Segment[] | null;
  highlight: boolean;
  selected: boolean;
  onClick?: () => void;
}) {
  const isEmpty = !segments || segments.length === 0;
  const outline = highlight ? '3px solid #FFEB3B' : selected ? '3px solid #b45309' : 'none';
  const style: CSSProperties = {
    ...cellBase,
    background: isEmpty ? '#f5f1ea' : 'transparent',
    color: isEmpty ? '#b0a18e' : '#fff',
    textShadow: isEmpty ? 'none' : '0 1px 2px rgba(0,0,0,0.55)',
    outline,
    outlineOffset: highlight || selected ? '-2px' : undefined,
    fontWeight: highlight ? 700 : 500,
    zIndex: highlight || selected ? 1 : undefined,
    cursor: onClick ? 'pointer' : undefined,
  };
  return (
    <div style={style} role={onClick ? 'button' : 'gridcell'} aria-label={hand} onClick={onClick}>
      {!isEmpty && (
        <div style={layerStackStyle} aria-hidden>
          {segments!.map((seg, i) => (
            <div key={i} style={{ height: `${seg.ratio}%`, background: seg.color, width: '100%' }} />
          ))}
        </div>
      )}
      <span style={cellLabelStyle}>{hand}</span>
    </div>
  );
}

function Legend() {
  return (
    <div style={legendStyle} aria-label="凡例">
      {DETAIL_CHOICES.map((k) => (
        <span key={k} style={legendItemStyle}>
          <span style={{ ...swatchStyle, background: flopSizeColor(k) }} aria-hidden />
          {flopCbLabel(k)}
        </span>
      ))}
    </div>
  );
}

const figureStyle: CSSProperties = { margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const captionStyle: CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#6b5a48', letterSpacing: '0.04em' };
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gridAutoRows: '1fr', gap: '1px',
  background: '#d6cfc1', border: '1px solid #d6cfc1', aspectRatio: '1', width: '100%', maxWidth: 360,
};
const cellBase: CSSProperties = {
  fontSize: '0.6rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  position: 'relative', overflow: 'hidden',
};
const layerStackStyle: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' };
const cellLabelStyle: CSSProperties = { position: 'relative', zIndex: 2 };
const legendStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.72rem', color: '#6b5a48' };
const legendItemStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.3rem' };
const swatchStyle: CSSProperties = { width: 12, height: 12, borderRadius: 2, display: 'inline-block' };
const detailStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const detailHeadStyle: CSSProperties = { fontSize: '0.8rem', fontWeight: 700, color: '#3d2f1f' };
