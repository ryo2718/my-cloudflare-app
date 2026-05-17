// /quiz: トレーニングメニュー (実装は Phase F 以降)。
//
// 全 カードはタップで「未実装」インライン通知。プリフロ 初級/中級だけ
// 将来の pt と 制限時間を表記 (実装時の目印)。

import { useState, type CSSProperties } from 'react';
import { TRAINING_CATALOG, type TrainingLevel } from '../data/trainingCatalog';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function QuizPage() {
  const [notice, setNotice] = useState<string | null>(null);

  const handleLevelTap = (level: TrainingLevel) => {
    setNotice(`${level.label} は未実装です。リリースをお待ちください。`);
    // 自動 fade (3 秒)
    window.setTimeout(() => setNotice((prev) => (prev?.startsWith(level.label) ? null : prev)), 3000);
  };

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>トレーニング</h1>

        {TRAINING_CATALOG.map((cat) => (
          <section key={cat.key} style={categorySectionStyle}>
            <h2 style={categoryTitleStyle}>▼ {cat.label}</h2>
            <div style={levelGridStyle}>
              {cat.levels.map((lv) => (
                <LevelCard
                  key={lv.key}
                  level={lv}
                  onTap={() => handleLevelTap(lv)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* notice は画面下部に短時間表示 */}
      {notice && (
        <div role="status" aria-live="polite" style={noticeStyle}>
          {notice}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LevelCard
// ---------------------------------------------------------------------------

function LevelCard({ level, onTap }: { level: TrainingLevel; onTap: () => void }) {
  const detail = formatLevelDetail(level);
  return (
    <button type="button" onClick={onTap} style={levelCardStyle}>
      <div style={levelLabelStyle}>{level.label}</div>
      <div style={levelDetailStyle}>{detail}</div>
    </button>
  );
}

function formatLevelDetail(level: TrainingLevel): string {
  if (!level.implemented && level.points === null) return '(未実装)';
  const parts: string[] = [];
  if (level.points !== null) parts.push(`${level.points}pt`);
  if (level.timeLimitSec === 'none') parts.push('制限時間なし');
  else if (typeof level.timeLimitSec === 'number') parts.push(`制限時間 ${level.timeLimitSec}s`);
  if (!level.implemented) parts.push('(未実装)');
  return parts.length > 0 ? parts.join(' / ') : '(未実装)';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: THEME.bg,
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: '1.25rem 1rem',
  maxWidth: 560,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.2rem',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const categorySectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const categoryTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};

const levelGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const levelCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '0.2rem',
  padding: '0.8rem 1rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  fontFamily: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 0.1s, border-color 0.1s',
};

const levelLabelStyle: CSSProperties = {
  fontSize: '0.98rem',
  fontWeight: 700,
  color: THEME.accent,
};

const levelDetailStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
};

const noticeStyle: CSSProperties = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#412402',
  color: '#fff',
  fontSize: '0.85rem',
  padding: '0.55rem 1rem',
  borderRadius: '0.4rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  maxWidth: '90%',
  textAlign: 'center',
  zIndex: 50,
};
