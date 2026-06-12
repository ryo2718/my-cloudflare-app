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
import { savePendingResult, clearPendingResult } from '../../data/training/pendingResults';
import {
  loadBeginnerOpenRecords,
  type BeginnerOpenRecord,
} from '../../data/training/beginnerOpenRecordsStore';
import { CardSet } from '../CardSet';
import type { Suit, Rank } from '../../types/card';
import { scenarioLabel } from './scenarioLabel';
import { intermediateScenarioLabel } from './intermediateScenarioLabel';
import { judgmentIcon } from './judgmentIcon';
import { breakdownPct, computeScoreBreakdown } from './scoreBreakdown';
import { THEME } from '../../styles/theme';

export interface TrainingResultProps {
  level: TrainingLevel;
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok'; submission: TrainingResultSubmission }
  | { kind: 'error'; message: string };

// ---------------------------------------------------------------------------
// submission キャッシュ (振り返りからの戻りで再 submit させない)
// ---------------------------------------------------------------------------

const SUBMISSION_CACHE_PREFIX = 'training_submission:';

function submissionCacheKey(levelKey: string, score: number, total: number): string {
  return `${SUBMISSION_CACHE_PREFIX}${levelKey}:${score}:${total}`;
}

function loadCachedSubmission(key: string): TrainingResultSubmission | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as TrainingResultSubmission;
  } catch {
    return null;
  }
}

function saveCachedSubmission(key: string, value: TrainingResultSubmission): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

type ResultMode = 'beginner' | 'intermediate';

function parseQueryScore(): { score: number; total: number; mode: ResultMode } | null {
  if (typeof window === 'undefined') return null;
  const sp = new URLSearchParams(window.location.search);
  const s = Number(sp.get('score'));
  const t = Number(sp.get('total'));
  if (!Number.isFinite(s) || !Number.isFinite(t) || t <= 0) return null;
  const mode: ResultMode =
    sp.get('mode') === 'intermediate' ? 'intermediate' : 'beginner';
  return { score: s, total: t, mode };
}

