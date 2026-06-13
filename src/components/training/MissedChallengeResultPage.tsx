// /quiz/review/preflop/{level}/result: 挑戦モード完了画面。
// sessionStorage 経由で受け取った結果 (MissedChallengeResult) を表示。
// 各問に「間違えた問題から消去」ボタン (PATCH /api/account/missed-problems/{id}/remove)。

import { useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { apiRemoveMissedProblem } from '../../api/missedProblems';
import { AppHeader } from '../AppHeader';
import { judgmentIcon, judgmentColor } from './judgmentIcon';
import {
  clearChallengeResult,
  loadChallengeResult,
  missedReviewLabel,
  type MissedChallengeResult,
  type MissedReviewLevel,
} from './missedChallengeStore';
import { THEME } from '../../styles/theme';

interface Props {
  level: MissedReviewLevel;
}

type RemoveState = 'idle' | 'removing' | 'removed';

export function MissedChallengeResultPage({ level }: Props) {
  const auth = useAuth();
  const [data] = useState<MissedChallengeResult | null>(() => loadChallengeResult());
  const [removeStates, setRemoveStates] = useState<Map<number, RemoveState>>(new Map());

  // 表示中の挑戦結果が現在の level と一致しない場合は破棄してリストに戻す
  useEffect(() => {
    if (data && data.level !== level) {
      clearChallengeResult();
      navigate(`/quiz/review/preflop/${level}`);
    }
  }, [data, level]);

  // 戻ったあとに sessionStorage が古い情報を残さないよう、 アンマウント時にクリア
  useEffect(() => {
    return () => {
      clearChallengeResult();
    };
  }, []);

  if (!data) {
    return (
      <div style={pageStyle}>
        <AppHeader showBack />
        <main style={mainStyle}>
          <div style={errorStyle}>結果情報が見つかりません。</div>
          <Link to={`/quiz/review/preflop/${level}`} style={primaryLinkStyle}>
            戻る
          </Link>
        </main>
      </div>
    );
  }

  const handleRemove = async (id: number) => {
    if (!auth.sessionId) return;
    setRemoveStates((prev) => new Map(prev).set(id, 'removing'));
    try {
      await apiRemoveMissedProblem(auth.sessionId, id);
      setRemoveStates((prev) => new Map(prev).set(id, 'removed'));
      // missed_problem_id は保持したまま (= 「答えを見る」リンクが消去後も有効、
      //  サーバー API は includeRemoved=true で取得するため answer 画面は表示可能)。
    } catch {
      setRemoveStates((prev) => new Map(prev).set(id, 'idle'));
    }
  };

  const pct = data.total > 0 ? Math.round((data.perfect_count / data.total) * 100) : 0;
  const levelLabel = missedReviewLabel(level);

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <h1 style={titleStyle}>完了!</h1>

        <section style={summaryStyle}>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>結果</span>
            <span style={summaryValueStyle}>
              {data.total}問中 {data.perfect_count}問正解
            </span>
          </div>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>正答率</span>
            <span style={summaryPctStyle}>{pct}%</span>
          </div>
          <div style={summaryNoteStyle}>※ 成績には反映されません</div>
          <div style={summaryNoteStyle}>プリフロップ{levelLabel} 挑戦モード</div>
        </section>

        <header style={listHeaderStyle}>問題一覧</header>
        <ul style={listStyle}>
          {data.items.map((it, idx) => {
            const icon = judgmentIcon(it.final_score);
            const color = judgmentColor(it.final_score);
            const removeState = removeStates.get(it.missed_problem_id) ?? 'idle';
            const removed = removeState === 'removed';
            return (
              <li key={`${idx}-${it.hand}`} style={itemStyle}>
                <div style={itemLeftStyle}>
                  <span style={{ ...iconStyle, color }} aria-label={`判定: ${icon}`}>
                    {icon}
                  </span>
                  <span style={indexStyle}>{idx + 1}問目</span>
                  <span style={scenarioPillStyle}>{it.scenario_label}</span>
                  <span style={handStyle}>{it.hand}</span>
                </div>
                <div style={actionRowStyle}>
                  <Link
                    to={`/quiz/review/preflop/${level}/answer/${it.missed_problem_id}`}
                    style={viewAnswerBtnStyle}
                  >
                    答えを見る
                  </Link>
                  {removed ? (
                    <span style={removedLabelStyle}>消去済み</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemove(it.missed_problem_id)}
                      disabled={removeState === 'removing'}
                      style={removeState === 'removing' ? removeBtnBusyStyle : removeBtnStyle}
                    >
                      {removeState === 'removing' ? '消去中…' : '間違えた問題から消去'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <Link to={`/quiz/review/preflop/${level}`} style={primaryLinkStyle}>
          戻る
        </Link>
      </main>
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
  gap: '0.85rem',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.35rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  textAlign: 'center',
};
const summaryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
};
const summaryRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '0.5rem',
};
const summaryLabelStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: '#633806',
  fontWeight: 600,
};
const summaryValueStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: '#412402',
};
const summaryPctStyle: CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  color: '#993C1D',
  fontVariantNumeric: 'tabular-nums',
};
const summaryNoteStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: '#633806',
};
const listHeaderStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  marginTop: '0.4rem',
};
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
};
const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.6rem 0.8rem',
  flexWrap: 'wrap',
};
const itemLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flex: 1,
  flexWrap: 'wrap',
};
const iconStyle: CSSProperties = {
  fontSize: '1.3rem',
  fontWeight: 900,
  minWidth: '1.6rem',
  textAlign: 'center',
};
const indexStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  minWidth: '3rem',
};
const scenarioPillStyle: CSSProperties = {
  fontSize: '0.74rem',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.12rem 0.5rem',
};
const handStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.45rem',
  alignItems: 'center',
  flexWrap: 'wrap',
};
const viewAnswerBtnStyle: CSSProperties = {
  padding: '0.4rem 0.7rem',
  background: '#fff',
  color: '#3B6D11',
  border: '1px solid #6B9C3C',
  borderRadius: '0.3rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  textDecoration: 'none',
  fontFamily: 'inherit',
};
const removeBtnStyle: CSSProperties = {
  padding: '0.4rem 0.7rem',
  background: '#fff',
  color: '#7A2A26',
  border: '1px solid #C25855',
  borderRadius: '0.3rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const removeBtnBusyStyle: CSSProperties = {
  ...removeBtnStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
};
const removedLabelStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
};
const primaryLinkStyle: CSSProperties = {
  alignSelf: 'center',
  marginTop: '0.6rem',
  padding: '0.65rem 1.4rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontSize: '0.95rem',
  fontWeight: 700,
  textDecoration: 'none',
  fontFamily: 'inherit',
};
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.45rem 0.7rem',
};
