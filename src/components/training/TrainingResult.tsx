// トレーニング結果画面 (初級・中級共有)。
// マウント時に POST /api/account/training-result で結果を保存し、レスポンスからベスト更新情報を表示。
// recordsStore から 20 問の記録を読んで、間違えた問題一覧を下部にレンダリングする。

import { useEffect, useState, type CSSProperties } from 'react';
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
  loadIntermediateRecords,
  loadRecords,
  missedRecords,
  type IntermediateRecord,
  type ProblemRecord,
} from '../../data/training/recordsStore';
import { CardSet } from '../CardSet';
import type { Suit, Rank } from '../../types/card';
import { scenarioLabel } from './scenarioLabel';
import { judgmentColor, judgmentIcon } from './judgmentIcon';
import { THEME } from '../../styles/theme';

export interface TrainingResultProps {
  level: TrainingLevel;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok'; submission: TrainingResultSubmission }
  | { kind: 'error'; message: string };

function parseQueryScore(): { score: number; total: number; mode: 'beginner' | 'intermediate' } | null {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const s = Number(sp.get('score'));
  const t = Number(sp.get('total'));
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  const mode = sp.get('mode') === 'intermediate' ? 'intermediate' : 'beginner';
  return { score: s, total: t, mode };
}

export function TrainingResult({ level }: TrainingResultProps) {
  const auth = useAuth();
  const scoreInfo = parseQueryScore();
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  // records は遷移時に確定する (sessionStorage + in-mem) ので、初回マウント時に取得して
  // state に格納する (useMemo より useEffect+setState の方が再 render を確実に trigger できる)。
  // useState の初期化関数で同期取得を試み、ブラウザバック復元時にも即時表示できるようにする。
  const mode = scoreInfo?.mode ?? 'beginner';
  const [missed, setMissed] = useState<ProblemRecord[]>(() => {
    if (mode === 'intermediate') return [];
    const records = loadRecords(level.key);
    return records ? missedRecords(records) : [];
  });
  // 中級は全 20 問を振り返り対象として表示 (満点問題も◎で表示)。
  const [intermediateAll, setIntermediateAll] = useState<IntermediateRecord[]>(() => {
    if (mode !== 'intermediate') return [];
    const records = loadIntermediateRecords(level.key);
    return records ?? [];
  });
  useEffect(() => {
    if (mode === 'intermediate') {
      const records = loadIntermediateRecords(level.key);
      if (records) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIntermediateAll(records);
      }
    } else {
      const records = loadRecords(level.key);
      if (records) {
        setMissed(missedRecords(records));
      }
    }
  }, [level.key, mode]);

