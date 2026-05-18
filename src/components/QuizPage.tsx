// /quiz: トレーニングメニュー (レベル単位アコーディオン UI)。
//
// 各 level は独立したアコーディオンで、collapsed=score 表示 / expanded=詳細+[戻る][スタート]。
// implemented=false の level はアコーディオンではなく [未実装] バッジ固定。
// マウント時に GET /api/account/training-results を取得して最高スコアを表示。

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { MissedProblemsSection } from './training/MissedProblemsSection';
import {
  TRAINING_CATALOG,
  formatScorePct,
  isPlayable,
  maxScoreFor,
  trainingPath,
  type TrainingLevel,
} from '../data/trainingCatalog';
import {
  apiAccountTrainingResults,
  type TrainingResult,
} from '../api/account';
import {
  computeUnlockStatus,
  isLevelUnlocked,
  lockHintFor,
} from '../data/training/unlockStatus';
import { useAuth } from '../hooks/useAuth';
import { navigate } from '../router/router-core';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

export function QuizPage() {
  const auth = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [records, setRecords] = useState<TrainingResult[]>([]);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiAccountTrainingResults(sid)
      .then((rows) => {
        if (cancelled) return;
        setRecords(rows);
      })
      .catch(() => {
        /* スコア取得失敗時は「未挑戦」表示にフォールバック */
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  const unlockStatus = computeUnlockStatus(records);

  const toggle = (key: string) => {
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const start = (level: TrainingLevel) => {
    navigate(trainingPath(level.key, 'play'));
  };

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>トレーニング</h1>

        {TRAINING_CATALOG.map((cat) => (
          <section key={cat.key} style={categorySectionStyle}>
            <header style={categoryHeaderStyle}>{cat.label}</header>
            <div style={levelListStyle}>
              {cat.levels.map((lv) => (
                <LevelAccordion
                  key={lv.key}
                  level={lv}
                  category={cat.label}
                  record={records.find((r) => r.training_type === lv.key)}
                  open={openKey === lv.key}
                  unlocked={isLevelUnlocked(lv.key, unlockStatus)}
                  lockHint={lockHintFor(lv.key)}
                  onToggle={() => toggle(lv.key)}
                  onStart={() => start(lv)}
                />
              ))}
            </div>
          </section>
        ))}

        <MissedProblemsSection />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LevelAccordion
// ---------------------------------------------------------------------------

function LevelAccordion({
  level,
  category,
  record,
  open,
  unlocked,
  lockHint,
  onToggle,
  onStart,
}: {
  level: TrainingLevel;
  category: string;
  record: TrainingResult | undefined;
  open: boolean;
  unlocked: boolean;
  lockHint: string | null;
  onToggle: () => void;
  onStart: () => void;
}) {
  const playable = isPlayable(level);

  // ロック中の playable level (例: 中級が初級未達成): アコーディオン展開不可
  if (playable && !unlocked) {
    return (
      <div style={lockedCardStyle}>
        <span style={cardLevelStyle}>🔒 {level.label}</span>
        {lockHint && <span style={lockHintStyle}>{lockHint}</span>}
      </div>
    );
  }

  if (!playable) {
    return (
      <div style={unimplementedCardStyle}>
        <span style={cardLevelStyle}>{level.label}</span>
        <span style={unimplementedBadgeStyle}>未実装</span>
      </div>
    );
  }

  const max = maxScoreFor(level);
  const pctText = record ? formatScorePct(record.best_score, max) : null;
  const pt = record ? record.best_score * (level.points ?? 0) : 0;

  return (
    <div style={open ? playableCardOpenStyle : playableCardStyle}>
      <button
        type="button"
        onClick={onToggle}
        style={cardHeaderBtnStyle}
        aria-expanded={open}
      >
        <span style={cardTitleColStyle}>
          <span style={cardLevelStyle}>{level.label}</span>
        </span>
        <span style={chevronStyle} aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>
      <div style={scoreLineStyle}>
        {record ? (
          <>
            最高スコア <span style={pctStyle}>{pctText}</span>
            {'  '}
            <span style={ptStyle}>{pt}pt</span>
          </>
        ) : (
          '未挑戦'
        )}
      </div>

      {open && (
        <>
          <div style={dividerStyle} />
          <DetailPanel level={level} category={category} />
          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={() => navigate(trainingPath(level.key, 'rules'))}
              style={backBtnStyle}
            >
              ルールを確認
            </button>
            <button type="button" onClick={onStart} style={startBtnStyle}>
              スタート
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPanel (展開時の説明)
// ---------------------------------------------------------------------------

function DetailPanel({
  level,
  category,
}: {
  level: TrainingLevel;
  category: string;
}) {
  const timeLimitLabel =
    level.timeLimitSec === 'none'
      ? 'なし'
      : typeof level.timeLimitSec === 'number'
        ? `${level.timeLimitSec}秒`
        : '—';

  const isIntermediate = level.key === 'preflop_intermediate';

  return (
    <div style={detailColStyle}>
      <DetailRow label={category} />
      <DetailRow label="レベル" value={level.label} />
      <DetailRow label="制限時間" value={timeLimitLabel} />
      {isIntermediate && (
        <DetailRow label="スコア" value="全問2pt、最大40pt" />
      )}
      <div style={noteHeaderStyle}>注意:</div>
      <ul style={noteListStyle}>
        <li>スタック: 100BB</li>
        <li>レーキ: 安め</li>
        <li>2.5BB open</li>
      </ul>
      <div style={noteHintStyle}>(わからない人は考えなくて大丈夫です)</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined) {
    return <div style={detailHeaderRowStyle}>{label}</div>;
  }
  return (
    <div style={detailRowStyle}>
      <span style={detailLabelStyle}>{label}:</span>
      <span style={detailValueStyle}>{value}</span>
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

const categoryHeaderStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};

const levelListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const cardBase: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  padding: '0.75rem 0.95rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  background: '#fff',
};

const playableCardStyle: CSSProperties = cardBase;

const playableCardOpenStyle: CSSProperties = {
  ...cardBase,
  borderColor: THEME.accent,
  boxShadow: `0 0 0 1px ${THEME.accent} inset`,
};

const unimplementedCardStyle: CSSProperties = {
  ...cardBase,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#f5f1ea',
  opacity: 0.72,
};

const lockedCardStyle: CSSProperties = {
  ...cardBase,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: '#f5f1ea',
  borderStyle: 'dashed',
  opacity: 0.9,
  cursor: 'not-allowed',
};

const lockHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  fontStyle: 'italic',
  textAlign: 'right',
  maxWidth: '60%',
};

const cardHeaderBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  width: '100%',
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

const cardTitleColStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.35rem',
  flexWrap: 'wrap',
};

const cardLevelStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: THEME.accent,
};

const chevronStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
  minWidth: '14px',
  textAlign: 'right',
};

const scoreLineStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};

const pctStyle: CSSProperties = {
  color: '#639922',     // 緑 (既存 call action 色と統一)
  fontWeight: 700,
};

const ptStyle: CSSProperties = {
  color: '#639922',
  fontWeight: 700,
  fontSize: '1rem', // scoreLineStyle (0.82rem) より大きめ
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: THEME.border,
  margin: '0.4rem 0 0.5rem',
};

const detailColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
};

const detailHeaderRowStyle: CSSProperties = {
  fontWeight: 700,
  color: THEME.textPrimary,
  marginBottom: '0.15rem',
};

const detailRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.35rem',
};

const detailLabelStyle: CSSProperties = {
  color: THEME.textSecondary,
  fontWeight: 600,
};

const detailValueStyle: CSSProperties = {
  color: THEME.textPrimary,
};

const noteHeaderStyle: CSSProperties = {
  marginTop: '0.2rem',
  fontWeight: 600,
  color: THEME.textSecondary,
};

const noteListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  color: THEME.textPrimary,
  fontSize: '0.85rem',
  lineHeight: 1.55,
};

const noteHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
};

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.6rem',
  marginTop: '0.6rem',
};

const backBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.55rem 0.9rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.9rem',
  color: THEME.textSecondary,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const startBtnStyle: CSSProperties = {
  flex: 1,
  padding: '0.55rem 0.9rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontSize: '0.92rem',
  fontWeight: 700,
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
