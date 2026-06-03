// /quiz: トレーニングメニュー (難易度別アコーディオン)。
//
// 各カテゴリ (プリフロップ / フロップ) の中で難易度ごとにグループ化:
//   - 初級: 1 問なのでアコーディオンにせず常時表示
//   - 中級: アコーディオン (総合問題・EP・LP・Blind)。既定で開く
//   - 上級 / 超上級: アコーディオン枠のみ。中身が無ければ「準備中」
// 各レベル行 (LevelRow) のデザイン (進捗 pt / [ルールを確認] [スタート]) は現状維持。
// ソリューション条件 (スタック/レーキ/open額) は各レベルのルール説明ページ側。

import { useState, useEffect, type CSSProperties } from 'react';
import { useInstantFeedback } from '../hooks/useInstantFeedback';
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

function displayLabelFor(level: TrainingLevel): string {
  return INTERMEDIATE_SHORT_LABEL[level.key] ?? level.label;
}

type TierId = '初級' | '中級' | '上級' | '超上級';
const TIER_ORDER: ReadonlyArray<TierId> = ['初級', '中級', '上級', '超上級'];

/** level.key → 難易度 tier。 */
function tierOf(key: string): TierId {
  // フロップ CB (flop_cb_srp / flop_cb_3bp) は中級枠。
  if (key.includes('intermediate') || key.startsWith('flop_cb')) return '中級';
  if (key.includes('advanced')) return '上級';
  if (key.includes('expert')) return '超上級';
  return '初級';
}

export function QuizPage() {
  const auth = useAuth();
  const [instant, setInstant] = useInstantFeedback();
  const [records, setRecords] = useState<TrainingResult[]>([]);
  // 既定で「プリフロップ 中級」を開いておく。
  const [openTiers, setOpenTiers] = useState<Set<string>>(() => new Set(['preflop:中級']));

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

  const toggleTier = (key: string) => {
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderRow = (lv: TrainingLevel) => (
    <LevelRow
      key={lv.key}
      level={lv}
      displayLabel={displayLabelFor(lv)}
      record={records.find((r) => r.training_type === lv.key)}
      unlocked={isLevelUnlocked(lv.key, unlockStatus)}
      lockHint={lockHintFor(lv.key)}
      onStart={() => navigate(trainingPath(lv.key, 'play'))}
      onRules={() => navigate(trainingPath(lv.key, 'rules'))}
    />
  );

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <div style={titleRowStyle}>
          <h1 style={titleStyle}>トレーニング</h1>
          <label style={toggleLabelStyle}>
            <input type="checkbox" checked={instant} onChange={(e) => setInstant(e.target.checked)} />
            即時フィードバック
          </label>
        </div>

        {TRAINING_CATALOG.map((cat) => {
          // 難易度ごとにグループ化 (出現順を維持)。
          const groups = new Map<TierId, TrainingLevel[]>();
          for (const lv of cat.levels) {
            const t = tierOf(lv.key);
            (groups.get(t) ?? groups.set(t, []).get(t)!).push(lv);
          }
          return (
            <section key={cat.key} style={categorySectionStyle}>
              <header style={categoryHeaderStyle}>{cat.label}</header>
              <div style={levelListStyle}>
                {TIER_ORDER.map((tier) => {
                  const levels = groups.get(tier);
                  if (!levels || levels.length === 0) return null;
                  // 初級: アコーディオンにせずそのまま表示。
                  if (tier === '初級') {
                    return <div key={tier} style={tierFlatStyle}>{levels.map(renderRow)}</div>;
                  }
                  const tierKey = `${cat.key}:${tier}`;
                  const open = openTiers.has(tierKey);
                  const anyPlayable = levels.some((lv) => isPlayable(lv));
                  return (
                    <div key={tierKey} style={accordionStyle}>
                      <button
                        type="button"
                        style={accordionHeaderStyle}
                        onClick={() => toggleTier(tierKey)}
                        aria-expanded={open}
                      >
                        <span style={accordionTitleStyle}>{tier}</span>
                        <span style={accordionChevronStyle} aria-hidden>{open ? '▼' : '▶'}</span>
                      </button>
                      {open && (
                        <div style={accordionBodyStyle}>
                          {anyPlayable ? (
                            levels.map(renderRow)
                          ) : (
                            <div style={placeholderStyle}>準備中</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

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
const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.6rem',
  flexWrap: 'wrap',
};
const toggleLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: THEME.textSecondary,
  cursor: 'pointer',
};
const categorySectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' };
const categoryHeaderStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const levelListStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' };
const tierFlatStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' };

// アコーディオン
const accordionStyle: CSSProperties = {
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  background: '#fff',
  overflow: 'hidden',
};
const accordionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.85rem 0.95rem',
  background: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};
const accordionTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: THEME.textPrimary };
const accordionChevronStyle: CSSProperties = { fontSize: '0.8rem', color: THEME.textMuted };
const accordionBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
  padding: '0 0.7rem 0.7rem',
  borderTop: `1px solid ${THEME.border}`,
  paddingTop: '0.6rem',
};
const placeholderStyle: CSSProperties = {
  fontSize: '0.88rem',
  color: THEME.textMuted,
  padding: '0.6rem 0.3rem',
  textAlign: 'center',
};

// レベルカード
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
