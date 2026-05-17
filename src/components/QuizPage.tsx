// /quiz: トレーニングメニュー画面。
//
// レイアウト (シンプル化、ユーザー指示):
//   ▼ プリフロップトレーニング (default open)
//     - カード: 難易度ラベル + [挑戦する] / [未実装] のみ
//   ▼ フロップトレーニング (同上)
//
// 挙動:
//   - 全レベル現状 implemented=false。[挑戦する] タップで「未実装です」通知
//   - questionCount=null の level は灰色 + [未実装] バッジ (タップ無効)

import { useState, type CSSProperties } from 'react';
import {
  TRAINING_CATALOG,
  isPlanned,
  type TrainingLevel,
} from '../data/trainingCatalog';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function QuizPage() {
  const [notice, setNotice] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(TRAINING_CATALOG.map((c) => c.key)),
  );

  const toggleCat = (key: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleChallenge = (level: TrainingLevel) => {
    setNotice(`${level.label} は未実装です。リリースをお待ちください。`);
    window.setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>トレーニング</h1>

        {TRAINING_CATALOG.map((cat) => {
          const open = openCats.has(cat.key);
          return (
            <section key={cat.key} style={categorySectionStyle}>
              <button
                type="button"
                onClick={() => toggleCat(cat.key)}
                style={categoryToggleStyle}
                aria-expanded={open}
              >
                <span style={categoryChevronStyle} aria-hidden>
                  {open ? '▼' : '▶'}
                </span>
                <span>{cat.label}</span>
              </button>
              {open && (
                <div style={levelListStyle}>
                  {cat.levels.map((lv) => (
                    <LevelCard
                      key={lv.key}
                      level={lv}
                      onChallenge={() => handleChallenge(lv)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>

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

function LevelCard({
  level,
  onChallenge,
}: {
  level: TrainingLevel;
  onChallenge: () => void;
}) {
  const planned = isPlanned(level);
  const cardStyle: CSSProperties = planned ? plannedCardStyle : unimplementedCardStyle;

  return (
    <div style={cardStyle}>
      <span style={cardLevelStyle}>{level.label}</span>
      {planned ? (
        <button type="button" onClick={onChallenge} style={challengeBtnStyle}>
          挑戦する
        </button>
      ) : (
        <span style={unimplementedBadgeStyle}>未実装</span>
      )}
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

const categoryToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'transparent',
  border: 'none',
  padding: '0.2rem 0',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  textAlign: 'left',
};

const categoryChevronStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  minWidth: '14px',
};

const levelListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const cardBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.6rem',
  padding: '0.85rem 1rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};

const plannedCardStyle: CSSProperties = {
  ...cardBase,
  background: '#fff',
};

const unimplementedCardStyle: CSSProperties = {
  ...cardBase,
  background: '#f5f1ea',
  opacity: 0.72,
};

const cardLevelStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: THEME.accent,
};

const challengeBtnStyle: CSSProperties = {
  padding: '0.4rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const unimplementedBadgeStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.25rem',
  padding: '1px 6px',
  background: '#fff',
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
