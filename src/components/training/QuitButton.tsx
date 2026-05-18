// トレーニング中断ボタン。タップ → confirm → /quiz へ遷移。
// 結果記録は呼び出さない (途中離脱は履歴に残さない)。

import { type CSSProperties } from 'react';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';

export function QuitButton() {
  const handleQuit = () => {
    if (window.confirm('やめますか?ここまでの結果は記録されません')) {
      navigate('/quiz');
    }
  };
  return (
    <button type="button" onClick={handleQuit} style={btnStyle}>
      やめる
    </button>
  );
}

const btnStyle: CSSProperties = {
  padding: '0.2rem 0.55rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.78rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  lineHeight: 1,
};
