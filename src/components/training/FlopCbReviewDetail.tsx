// フロップ中級CB の詳細表示 (即時FB + 結果レビューで共有)。
// 各選択肢 (check / 各サイズ% / ALLIN) の GTO 頻度バー + 自分が選んだ選択肢のマーク。
// 色は flopCbColor (check=緑 / ベット=赤 / ALLIN=紫) を流用。

import { type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';
import { ACTION_COLOR } from '../../styles/actionColors';
import type { FlopCbStrat } from '../../data/training/flopIntermediateCb';
import { FLOP_CB_ORDER, flopCbLabel, flopCbColor } from './flopCbChoiceStyle';

const YOU_COLOR = ACTION_COLOR.fold; // 青系 (あなた)

export function FlopCbReviewDetail({
  choices,
  strat,
  selections,
}: {
  choices: ReadonlyArray<string>;
  strat: FlopCbStrat;
  selections: ReadonlyArray<string>;
}) {
  const ordered = FLOP_CB_ORDER.filter((c) => choices.includes(c));
  return (
    <ul style={listStyle}>
      {ordered.map((c) => {
        const pct = Math.round((strat[c] ?? 0) * 100);
        const picked = selections.includes(c);
        const color = flopCbColor(c).border;
        return (
          <li key={c} style={rowStyle}>
            <span style={{ ...labelStyle, fontWeight: picked ? 800 : 600 }}>
              {flopCbLabel(c)}
              {picked && <span style={youBadgeStyle}>あなた</span>}
            </span>
            <span style={barTrackStyle}>
              <span style={{ ...barFillStyle, width: `${pct}%`, background: color }} />
            </span>
            <span style={pctStyle}>{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '7.5rem 1fr 2.6rem', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' };
const labelStyle: CSSProperties = { color: THEME.textPrimary, display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' };
const youBadgeStyle: CSSProperties = { fontSize: '0.6rem', fontWeight: 700, color: '#fff', background: YOU_COLOR, borderRadius: 999, padding: '0.02rem 0.34rem' };
const barTrackStyle: CSSProperties = { height: 10, background: THEME.cellEmpty, borderRadius: 5, overflow: 'hidden' };
const barFillStyle: CSSProperties = { display: 'block', height: '100%' };
const pctStyle: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: THEME.textPrimary, fontWeight: 600 };
