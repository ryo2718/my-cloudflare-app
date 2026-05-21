// 即時フィードバックの表示パネル (全モード共通)。
// 上から: 判定 (◎/○/△/×) + 獲得pt → (任意の追加情報・レンジ) → 「次のハンドへ」ボタン。

import type { CSSProperties, ReactNode } from 'react';
import { judgmentIcon, judgmentColor } from './judgmentIcon';
import { THEME } from '../../styles/theme';

export interface InstantFeedbackProps {
  /** その問題の獲得素点 (-1/0/1/2)。判定アイコンと +Npt 表示に使う。 */
  points: number;
  /** 判定・pt の下に表示する内容 (レンジ等)。 */
  children?: ReactNode;
  onNext: () => void;
}

export function InstantFeedback({ points, children, onNext }: InstantFeedbackProps) {
  const icon = judgmentIcon(points);
  const color = judgmentColor(points);
  return (
    <div style={wrapStyle}>
      <div style={headerStyle}>
        <span style={{ ...iconStyle, color }}>{icon}</span>
        <span style={{ ...ptStyle, color }}>{points >= 0 ? `+${points}` : `${points}`}pt</span>
      </div>
      {children}
      <button type="button" onClick={onNext} style={nextBtnStyle}>
        次のハンドへ
      </button>
    </div>
  );
}

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.8rem' };
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.6rem' };
const iconStyle: CSSProperties = { fontSize: '2rem', fontWeight: 800, lineHeight: 1 };
const ptStyle: CSSProperties = { fontSize: '1.3rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' };
const nextBtnStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
