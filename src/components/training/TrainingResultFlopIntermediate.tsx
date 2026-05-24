// フロップ中級レンジベットの結果画面。プリフロ中級ポジション (TrainingResultPositional) と同じ構成:
//   スコア + 達成率 / 内訳 (◎○△×) / 振り返り一覧 (各問タップで詳細)。
//   CB問題は頻度詳細 + 自分の選択、Donk問題は正解ドンク頻度 vs 自分の回答。
// best_score は POST /api/account/training-result で保存 (training_type=flop_intermediate)。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiSubmitTrainingResult, type TrainingResultSubmission } from '../../api/account';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { trainingPath, type TrainingLevel } from '../../data/trainingCatalog';
import { loadFlopRbRecords } from '../../data/training/flopCbRecordsStore';
import { flopRbScenarioLabel, type FlopRbRecord } from '../../data/training/flopIntermediateCb';
import { savePendingResult, clearPendingResult } from '../../data/training/pendingResults';
import { judgmentIcon, judgmentColor } from './judgmentIcon';
import { FlopCbReviewDetail } from './FlopCbReviewDetail';
import { PlayingCard } from '../PlayingCard';
import { THEME } from '../../styles/theme';

export interface TrainingResultFlopIntermediateProps {
  level: TrainingLevel;
}

const SUBMIT_CACHE_PREFIX = 'training_submission:';

function parseQuery(): { score: number; total: number } | null {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const s = Number(sp.get('score'));
  const t = Number(sp.get('total'));
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  return { score: s, total: t };
}