  useEffect(() => {
    if (!scoreInfo || !auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSave({ kind: 'saving' });
    // 中級は finalSum が負になりうるが、DB の best_score は 0-100 制約。
    // 0 未満は 0 にクリップしてサーバーへ送る (実質「ベスト未更新」扱い)。
    const submitScore = Math.max(0, scoreInfo.score);
    apiSubmitTrainingResult(sid, {
      training_type: level.key,
      score: submitScore,
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
  const displayPct = total > 0 ? Math.round((Math.max(0, score) / total) * 100) : 0;
  const pointsPerQ = level.points ?? 0;

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>

        <h1 style={titleStyle}>お疲れさまでした!</h1>

        <div style={scoreCardStyle}>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>
              {mode === 'intermediate' ? 'スコア' : '正解数'}
            </span>
            <span style={scoreValueStyle}>{score}/{total}</span>
          </div>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>
              {mode === 'intermediate' ? '達成率' : '正答率'}
            </span>
            <span style={scoreValueStyle}>{displayPct}%</span>
          </div>
        </div>

        {mode === 'intermediate' ? (
          <IntermediatePtCard save={save} score={score} total={total} />
        ) : (
          <ResultPtCard save={save} score={score} pointsPerQ={pointsPerQ} />
        )}

        {mode === 'beginner' && missed.length > 0 && (
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

        {mode === 'intermediate' && intermediateAll.length > 0 && (
          <section style={missedSectionStyle} aria-label="振り返り一覧">
            <header style={missedHeaderStyle}>
              振り返り一覧 ({intermediateAll.length}問)
            </header>
            <ul style={missedListStyle}>
              {intermediateAll.map((rec, idx) => (
                <li key={rec.id} style={{ listStyle: 'none' }}>
                  <IntermediateReviewCard
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

function IntermediateReviewCard({
  record,
  onReview,
}: {
  record: IntermediateRecord;
  onReview: () => void;
}) {
  const icon = judgmentIcon(record.finalScore);
  const color = judgmentColor(record.finalScore);
  return (
    <div style={missedCardStyle}>
      <span style={{ ...iconBadgeStyle, color }} aria-label={`判定: ${icon}`}>
        {icon}
      </span>
      <div style={missedCardLeftStyle}>
        <span style={missedScenarioStyle}>vs {record.opener} open</span>
        <CardSet
          cards={record.cards.map((c) => ({
            rank: c.rank as Rank,
            suit: c.suit as Suit,
          }))}
          size="md"
          gap={4}
        />
        <div style={missedAnswerLineStyle}>
          獲得点:{' '}
          <span style={{ ...correctAnswerStyle, color }}>
            {record.finalScore >= 0 ? `+${record.finalScore}` : record.finalScore}pt
          </span>
          {record.timedOut && <span style={{ marginLeft: 6, color: '#b91c1c' }}>⏱ 時間切れ</span>}
        </div>
      </div>
      <button type="button" onClick={onReview} style={reviewBtnStyle}>
        問題へ
      </button>
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

/**
 * 結果画面の pt カード。is_best / is_first に応じて 3 パターンの表示を切り替える。
 *  A. 初回 (previous_best === 0 && is_best): 「初挑戦お疲れさま!+{N}pt 獲得!」
 *  B. ベスト更新 (is_best && previous_best > 0): 「過去最高更新! {prev}→{curr}点 +{delta}pt 獲得!」
 *  C. ベスト未更新 (!is_best): 「※過去最高は更新できませんでした / 今回 {N}点 (0pt 獲得) / ベスト: {curr}点」
 *
 * saving / error 中は中間メッセージのみ表示する。
 */
/**
 * 中級用 pt カード。 total=40 (20 問 × 2pt 満点)。
 *  is_best=true → "🎉 自己ベスト更新!" (前回スコア → 今回スコア)
 *  is_best=false → "※ 自己ベスト未更新" (今回スコア / 過去ベスト)
 */
function IntermediatePtCard({
  save,
  score,
  total,
}: {
  save: SaveState;
  score: number;
  total: number;
}) {
  if (save.kind === 'saving' || save.kind === 'idle') {
    return (
      <div style={ptCardStyle}>
        <span style={subInfoStyle}>結果を保存中…</span>
      </div>
    );
  }
  if (save.kind === 'error') {
    return (
      <div style={ptCardStyle}>
        <span style={subErrorStyle}>結果保存失敗: {save.message}</span>
      </div>
    );
  }
  const sub = save.submission;
  const submittedScore = Math.max(0, score);
  if (sub.is_best && sub.previous_best === 0) {
    return (
      <div style={ptCardStyle}>
        <span style={celebrateStyle}>🎉 初挑戦お疲れさま!</span>
        <span style={ptBigStyle}>{submittedScore} / {total} 点獲得</span>
      </div>
    );
  }
  if (sub.is_best) {
    return (
      <div style={ptCardStyle}>
        <span style={celebrateStyle}>🎉 自己ベスト更新!</span>
        <span style={subInfoStyle}>
          {sub.previous_best} → {sub.current_best} 点 (おめでとう!)
        </span>
        <span style={ptBigStyle}>満点 {total} 点中</span>
      </div>
    );
  }
  return (
    <div style={ptCardNoUpdateStyle}>
      <span style={noUpdateHeadStyle}>※ 自己ベストは更新できませんでした</span>
      <span style={subInfoStyle}>
        今回スコア: {score} / {total} 点
      </span>
      <span style={subInfoStyle}>
        過去ベスト: {sub.current_best} / {total} 点 (試行 #{sub.total_attempts})
      </span>
    </div>
  );
}

export function ResultPtCard({
  save,
  score,
  pointsPerQ,
}: {
  save: SaveState;
  score: number;
  pointsPerQ: number;
}) {
  if (save.kind === 'saving' || save.kind === 'idle') {
    return (
      <div style={ptCardStyle}>
        <span style={subInfoStyle}>結果を保存中…</span>
      </div>
    );
  }
  if (save.kind === 'error') {
    return (
      <div style={ptCardStyle}>
        <span style={subErrorStyle}>結果保存失敗: {save.message}</span>
      </div>
    );
  }

  const sub = save.submission;
  const isFirst = sub.is_best && sub.previous_best === 0;
  const isBestUpdate = sub.is_best && sub.previous_best > 0;
  const isNoUpdate = !sub.is_best;

  if (isFirst) {
    const earnedPt = score * pointsPerQ;
    return (
      <div style={ptCardStyle}>
        <span style={celebrateStyle}>🎉 初挑戦お疲れさま!</span>
        <span style={ptBigStyle}>+{earnedPt}pt 獲得!</span>
        <span style={subInfoStyle}>過去の最高スコア: {sub.current_best}点</span>
      </div>
    );
  }

  if (isBestUpdate) {
    const prevPt = sub.previous_best * pointsPerQ;
    const currPt = sub.current_best * pointsPerQ;
    const delta = currPt - prevPt;
    return (
      <div style={ptCardStyle}>
        <span style={celebrateStyle}>🎉 過去最高更新!</span>
        <span style={subInfoStyle}>
          {sub.previous_best} → {sub.current_best}点 (おめでとう!)
        </span>
        <span style={ptBigStyle}>+{delta}pt 獲得!</span>
        <span style={subInfoStyle}>過去の最高スコア: {sub.current_best}点</span>
      </div>
    );
  }

  // isNoUpdate
  if (isNoUpdate) {
    return (
      <div style={ptCardNoUpdateStyle}>
        <span style={noUpdateHeadStyle}>※ 過去最高は更新できませんでした</span>
        <span style={subInfoStyle}>
          今回スコア: {score}点 (0pt 獲得)
        </span>
        <span style={subInfoStyle}>
          過去の最高スコア: {sub.current_best}点 (試行 #{sub.total_attempts})
        </span>
      </div>
    );
  }
  return null;
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

const ptBigStyle: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  color: '#993C1D',
  fontVariantNumeric: 'tabular-nums',
};

const ptCardNoUpdateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
  background: '#fff',
  border: `1px dashed ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '1rem',
};

const noUpdateHeadStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 600,
  color: '#7B5A3E',
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

const iconBadgeStyle: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  minWidth: '1.6rem',
  textAlign: 'center',
  flexShrink: 0,
};
