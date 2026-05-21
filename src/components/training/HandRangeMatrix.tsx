// 中級振り返り用の 13x13 ハンドレンジマトリクス。
//
// 設計:
//   - 対角線: ペア (AA → 22)
//   - 上三角 (列 > 行): スーテッド (AKs, KQs, ...)
//   - 下三角 (列 < 行): オフスート (AKo, KQo, ...)
//   - 各セルは戦略のドミナントアクション色で塗る
//   - fold 主要 or 全戦略 0% は薄い灰色 (= "描画しない" 相当の薄表示)
//   - highlightHand が指定されればそのセルを濃い枠線で強調
//
// 既存の戦略タブ (FlopReportMatrix) は flop 後専用かつ別の戦略型を扱うため流用せず、
// preflop の BB 応答レンジ用に薄い実装を新規に用意 (副作用回避)。

import type { CSSProperties } from 'react';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { ACTION_BG, MATRIX_RANKS, cellHand, paintCell } from './HandRangeMatrix.helpers';

export interface HandRangeMatrixProps {
  /** 戦略マップ: hand 表記 ("AA", "AKs", "72o" 等) → HandStrategy。 */
  hands: Record<string, HandStrategy>;
  /** 強調表示するハンド (出題ハンド)。 */
  highlightHand?: string;
  /** タイトル/キャプション。 */
  caption?: string;
  /** セルタップ時に呼ぶ (指定時はセルがタップ可能になる)。 */
  onSelect?: (hand: string) => void;
  /** タップで選択中のハンド (枠で示す)。 */
  selectedHand?: string;
}

export function HandRangeMatrix({ hands, highlightHand, caption, onSelect, selectedHand }: HandRangeMatrixProps) {
  return (
    <figure style={figureStyle} aria-label={caption ?? 'ハンドレンジマトリクス'}>
      {caption && <figcaption style={captionStyle}>{caption}</figcaption>}
      <div style={gridStyle} role="grid">
        {MATRIX_RANKS.map((_, row) =>
          MATRIX_RANKS.map((__, col) => {
            const hand = cellHand(row, col);
            const strategy = hands[hand];
            const { segments } = paintCell(strategy);
            return (
              <Cell
                key={`${row}-${col}`}
                hand={hand}
                segments={segments}
                highlight={hand === highlightHand}
                selected={hand === selectedHand}
                onClick={onSelect ? () => onSelect(hand) : undefined}
              />
            );
          }),
        )}
      </div>
      <Legend showCheck={Object.values(hands).some((h) => (h.check ?? 0) > 0)} />
    </figure>
  );
}

function Cell({
  hand,
  segments,
  highlight,
  selected = false,
  onClick,
}: {
  hand: string;
  segments: import('./HandRangeMatrix.helpers').CellSegment[] | null;
  highlight: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  // segments null → 描画なし (薄灰)
  // ある → 各セグメントを flex 縦積みで明示的に描画 (上から allin/raise/call/fold)
  const isEmpty = !segments || segments.length === 0;
  // 出題ハンド=黄枠。タップ選択中 (出題ハンド以外) =アクセント枠。
  const outline = highlight ? '3px solid #FFEB3B' : selected ? '3px solid #b45309' : 'none';
  const baseStyle: CSSProperties = {
    ...cellBase,
    background: isEmpty ? '#f5f1ea' : 'transparent',
    color: isEmpty ? '#b0a18e' : '#3d2f1f',
    textShadow: isEmpty
      ? 'none'
      : '0 1px 2px rgba(255,255,255,0.6), 0 0 1px rgba(255,255,255,0.8)',
    outline,
    outlineOffset: highlight || selected ? '-2px' : undefined,
    fontWeight: highlight ? 700 : 500,
    zIndex: highlight || selected ? 1 : undefined,
    position: 'relative',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : undefined,
  };
  return (
    <div
      style={baseStyle}
      role={onClick ? 'button' : 'gridcell'}
      aria-label={hand}
      onClick={onClick}
    >
      {!isEmpty && (
        <div style={layerStackStyle} aria-hidden>
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{
                height: `${seg.ratio}%`,
                background: seg.color,
                width: '100%',
              }}
            />
          ))}
        </div>
      )}
      <span style={cellLabelStyle}>{hand}</span>
    </div>
  );
}

function Legend({ showCheck = false }: { showCheck?: boolean }) {
  return (
    <div style={legendStyle} aria-label="凡例">
      <LegendItem color={ACTION_BG.allin} label="オールイン" />
      <LegendItem color={ACTION_BG.raise} label="レイズ" />
      <LegendItem color={ACTION_BG.call} label="コール" />
      {showCheck && <LegendItem color={ACTION_BG.check} label="チェック" />}
      <LegendItem color={ACTION_BG.fold} label="フォールド" />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={legendItemStyle}>
      <span
        style={{ ...legendSwatchStyle, background: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const figureStyle: CSSProperties = {
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const captionStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#6b5a48',
  letterSpacing: '0.04em',
};
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(13, 1fr)',
  gridAutoRows: '1fr',
  gap: '1px',
  background: '#d6cfc1',
  border: '1px solid #d6cfc1',
  aspectRatio: '1',
  width: '100%',
  maxWidth: 360,
};
const cellBase: CSSProperties = {
  fontSize: '0.6rem',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  position: 'relative',
};

const layerStackStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
};

const cellLabelStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
};
const legendStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.6rem',
  fontSize: '0.72rem',
  color: '#6b5a48',
};
const legendItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
};
const legendSwatchStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 2,
  display: 'inline-block',
};
