// トレーニング結果画面 (初級・中級共有)。
// マウント時に POST /api/account/training-result で結果を保存し、レスポンスからベスト更新情報を表示。
// recordsStore から 20 問の記録を読んで、間違えた問題一覧を下部にレンダリングする。

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { apiSubmitTrainingResult, type TrainingResultSubmission } from '../../api/account';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import {
  trainingPath,
  trainingReviewPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import {
  loadRecords,
  missedRecords,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import { CardSet } from '../CardSet';
import type { Suit, Rank } from '../../types/card';
import { scenarioLabel } from './scenarioLabel';
import { THEME } from '../../styles/theme';

export interface TrainingResultProps {
  level: TrainingLevel;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok'; submission: TrainingResultSubmission }
  | { kind: 'error'; message: string };

function parseQueryScore(): { score: number; total: number } | null {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const s = Number(sp.get('score'));
  const t = Number(sp.get('total'));
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  return { score: s, total: t };
}

export function TrainingResult({ level }: TrainingResultProps) {
  const auth = useAuth();
  const scoreInfo = parseQueryScore();
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  // records は遷移時に確定する (sessionStorage + in-mem) ので、初回 render で同期取得して memoize
  const missed = useMemo<ProblemRecord[]>(() => {
    const records = loadRecords(level.key);
    return records ? missedRecords(records) : [];
  }, [level.key]);

  useEffect(() => {
    if (!scoreInfo || !auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave({ kind: 'saving' });
    apiSubmitTrainingResult(sid, {
      training_type: level.key,
      score: scoreInfo.score,
    })
      .then((submission) => {
        if (cancelled) return;
        setSave({ kind: 'ok', submission });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSave({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // scoreInfo は parseQueryScore() で同期的に取れるが、依存配列に入れると参照不安定なので
    // primitive を二つ分入れる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.sessionId, level.key, scoreInfo?.score, scoreInfo?.total]);

  if (!scoreInfo) {
    return (
      <div style={pageStyle}>
        <div style={errorBoxStyle}>
          結果情報が見つかりません。
          <button type="button" onClick={() => navigate('/quiz')} style={errorBtnStyle}>
            トレーニングに戻る
          </button>
        </div>
      </div>
    );
  }

  const { score, total } = scoreInfo;
  const pct = Math.round((score / total) * 100);
  const earnedPt = level.points !== null ? level.points * score : 0;

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>

        <h1 style={titleStyle}>お疲れさまでした!</h1>

        <div style={scoreCardStyle}>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>正解数</span>
            <span style={scoreValueStyle}>{score}/{total}</span>
          </div>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>正答率</span>
            <span style={scoreValueStyle}>{pct}%</span>
          </div>
        </div>

        <div style={ptCardStyle}>
          <span style={celebrateStyle}>🎉 {earnedPt}pt 獲得!</span>
          {save.kind === 'ok' && (
            <BestBadge submission={save.submission} score={score} earnedPt={earnedPt} pointsPerQ={level.points ?? 0} />
          )}
          {save.kind === 'saving' && (
            <span style={subInfoStyle}>結果を保存中…</span>
          )}
          {save.kind === 'error' && (
            <span style={subErrorStyle}>結果保存失敗: {save.message}</span>
          )}
        </div>

        {missed.length > 0 && (
          <section style={missedSectionStyle} aria-label="間違えた問題">
            <header style={missedHeaderStyle}>間違えた問題 ({missed.length}問)</header>
            <ul style={missedListStyle}>
              {missed.map((rec, idx) => (
                <li key={rec.id} style={{ listStyle: 'none' }}>
                  <MissedCard
                    record={rec}
                    onReview={() => navigate(trainingReviewPath(level.key, idx + 1))}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div style={btnRowStyle}>
          <button
            type="button"
            onClick={() => navigate(trainingPath(level.key, 'confirm'))}
            style={retryBtnStyle}
          >
            もう一度挑戦
          </button>
          <Link to="/quiz" style={listBtnStyle}>
            トレーニング一覧
          </Link>
        </div>
      </main>
    </div>
  );
}

function MissedCard({
  record,
  onReview,
}: {
  record: ProblemRecord;
  onReview: () => void;
}) {
  const userText = record.userAnswer === 'participate' ? '参加' : '参加しない';
  const correctText = record.correct === 'participate' ? '参加' : '参加しない';
  return (
    <div style={missedCardStyle}>
      <div style={missedCardLeftStyle}>
        <span style={missedScenarioStyle}>{scenarioLabel(record)}</span>
        <CardSet
          cards={record.cards.map((c) => ({
            rank: c.rank as Rank,
            suit: c.suit as Suit,
          }))}
          size="md"
          gap={4}
        />
        <div style={missedAnswerLineStyle}>
          あなた: <span style={userAnswerStyle}>{userText}</span>
          {' | '}
          正解: <span style={correctAnswerStyle}>{correctText}</span>
        </div>
      </div>
      <button type="button" onClick={onReview} style={reviewBtnStyle}>
        問題へ
      </button>
    </div>
  );
}

function BestBadge({
  submission,
  score,
  earnedPt,
  pointsPerQ,
}: {
  submission: TrainingResultSubmission;
  score: number;
  earnedPt: number;
  pointsPerQ: number;
}) {
  if (submission.is_best) {
    if (submission.previous_best > 0) {
      const prevPt = submission.previous_best * pointsPerQ;
      const delta = earnedPt - prevPt;
      return (
        <span style={subInfoStyle}>
          自己ベスト更新! (前回: {prevPt}pt → {earnedPt}pt、+{delta}pt)
        </span>
      );
    }
    return <span style={subInfoStyle}>自己ベスト更新! (初回挑戦)</span>;
  }
  // ベスト未更新
  const bestPt = submission.current_best * pointsPerQ;
  return (
    <span style={subInfoStyle}>
      ベスト記録: {submission.current_best}/{score >= submission.current_best ? score : submission.current_best} ({bestPt}pt)。
      今回 +{earnedPt}pt 試行 #{submission.total_attempts}
    </span>
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

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.35rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  textAlign: 'center',
};

const scoreCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.6rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.95rem',
};

const scoreCellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.2rem',
};

const scoreLabelStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textSecondary,
  fontWeight: 600,
};

const scoreValueStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  fontVariantNumeric: 'tabular-nums',
};

const ptCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '0.5rem',
  padding: '1.1rem 1rem',
};

const celebrateStyle: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 700,
  color: '#412402',
};

const subInfoStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#633806',
  textAlign: 'center',
};

const subErrorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
};

const btnRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.65rem',
};

const retryBtnStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const listBtnStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.95rem',
  textAlign: 'center',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

const errorBoxStyle: CSSProperties = {
  margin: 'auto',
  padding: '1rem 1.2rem',
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  color: THEME.errorText,
  borderRadius: '0.4rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const errorBtnStyle: CSSProperties = {
  padding: '0.45rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const missedSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginTop: '0.5rem',
};

const missedHeaderStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  borderTop: `1px solid ${THEME.border}`,
  paddingTop: '0.7rem',
};

const missedListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const missedCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.7rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.7rem 0.85rem',
};

const missedCardLeftStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const missedScenarioStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#993C1D',
};

const missedAnswerLineStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: THEME.textSecondary,
};

const userAnswerStyle: CSSProperties = {
  fontWeight: 600,
  color: THEME.textPrimary,
};

const correctAnswerStyle: CSSProperties = {
  fontWeight: 700,
  color: '#993C1D',
};

const reviewBtnStyle: CSSProperties = {
  padding: '0.5rem 0.85rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
};