export function TrainingResult({ level }: TrainingResultProps) {
  const auth = useAuth();
  const scoreInfo = parseQueryScore();
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });
  const [retryNonce, setRetryNonce] = useState(0);
  // records は遷移時に確定する (sessionStorage + in-mem) ので、初回マウント時に取得して
  // state に格納する (useMemo より useEffect+setState の方が再 render を確実に trigger できる)。
  // useState の初期化関数で同期取得を試み、ブラウザバック復元時にも即時表示できるようにする。
  const mode = scoreInfo?.mode ?? 'beginner';
  const isIntermediate = mode === 'intermediate';
  // 初級オープンは「間違えた問題」ではなく全問の「答え一覧」(slider %) を表示する。
  const isBeginnerOpen = level.key === 'preflop_beginner_open';
  const [openRecords, setOpenRecords] = useState<BeginnerOpenRecord[]>(() =>
    isBeginnerOpen ? (loadBeginnerOpenRecords(level.key) ?? []) : [],
  );
  const [missed, setMissed] = useState<ProblemRecord[]>(() => {
    if (isIntermediate) return [];
    const records = loadRecords(level.key);
    return records ? missedRecords(records) : [];
  });
  const [intermediateAll, setIntermediateAll] = useState<IntermediateRecord[]>(() => {
    if (!isIntermediate) return [];
    const records = loadIntermediateRecords(level.key);
    return records ?? [];
  });
  useEffect(() => {
    if (isBeginnerOpen) {
      const records = loadBeginnerOpenRecords(level.key);
      if (records) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenRecords(records);
      }
    } else if (isIntermediate) {
      const records = loadIntermediateRecords(level.key);
      if (records) {
        setIntermediateAll(records);
      }
    } else {
      const records = loadRecords(level.key);
      if (records) {
        setMissed(missedRecords(records));
      }
    }
  }, [level.key, isIntermediate, isBeginnerOpen]);

  // submission レスポンスをセッション単位でキャッシュ。
  // 振り返り画面に遷移 → 戻り時に再 submit すると 2 回目は is_best=false になり「更新通知が消える」
  // バグを防止する。同じ (level/score/total) なら 1 回目のレスポンスを再利用。
  useEffect(() => {
    if (!scoreInfo || !auth.sessionId) return;
    const sid = auth.sessionId;
    const submitScore = Math.max(0, scoreInfo.score);
    const cacheKey = submissionCacheKey(level.key, submitScore, scoreInfo.total);

    // キャッシュヒット → API 呼ばずに即セット
    const cached = loadCachedSubmission(cacheKey);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSave({ kind: 'ok', submission: cached });
      return;
    }

    let cancelled = false;
    setSave({ kind: 'saving' });
    apiSubmitTrainingResult(sid, {
      training_type: level.key,
      score: submitScore,
    })
      .then((submission) => {
        if (cancelled) return;
        saveCachedSubmission(cacheKey, submission);
        clearPendingResult(level.key); // 保存成功 → 退避を破棄
        setSave({ kind: 'ok', submission });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 保存失敗 → スコアを退避 (再ログイン/再試行で再送。点数は冪等で二重加算なし)。
        savePendingResult({ training_type: level.key, score: submitScore });
        setSave({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.sessionId, level.key, scoreInfo?.score, scoreInfo?.total, retryNonce]);

  const onRetry = () => setRetryNonce((n) => n + 1);

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
  // 中級は finalSum が負になり得る。表示上は max(0, score) を採用。
  const displayScore = isIntermediate ? Math.max(0, score) : score;
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
              {isIntermediate ? 'スコア' : '正解数'}
            </span>
            <span style={scoreValueStyle}>{displayScore}/{total}</span>
          </div>
          <div style={scoreCellStyle}>
            <span style={scoreLabelStyle}>
              {isIntermediate ? '達成率' : '正答率'}
            </span>
            <span style={scoreValueStyle}>{displayPct}%</span>
          </div>
        </div>

        {isIntermediate ? (
          <IntermediatePtCard save={save} score={score} total={total} onRetry={onRetry} />
        ) : (
          <ResultPtCard save={save} score={score} pointsPerQ={pointsPerQ} onRetry={onRetry} />
        )}

        {isIntermediate && intermediateAll.length > 0 && (
          <ScoreBreakdownSection records={intermediateAll} />
        )}

        {isBeginnerOpen && openRecords.length > 0 && (
          <section style={missedSectionStyle} aria-label="答え一覧">
            <header style={missedHeaderStyle}>答え一覧 ({openRecords.length}問)</header>
            <ul style={missedListStyle}>
              {openRecords.map((rec) => (
                <li key={rec.id} style={{ listStyle: 'none' }}>
                  <OpenAnswerCard record={rec} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {!isIntermediate && missed.length > 0 && (
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

        {isIntermediate && intermediateAll.length > 0 && (
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

function ScoreBreakdownSection({ records }: { records: IntermediateRecord[] }) {
  const b = computeScoreBreakdown(records);
  // 仕様: アイコンと横棒バーで色を分ける。
  // アイコン: ◎ 緑 / ○ オレンジ濃 / △ グレー濃 / ✕ 赤
  // バー: 2pt 緑 / 1pt オレンジ明 / 0pt グレー明 / -1pt 赤
  const ICON_COLORS = {
    perfect: '#3B6D11',
    partial: '#BA7517',
    zero:    '#888780',
    miss:    '#A32D2D',
  };
  const BAR_COLORS = {
    perfect: '#3B6D11',
    partial: '#EF9F27',
    zero:    '#B4B2A9',
    miss:    '#A32D2D',
  };
  const ROWS: Array<{
    key: keyof typeof ICON_COLORS;
    icon: string;
    label: string;
    count: number;
  }> = [
    { key: 'perfect', icon: '◎', label: '2pt(満点)', count: b.perfect },
    { key: 'partial', icon: '○', label: '1pt(部分点)', count: b.partial },
    { key: 'zero',    icon: '△', label: '0pt(無回答)', count: b.zero },
    { key: 'miss',    icon: '✕', label: '-1pt(ミス)', count: b.miss },
  ];
  return (
    <section style={breakdownSectionStyle} aria-label="スコア内訳">
      <header style={breakdownHeaderStyle}>スコア内訳</header>
      <div style={breakdownBarStyle} aria-hidden>
        {ROWS.map((r) => {
          const pct = breakdownPct(r.count, b.total);
          if (pct <= 0) return null;
          return (
            <div
              key={r.key}
              style={{ width: `${pct}%`, height: '100%', background: BAR_COLORS[r.key] }}
            />
          );
        })}
      </div>
      <ul style={breakdownListStyle}>
        {ROWS.map((r, i) => {
          const pct = breakdownPct(r.count, b.total);
          return (
            <li
              key={r.key}
              style={{
                ...breakdownRowStyle,
                borderBottom: i < ROWS.length - 1 ? '0.5px solid #D3D1C7' : 'none',
              }}
            >
              <span style={{ ...breakdownIconStyle, color: ICON_COLORS[r.key] }}>{r.icon}</span>
              <span style={breakdownLabelStyle}>{r.label}</span>
              <span style={breakdownCountStyle}>{r.count}問</span>
              <span style={breakdownPctStyle}>{formatPercent(pct)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatPercent(pct: number): string {
  if (Math.abs(pct - Math.round(pct)) < 0.01) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

function IntermediateReviewCard({
  record,
  onReview,
}: {
  record: IntermediateRecord;
  onReview: () => void;
}) {
  const icon = judgmentIcon(record.finalScore);
  // スコア内訳と同じ色テーブルを参照 (◎ 緑 / ○ オレンジ / △ グレー / ✕ 赤)
  const color =
    record.finalScore >= 2 ? '#3B6D11'
      : record.finalScore === 1 ? '#BA7517'
      : record.finalScore === 0 ? '#888780'
      : '#A32D2D';
  return (
    <div style={missedCardStyle}>
      <span style={{ ...iconBadgeStyle, color }} aria-label={`判定: ${icon}`}>
        {icon}
      </span>
      <div style={missedCardLeftStyle}>
        <span style={missedScenarioStyle}>{intermediateScenarioLabel(record)}</span>
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

/** 初級オープンの答え一覧 1 行 (ポジション+ハンド / 正解レイズ% / 自分の回答%)。 */
function OpenAnswerCard({ record }: { record: BeginnerOpenRecord }) {
  const correct = record.points > 0;
  const icon = correct ? '○' : '✕';
  const color = correct ? '#3B6D11' : '#A32D2D';
  const answerText = record.answerPct === null ? '—' : `${record.answerPct}%`;
  return (
    <div style={missedCardStyle}>
      <span style={{ ...iconBadgeStyle, color }} aria-label={`判定: ${icon}`}>
        {icon}
      </span>
      <div style={missedCardLeftStyle}>
        <span style={missedScenarioStyle}>{record.position} {record.hand}</span>
        <div style={missedAnswerLineStyle}>
          あなた: <span style={userAnswerStyle}>{answerText}</span>
          {' | '}
          正解: <span style={correctAnswerStyle}>{record.raisePct}%</span>
        </div>
      </div>
    </div>
  );
}

/** 保存失敗カード: エラー表示 + 再保存ボタン (スコアは退避済みなので失われない)。 */
function SaveErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={ptCardNoUpdateStyle}>
      <span style={subErrorStyle}>結果の保存に失敗しました ({message})</span>
      <span style={subInfoStyle}>スコアは退避済みです。再保存するか、再ログイン後に自動で再送されます。</span>
      <button type="button" onClick={() => onRetry?.()} style={retryBtnStyle}>
        再保存する
      </button>
    </div>
  );
}

function IntermediatePtCard({
  save,
  score,
  total,
  onRetry,
}: {
  save: SaveState;
  score: number;
  total: number;
  onRetry?: () => void;
}) {
  if (save.kind === 'saving' || save.kind === 'idle') {
    return (
      <div style={ptCardStyle}>
        <span style={subInfoStyle}>結果を保存中…</span>
      </div>
    );
  }
  if (save.kind === 'error') {
    return <SaveErrorCard message={save.message} onRetry={onRetry} />;
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
  onRetry,
}: {
  save: SaveState;
  score: number;
  pointsPerQ: number;
  onRetry?: () => void;
}) {
  if (save.kind === 'saving' || save.kind === 'idle') {
    return (
      <div style={ptCardStyle}>
        <span style={subInfoStyle}>結果を保存中…</span>
      </div>
    );
  }
  if (save.kind === 'error') {
    return <SaveErrorCard message={save.message} onRetry={onRetry} />;
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

const breakdownSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  marginTop: '0.4rem',
};
const breakdownHeaderStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#993C1D',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #993C1D',
};
const breakdownBarStyle: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '8px',
  borderRadius: '4px',
  overflow: 'hidden',
  background: '#ECE9E0',
};
const breakdownListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  background: '#fff',
  border: '0.5px solid #D3D1C7',
  borderRadius: '8px',
};
const breakdownRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 1fr auto auto',
  alignItems: 'baseline',
  gap: '12px',
  padding: '8px 12px',
  fontSize: '13px',
};
const breakdownIconStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: 800,
  textAlign: 'center',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
const breakdownLabelStyle: CSSProperties = {
  color: '#2C2C2A',
};
const breakdownCountStyle: CSSProperties = {
  color: '#5F5E5A',
  fontVariantNumeric: 'tabular-nums',
  minWidth: '3.5rem',
  textAlign: 'right',
};
const breakdownPctStyle: CSSProperties = {
  color: '#2C2C2A',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  minWidth: '3.5rem',
  textAlign: 'right',
};

const iconBadgeStyle: CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  minWidth: '1.6rem',
  textAlign: 'center',
  flexShrink: 0,
};
