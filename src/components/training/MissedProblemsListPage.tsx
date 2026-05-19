// /quiz/review/preflop/{level}: 間違えた問題の一覧 + 挑戦モード入口。
// 全件取得 (limit 100)。 各行に [答えを見る] / [復習リストから消す]。
// 上部に「挑戦する」ボタン + 件数選択 (10/20/30/50)。

import { useEffect, useState, type CSSProperties } from 'react';
import {
  apiGetMissedProblems,
  apiRemoveMissedProblem,
  type MissedProblemRow,
} from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../router/router-core';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

export type MissedReviewLevel = 'beginner' | 'intermediate';

const LEVEL_LABEL: Record<MissedReviewLevel, string> = {
  beginner: '初級',
  intermediate: '中級',
};

const COUNT_OPTIONS = [10, 20, 30, 50] as const;
type CountOption = (typeof COUNT_OPTIONS)[number];

interface Props {
  level: MissedReviewLevel;
}

export function MissedProblemsListPage({ level }: Props) {
  const auth = useAuth();
  const [items, setItems] = useState<MissedProblemRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState<CountOption>(10);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    setErr(null);
    apiGetMissedProblems(sid, { level, limit: 100 })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId, level]);

  const handleRemove = async (id: number) => {
    if (!auth.sessionId) return;
    try {
      await apiRemoveMissedProblem(auth.sessionId, id);
      setItems((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      /* silent */
    }
  };

  const handleChallenge = () => {
    navigate(`/quiz/review/preflop/${level}/play?count=${count}`);
  };

  const itemsAvailable = !!items && items.length > 0;

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>
        <h1 style={titleStyle}>間違えた問題 - プリフロップ{LEVEL_LABEL[level]}</h1>

        <section style={challengeBoxStyle} aria-label="挑戦モード">
          <button
            type="button"
            onClick={handleChallenge}
            disabled={!itemsAvailable}
            style={itemsAvailable ? challengeBtnStyle : challengeBtnDisabledStyle}
          >
            挑戦する
          </button>
          <div style={countRowStyle} role="radiogroup" aria-label="件数">
            <span style={countLabelStyle}>件数</span>
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                onClick={() => setCount(n)}
                style={count === n ? countOptActiveStyle : countOptStyle}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        <header style={listHeaderStyle}>保存されている問題一覧</header>
        {err && <div style={errorStyle}>取得失敗: {err}</div>}
        {!err && items === null && <div style={infoStyle}>読み込み中…</div>}
        {!err && items && items.length === 0 && (
          <div style={infoStyle}>間違えた問題はまだありません。</div>
        )}
        {!err && items && items.length > 0 && (
          <ul style={listStyle}>
            {items.map((row) => (
              <li key={row.id} style={itemStyle}>
                <div style={itemLeftStyle}>
                  <span style={scenarioPillStyle}>{labelFor(row)}</span>
                  <span style={handStyle}>{row.hand}</span>
                </div>
                <div style={btnRowStyle}>
                  <Link
                    to={`/quiz/review/preflop/${level}/answer/${row.id}`}
                    style={primaryBtnStyle}
                  >
                    答えを見る
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(row.id)}
                    style={dangerBtnStyle}
                  >
                    復習リストから消す
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

/** missed_problems row → 日本語シナリオラベル。 */
function labelFor(row: MissedProblemRow): string {
  switch (row.scenario_type) {
    case 'bb_response':
      return `vs ${row.opener_position ?? '?'} open`;
    case 'middle_vs_open':
      return `${row.hero_position} vs ${row.opener_position ?? '?'} open`;
    case 'vs_3bet':
      return `${row.hero_position} → vs ${row.three_bettor_position ?? '?'} 3bet`;
    case 'vs_4bet':
      return `${row.hero_position} → vs ${row.opener_position ?? '?'} 4bet`;
    case 'risky_open':
      return `${row.hero_position} open`;
    case 'beginner_open':
      return `${row.hero_position} open`;
    case 'beginner_vs_open':
      return `vs ${row.opener_position ?? '?'} open`;
    default:
      return row.scenario_type;
  }
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
const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const challengeBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.7rem',
  padding: '0.9rem 1rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};
const challengeBtnStyle: CSSProperties = {
  padding: '0.75rem 2rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  minWidth: 160,
};
const challengeBtnDisabledStyle: CSSProperties = {
  ...challengeBtnStyle,
  background: '#d6cfc1',
  cursor: 'not-allowed',
};
const countRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
};
const countLabelStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  marginRight: '0.2rem',
};
const countOptStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const countOptActiveStyle: CSSProperties = {
  ...countOptStyle,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 700,
};
const listHeaderStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  marginTop: '0.4rem',
};
const infoStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textMuted,
  padding: '0.5rem 0',
};
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.45rem 0.7rem',
};
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const itemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.7rem 0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
};
const itemLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  flexWrap: 'wrap',
};
const scenarioPillStyle: CSSProperties = {
  fontSize: '0.74rem',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.15rem 0.55rem',
};
const handStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const btnRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};
const primaryBtnStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.35rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  fontFamily: 'inherit',
  textDecoration: 'none',
};
const dangerBtnStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  background: '#fff',
  color: '#7A2A26',
  border: '1px solid #C25855',
  borderRadius: '0.35rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
