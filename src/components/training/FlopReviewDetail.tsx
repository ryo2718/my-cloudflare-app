// フロップ初級の結果レビュー展開部 (案B): 積み上げ1本帯 + 「打つ/打たない」2択枠。
//   - 帯: 左=ベット (サイズ別に赤系グラデで仕切り) / 右=チェック (緑)。幅=頻度比。
//   - 帯下: ベットサイズ別の頻度% (混合戦略) を併記。
//   - 2択枠: 帯と同じ幅比。ユーザー選択側に「あなた」(青)、正解側に「正解」(赤) バッジ + 対応枠線。
// プレイ中の即時FB (FlopFeedbackDetail) はこのコンポーネントを使わない (変更しない)。

import { type CSSProperties } from 'react';
import { THEME } from '../../styles/theme';
import { ACTION_COLOR } from '../../styles/actionColors';
import type { FlopRecord } from '../../data/training/flopBeginner';
import { actionFreqLabel, barColor } from './flopFeedbackFormat';

const YOU_COLOR = ACTION_COLOR.fold; // 青系 (あなた)
const CORRECT_COLOR = ACTION_COLOR.raise; // 赤系 (正解)
const pctOf = (f: number) => Math.round(f * 100);

export function FlopReviewDetail({ record }: { record: FlopRecord }) {
  const q = record;
  const verb = q.type === 'cb' ? 'CB' : 'ドンク';
  const bets = q.actions
    .filter((a) => a.code !== 'X' && a.freq > 0)
    .slice()
    .sort((a, b) => a.bp - b.bp); // 小さいベット=左, 大きいベット=右
  const checkFreq = q.actions.find((a) => a.code === 'X')?.freq ?? 0;
  const betTotal = bets.reduce((s, a) => s + a.freq, 0);
  const betPct = pctOf(betTotal);
  const checkPct = 100 - betPct;

  // 帯セグメント (ベット群 → チェック)。最後以外に細い仕切り線。
  const segments = [
    ...bets.map((a) => ({ key: a.code, grow: a.freq, color: barColor(a.code, a.bp) })),
    ...(checkFreq > 0 ? [{ key: 'X', grow: checkFreq, color: ACTION_COLOR.check }] : []),
  ];

  return (
    <div style={wrapStyle}>
      <div style={headStyle}>{verb}頻度 {betPct}%</div>

      {/* 積み上げ1本帯 */}
      <div style={barTrackStyle} aria-label="混合戦略バー">
        {segments.map((s, i) => (
          <span
            key={s.key}
            style={{
              flexGrow: s.grow,
              background: s.color,
              borderRight: i < segments.length - 1 ? '1px solid rgba(255,255,255,0.7)' : undefined,
            }}
          />
        ))}
      </div>

      {/* 帯下: ベットサイズ別の頻度% (混合戦略) + チェック */}
      <div style={legendStyle}>
        {bets.map((a) => (
          <span key={a.code} style={legendItemStyle}>
            <span style={{ ...dotStyle, background: barColor(a.code, a.bp) }} />
            {actionFreqLabel(a.code, a.bp)} {pctOf(a.freq)}%
          </span>
        ))}
        <span style={legendItemStyle}>
          <span style={{ ...dotStyle, background: ACTION_COLOR.check }} />
          チェック {pctOf(checkFreq)}%
        </span>
      </div>

      {/* 「打つ / 打たない」2択枠 (幅=頻度比、あなた/正解バッジ) */}
      <div style={framesRowStyle}>
        <ChoiceFrame
          label={`${verb}打つ`}
          pct={betPct}
          grow={betTotal}
          isCorrect={q.correct === 'bet'}
          isYou={q.choice === 'bet'}
        />
        <ChoiceFrame
          label={`${verb}打たない`}
          pct={checkPct}
          grow={checkFreq}
          isCorrect={q.correct === 'check'}
          isYou={q.choice === 'check'}
        />
      </div>
    </div>
  );
}

function ChoiceFrame({
  label,
  pct,
  grow,
  isCorrect,
  isYou,
}: {
  label: string;
  pct: number;
  grow: number;
  isCorrect: boolean;
  isYou: boolean;
}) {
  const borderColor = isCorrect ? CORRECT_COLOR : isYou ? YOU_COLOR : THEME.border;
  return (
    <div style={{ ...frameStyle, flexGrow: grow, borderColor, borderWidth: isCorrect || isYou ? 2 : 1 }}>
      <span style={frameLabelStyle}>
        {label} {pct}%
      </span>
      <span style={badgeRowStyle}>
        {isYou && <span style={{ ...badgeStyle, background: YOU_COLOR }}>あなた</span>}
        {isCorrect && <span style={{ ...badgeStyle, background: CORRECT_COLOR }}>正解</span>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const headStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: THEME.textPrimary };
const barTrackStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: 16,
  borderRadius: 5,
  overflow: 'hidden',
  background: THEME.cellEmpty,
};
const legendStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem 0.8rem',
  fontSize: '0.76rem',
  color: THEME.textSecondary,
};
const legendItemStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontVariantNumeric: 'tabular-nums' };
const dotStyle: CSSProperties = { display: 'inline-block', width: 9, height: 9, borderRadius: 2, flexShrink: 0 };
const framesRowStyle: CSSProperties = { display: 'flex', gap: '0.4rem', alignItems: 'stretch' };
const frameStyle: CSSProperties = {
  flexBasis: 0,
  minWidth: 96,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.5rem 0.4rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
};
const frameLabelStyle: CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: THEME.textPrimary, textAlign: 'center', fontVariantNumeric: 'tabular-nums' };
const badgeRowStyle: CSSProperties = { display: 'flex', gap: '0.25rem', minHeight: '1.1rem' };
const badgeStyle: CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  color: '#fff',
  padding: '0.05rem 0.4rem',
  borderRadius: '999px',
  lineHeight: 1.4,
};
