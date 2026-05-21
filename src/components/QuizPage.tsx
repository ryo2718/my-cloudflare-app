// /quiz: トレーニングメニュー。
//
// プリフロップは 初級 / 中級 (総合問題・EP・LP・Blind) / 上級・超上級 (未実装) を表示。
// 中級は「中級」見出し配下に 4 レベルをネスト。各レベル行に [ルールを確認] [スタート]。
// ソリューション条件 (スタック/レーキ/open額) は各レベルのルール説明ページに移動。
// マウント時に GET /api/account/training-results を取得して最高スコアを表示。

import { useEffect, useState, type CSSProperties } from 'react';
import { MissedProblemsSection } from './training/MissedProblemsSection';
import {
  TRAINING_CATALOG,
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

/** 中級ファミリー (総合 + ポジション別) の一覧表示用ラベル (「中級」見出し配下なので接頭辞なし)。 */
const INTERMEDIATE_SHORT_LABEL: Record<string, string> = {
  preflop_intermediate: '総合問題',
  preflop_intermediate_ep: 'EP(UTG,HJ)',
  preflop_intermediate_lp: 'LP(CO,BTN)',
  preflop_intermediate_blind: 'Blind(SB,BB)',
};

function isIntermediateFamily(key: string): boolean {
  return key === 'preflop_intermediate' || key.startsWith('preflop_intermediate_');
}

function displayLabelFor(level: TrainingLevel): string {
  return INTERMEDIATE_SHORT_LABEL[level.key] ?? level.label;
}

export function QuizPage() {
  const auth = useAuth();
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

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>トレーニング</h1>

        {TRAINING_CATALOG.map((cat) => (
          <section key={cat.key} style={categorySectionStyle}>
            <header style={categoryHeaderStyle}>{cat.label}</header>
            <div style={levelListStyle}>
              {cat.levels.map((lv, i) => {
                const fam = isIntermediateFamily(lv.key);
                const prevFam = i > 0 && isIntermediateFamily(cat.levels[i - 1].key);
                return (
                  <div key={lv.key}>
                    {fam && !prevFam && <div style={subHeadingStyle}>中級</div>}
                    <div style={fam ? indentStyle : undefined}>
                      <LevelRow
                        level={lv}
                        displayLabel={displayLabelFor(lv)}
                        record={records.find((r) => r.training_type === lv.key)}
                        unlocked={isLevelUnlocked(lv.key, unlockStatus)}
                        lockHint={lockHintFor(lv.key)}
                        onStart={() => navigate(trainingPath(lv.key, 'play'))}
                        onRules={() => navigate(trainingPath(lv.key, 'rules'))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <MissedProblemsSection />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LevelRow
// ---------------------------------------------------------------------------

function LevelRow({
  level,
  displayLabel,
  record,
  unlocked,
  lockHint,
  onStart,
  onRules,
}: {
  level: TrainingLevel;
  displayLabel: string;
  record: TrainingResult | undefined;
  unlocked: boolean;
  lockHint: string | null;
  onStart: () => void;
  onRules: () => void;
}) {
  const playable = isPlayable(level);

  if (playable && !unlocked) {
    return (
      <div style={lockedCardStyle}>
        <span style={cardLevelStyle}>🔒 {displayLabel}</span>
        {lockHint && <span style={lockHintStyle}>{lockHint}</span>}
      </div>
    );
  }

  if (!playable) {
    return (
      <div style={unimplementedCardStyle}>
        <span style={cardLevelStyle}>{displayLabel}</span>
        <span style={unimplementedBadgeStyle}>未実装</span>
      </div>
    );
  }

  const max = maxScoreFor(level);
  const pt = record ? record.best_score * (level.points ?? 0) : 0;

  return (
    <div style={playableCardStyle}>
      <div style={rowTopStyle}>
        <span style={cardLevelStyle}>{displayLabel}</span>
        <span style={scoreLineStyle}>
          {record ? (
            <>
              最高スコア <span style={gainPtStyle}>+{pt}pt</span>
              <span style={maxPtStyle}> / {max}pt</span>
            </>
          ) : (
            '未挑戦'
          )}
        </span>
      </div>
      <div style={actionRowStyle}>
        <button type="button" onClick={onRules} style={rulesBtnStyle}>
          ルールを確認
        </button>
        <button type="button" onClick={onStart} style={startBtnStyle}>
          スタート
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
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
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: THEME.textPrimary };
const categorySectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' };
const categoryHeaderStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const levelListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' };
const subHeadingStyle: CSSProperties = {
  fontSize: '0.86rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  margin: '0.2rem 0 0.45rem',
  paddingLeft: '0.1rem',
  borderLeft: `3px solid ${THEME.accent}`,
  paddingTop: '0.05rem',
  paddingBottom: '0.05rem',
  textIndent: '0.4rem',
};
const indentStyle: CSSProperties = { paddingLeft: '0.7rem', marginBottom: '0.55rem' };

const cardBase: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.75rem 0.95rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  background: '#fff',
};
const playableCardStyle: CSSProperties = cardBase;
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
const rowTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.5rem',
};
const cardLevelStyle: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: THEME.accent };
const scoreLineStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
const gainPtStyle: CSSProperties = { color: '#639922', fontWeight: 700, fontSize: '0.95rem' };
const maxPtStyle: CSSProperties = { color: THEME.textPrimary, fontWeight: 700, fontSize: '0.95rem' };
const actionRowStyle: CSSProperties = { display: 'flex', gap: '0.6rem' };
const rulesBtnStyle: CSSProperties = {
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
