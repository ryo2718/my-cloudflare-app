// トレーニング確認画面 (初級・中級共有)。
//
// レイアウト:
//   - レベル名 + subtitle
//   - 問題数 / 制限時間
//   - 最大獲得ポイント (= points × questionCount)
//   - 注意書き
//   - [戻る] [挑戦する]

import type { CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { AppHeader } from '../AppHeader';
import {
  formatLevelInfo,
  trainingPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { THEME } from '../../styles/theme';

export interface TrainingConfirmProps {
  level: TrainingLevel;
}

export function TrainingConfirm({ level }: TrainingConfirmProps) {
  const maxPt =
    level.points !== null && level.questionCount !== null
      ? level.points * level.questionCount
      : 0;
  const timeLimitLabel =
    level.timeLimitSec === 'none'
      ? 'なし'
      : typeof level.timeLimitSec === 'number'
        ? `${level.timeLimitSec}s/問`
        : '—';

  const handleStart = () => {
    navigate(trainingPath(level.key, 'play'));
  };

  return (
    <div style={pageStyle}>
      <AppHeader />
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニング</Link>

        <div style={headerColStyle}>
          <h1 style={titleStyle}>
            {level.label}
          </h1>
          <p style={taglineStyle}>{formatLevelInfo(level)}</p>
        </div>

        <div style={summaryGridStyle}>
          <StatCell label="問題数" value={`${level.questionCount ?? '—'}問`} />
          <StatCell label="制限時間" value={timeLimitLabel} />
        </div>

        <div style={ptCardStyle}>
          <span style={ptCardLabelStyle}>獲得ポイント</span>
          <span style={ptCardValueStyle}>最大 {maxPt}pt</span>
        </div>

        <div style={noticeStyle}>
          ⚠ 途中で抜けると、それまでの解答は無効になります
        </div>

        <div style={btnRowStyle}>
          <Link to="/quiz" style={backBtnStyle}>戻る</Link>
          <button type="button" onClick={handleStart} style={startBtnStyle}>
            挑戦する
          </button>
        </div>
      </main>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCellStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
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
  gap: '1rem',
};

const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};

const headerColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};


const taglineStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  color: THEME.textMuted,
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.65rem',
};

const statCellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.75rem 0.85rem',
};

const statLabelStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textSecondary,
  fontWeight: 600,
  letterSpacing: '0.04em',
};

const statValueStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const ptCardStyle: CSSProperties = {
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '0.45rem',
  padding: '0.8rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};

const ptCardLabelStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: '#633806',
  fontWeight: 600,
};

const ptCardValueStyle: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  color: '#412402',
};

const noticeStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: '#5F5E5A',
  background: '#f5f1e8',
  border: '1px dashed #BA7517',
  borderRadius: '0.35rem',
  padding: '0.55rem 0.8rem',
};

const btnRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  marginTop: '0.5rem',
};

const backBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.7rem 1rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.95rem',
  color: THEME.textSecondary,
  textAlign: 'center',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

const startBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.7rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
