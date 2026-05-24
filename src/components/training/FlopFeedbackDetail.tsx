// フロップ初級の「答え合わせ」表示: そのボードの action 頻度分布バー + 正解。
// 即時フィードバック (TrainingPlayFlop) と結果画面の振り返り (TrainingResultFlop) で共有する。

import { type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';
import type { FlopQuestion } from '../../data/training/flopBeginner';
import { actionFreqLabel, barColor, feedbackRows } from './flopFeedbackFormat';

export function FlopFeedbackDetail({ q }: { q: FlopQuestion }) {
  const verb = q.type === 'cb' ? 'CB' : 'ドンク';
  const rate = Math.round(q.rate * 100);
  const correctText = q.correct === 'bet' ? `${verb}打つ` : `${verb}打たない`;
  return (
    <div style={fbStyle}>
      <div style={fbHeadStyle}>
        {verb}頻度 {rate}% → 正解: <span style={fbCorrectStyle}>{correctText}</span>
      </div>
      <ul style={fbListStyle}>
        {feedbackRows(q.actions).map((a) => {
          const pct = Math.round(a.freq * 100);
          return (
            <li key={a.code} style={fbRowStyle}>
              <span style={fbActionStyle}>{actionFreqLabel(a.code, a.bp)}</span>
              <span style={fbBarTrackStyle}>
                <span style={{ ...fbBarFillStyle, width: `${pct}%`, background: barColor(a.code, a.bp) }} />
              </span>
              <span style={fbPctStyle}>{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const fbStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const fbHeadStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: THEME.textPrimary };
const fbCorrectStyle: CSSProperties = { color: '#1F4D11' };
const fbListStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' };
const fbRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '5.5rem 1fr 2.5rem', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' };
const fbActionStyle: CSSProperties = { color: THEME.textSecondary };
const fbBarTrackStyle: CSSProperties = { height: 10, background: THEME.cellEmpty, borderRadius: 5, overflow: 'hidden' };
const fbBarFillStyle: CSSProperties = { display: 'block', height: '100%' };
const fbPctStyle: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: THEME.textPrimary, fontWeight: 600 };