export function TrainingResultFlopIntermediate({ level }: TrainingResultFlopIntermediateProps) {
  const auth = useAuth();
  const scoreInfo = parseQuery();
  const [records, setRecords] = useState<FlopRbRecord[]>(() => loadFlopRbRecords(level.key) ?? []);
  const [save, setSave] = useState<TrainingResultSubmission | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const r = loadFlopRbRecords(level.key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (r) setRecords(r);
  }, [level.key]);

  useEffect(() => {
    if (!scoreInfo || !auth.sessionId) return;
    const sid = auth.sessionId;
    const submitScore = Math.max(0, scoreInfo.score);
    const cacheKey = `${SUBMIT_CACHE_PREFIX}${level.key}:${submitScore}:${scoreInfo.total}`;
    if (typeof sessionStorage !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSave(JSON.parse(cached) as TrainingResultSubmission);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    let cancelled = false;
    apiSubmitTrainingResult(sid, { training_type: level.key, score: submitScore })
      .then((sub) => {
        if (cancelled) return;
        clearPendingResult(level.key);
        setSave(sub);
        try {
          sessionStorage?.setItem(cacheKey, JSON.stringify(sub));
        } catch {
          /* ignore */
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        savePendingResult({ training_type: level.key, score: submitScore });
        setSaveError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.sessionId, level.key, scoreInfo?.score, scoreInfo?.total, retryNonce]);

  if (!scoreInfo) {
    return (
      <div style={pageStyle}>
        <main style={mainStyle}>
          <p style={infoStyle}>結果情報が見つかりません。</p>
          <button type="button" onClick={() => navigate('/quiz')} style={listBtnStyle}>
            トレーニングに戻る
          </button>
        </main>
      </div>
    );
  }

  const { score, total } = scoreInfo;
  const displayScore = Math.max(0, score);
  const pct = total > 0 ? Math.round((displayScore / total) * 100) : 0;

  const breakdown = { perfect: 0, partial: 0, zero: 0, miss: 0 };
  for (const r of records) {
    if (r.finalScore >= 2) breakdown.perfect++;
    else if (r.finalScore === 1) breakdown.partial++;
    else if (r.finalScore === 0) breakdown.zero++;
    else breakdown.miss++;
  }

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>
        <h1 style={titleStyle}>お疲れさまでした!</h1>

        <div style={scoreCardStyle}>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>スコア</span>
            <span style={scoreValueStyle}>{displayScore}/{total}</span>
          </div>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>達成率</span>
            <span style={scoreValueStyle}>{pct}%</span>
          </div>
        </div>

        {save && (
          <div style={ptCardStyle}>
            {save.is_best ? (
              <span style={bestStyle}>ベスト更新! {save.current_best}pt</span>
            ) : (
              <span style={ptInfoStyle}>ベスト: {save.current_best}pt(今回 {displayScore}pt)</span>
            )}
          </div>
        )}

        {!save && saveError && (
          <div style={saveErrorCardStyle}>
            <span style={saveErrorTextStyle}>結果の保存に失敗しました ({saveError})</span>
            <span style={ptInfoStyle}>スコアは退避済みです。再保存するか、再ログイン後に自動で再送されます。</span>
            <button type="button" onClick={() => setRetryNonce((n) => n + 1)} style={saveRetryBtnStyle}>
              再保存する
            </button>
          </div>
        )}

        {records.length > 0 && (
          <section style={breakdownStyle} aria-label="スコア内訳">
            <header style={sectionHeaderStyle}>スコア内訳</header>
            <div style={breakdownRowStyle}>
              <BreakdownPill score={2} label="満点" count={breakdown.perfect} />
              <BreakdownPill score={1} label="部分点" count={breakdown.partial} />
              <BreakdownPill score={0} label="無回答" count={breakdown.zero} />
              <BreakdownPill score={-1} label="ミス" count={breakdown.miss} />
            </div>
          </section>
        )}

        {records.length > 0 && (
          <section style={reviewSectionStyle} aria-label="振り返り一覧">
            <header style={sectionHeaderStyle}>振り返り一覧 ({records.length}問)</header>
            <ul style={listStyle}>
              {records.map((r) => {
                const open = expanded === r.recordId;
                return (
                  <li key={r.recordId} style={itemStyle}>
                    <button
                      type="button"
                      style={itemHeaderStyle}
                      onClick={() => setExpanded(open ? null : r.recordId)}
                      aria-expanded={open}
                    >
                      <span style={{ ...iconStyle, color: judgmentColor(r.finalScore) }}>
                        {judgmentIcon(r.finalScore)}
                      </span>
                      <span style={scenarioPillStyle}>{flopRbScenarioLabel(r)}</span>
                      <span style={kindTagStyle}>{r.kind === 'cb' ? 'CB' : 'ドンク'}</span>
                      <span style={boardStyle}>
                        {r.board.map((c, i) => (
                          <PlayingCard key={`${c.rank}${c.suit}-${i}`} rank={c.rank} suit={c.suit} size="sm" />
                        ))}
                      </span>
                      <span style={chevronStyle} aria-hidden>{open ? '▼' : '▶'}</span>
                    </button>
                    {open && (
                      <div style={detailWrapStyle}>
                        {r.kind === 'cb' ? (
                          <FlopCbReviewDetail
                            choices={r.choices}
                            strat={r.strat}
                            selections={r.response.kind === 'select' ? r.response.selections : []}
                          />
                        ) : (
                          <div style={donkDetailStyle}>
                            ドンク正解 {Math.round(r.donkRate * 100)}% / あなた{' '}
                            {r.response.kind === 'slider' ? `${r.response.pct}%` : 'スキップ'}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div style={btnRowStyle}>
          <button type="button" onClick={() => navigate(trainingPath(level.key, 'confirm'))} style={retryBtnStyle}>
            もう一度挑戦
          </button>
          <Link to="/quiz" style={listBtnStyle}>トレーニング一覧</Link>
        </div>
      </main>
    </div>
  );
}

function BreakdownPill({ score, label, count }: { score: number; label: string; count: number }) {
  return (
    <div style={bdPillStyle}>
      <span style={{ ...bdIconStyle, color: judgmentColor(score) }}>{judgmentIcon(score)}</span>
      <span style={bdCountStyle}>{count}</span>
      <span style={bdLabelStyle}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingResultPositional に準拠)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const mainStyle: CSSProperties = {
  flex: 1, padding: '1.25rem 1rem', maxWidth: 560, width: '100%', margin: '0 auto',
  display: 'flex', flexDirection: 'column', gap: '0.85rem',
};
const crumbStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textSecondary, textDecoration: 'none' };
const titleStyle: CSSProperties = { margin: 0, fontSize: '1.25rem', fontWeight: 700, color: THEME.textPrimary };
const scoreCardStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', background: '#fff',
  border: `1px solid ${THEME.border}`, borderRadius: '0.5rem', padding: '1rem',
};
const scoreCellStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' };
const scoreLabelStyle: CSSProperties = { fontSize: '0.8rem', color: THEME.textSecondary };
const scoreValueStyle: CSSProperties = { fontSize: '1.6rem', fontWeight: 800, color: THEME.textPrimary, fontVariantNumeric: 'tabular-nums' };
const ptCardStyle: CSSProperties = { background: '#EAF3DE', border: '1px solid #B9D79A', borderRadius: '0.45rem', padding: '0.7rem 0.9rem' };
const bestStyle: CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: '#3B6D11' };
const ptInfoStyle: CSSProperties = { fontSize: '0.9rem', color: THEME.textPrimary };
const saveErrorCardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.4rem', background: '#fff',
  border: `1px dashed ${THEME.border}`, borderRadius: '0.45rem', padding: '0.7rem 0.9rem',
};
const saveErrorTextStyle: CSSProperties = { fontSize: '0.85rem', color: THEME.errorText };
const saveRetryBtnStyle: CSSProperties = {
  alignSelf: 'flex-start', padding: '0.5rem 1rem', background: THEME.accent, color: '#fff',
  border: 'none', borderRadius: '0.4rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const breakdownStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const sectionHeaderStyle: CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: THEME.textSecondary };
const breakdownRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' };
const bdPillStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', padding: '0.5rem 0.3rem',
  background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '0.4rem',
};
const bdIconStyle: CSSProperties = { fontSize: '1.2rem', fontWeight: 700 };
const bdCountStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 800, color: THEME.textPrimary };
const bdLabelStyle: CSSProperties = { fontSize: '0.7rem', color: THEME.textSecondary };
const reviewSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' };
const itemStyle: CSSProperties = { background: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '0.45rem', overflow: 'hidden' };
const itemHeaderStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.6rem 0.7rem',
  background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
};
const iconStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 700, minWidth: '1.2rem' };
const scenarioPillStyle: CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: '#993C1D', background: '#FAEEDA',
  border: '1px solid #E5A551', borderRadius: '999px', padding: '0.15rem 0.55rem', whiteSpace: 'nowrap',
};
const boardStyle: CSSProperties = { display: 'flex', gap: 3, marginLeft: 'auto' };
const chevronStyle: CSSProperties = { fontSize: '0.75rem', color: THEME.textMuted };
const detailWrapStyle: CSSProperties = { padding: '0.7rem', borderTop: `1px solid ${THEME.border}`, background: '#FCFBF8', display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const donkDetailStyle: CSSProperties = { fontSize: '0.88rem', fontWeight: 700, color: THEME.textPrimary };
const kindTagStyle: CSSProperties = { fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: THEME.accent, borderRadius: 999, padding: '0.02rem 0.4rem' };
const btnRowStyle: CSSProperties = { display: 'flex', gap: '0.6rem', marginTop: '0.5rem' };
const retryBtnStyle: CSSProperties = {
  flex: 1, padding: '0.8rem 1rem', background: THEME.accent, color: '#fff', border: 'none',
  borderRadius: '0.45rem', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
const listBtnStyle: CSSProperties = {
  flex: 1, padding: '0.8rem 1rem', background: '#fff', color: THEME.textPrimary, border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem', fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none', textAlign: 'center',
};
const infoStyle: CSSProperties = { fontSize: '0.9rem', color: THEME.textMuted };
