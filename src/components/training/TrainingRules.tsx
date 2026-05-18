// /training/{slug}/rules: 各レベルのルール説明ページ。
//
// 構成:
//   ← トレーニングに戻る
//   プリフロップトレーニング
//   レベル: 初級/中級
//   RuleExplanation (例題 + 答え + レンジ表)
//   [スタート]

import type { CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import {
  trainingPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { AppHeader } from '../AppHeader';
import { THEME } from '../../styles/theme';
import { RuleExplanation } from './RuleExplanation';

export interface TrainingRulesProps {
  level: TrainingLevel;
}

export function TrainingRules({ level }: TrainingRulesProps) {
  const timeLimitLabel =
    level.timeLimitSec === 'none'
      ? 'なし'
      : typeof level.timeLimitSec === 'number'
        ? `${level.timeLimitSec}秒`
        : '—';

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>

        <h1 style={titleStyle}>プリフロップトレーニング</h1>

        <div style={metaRowStyle}>
          <span style={metaLabelStyle}>レベル</span>
          <span style={metaValueStyle}>{level.label}</span>
        </div>
        <div style={metaRowStyle}>
          <span style={metaLabelStyle}>制限時間</span>
          <span style={metaValueStyle}>{timeLimitLabel}</span>
        </div>

        <RuleExplanation levelKey={level.key} />

        <button
          type="button"
          onClick={() => navigate(trainingPath(level.key, 'play'))}
          style={startBtnStyle}
        >
          スタート
        </button>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
};
const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.8rem',
};
const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const metaRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'baseline',
  fontSize: '0.88rem',
};
const metaLabelStyle: CSSProperties = {
  color: THEME.textSecondary,
  fontWeight: 600,
};
const metaValueStyle: CSSProperties = {
  color: THEME.textPrimary,
};
const startBtnStyle: CSSProperties = {
  marginTop: '0.6rem',
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
