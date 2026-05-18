// /quiz/review/{level}: 間違えた問題の一覧画面。
// 全件取得 (limit 100)。 各行に [答えを見る] / [復習リストから消す]。

import { useEffect, useState, type CSSProperties } from 'react';
import {
  apiGetMissedProblems,
  apiRemoveMissedProblem,
  type MissedProblemRow,
} from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { AppHeader } from '../AppHeader';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

export type MissedReviewLevel = 'beginner' | 'intermediate';

const LEVEL_LABEL: Record<MissedReviewLevel, string> = {
  beginner: '初級',
  intermediate: '中級',
};

interface Props {
  level: MissedReviewLevel;
}

export function MissedProblemsListPage({ level }: Props) {
  const auth = useAuth();
  const [items, setItems] = useState<MissedProblemRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/quiz" style={crumbStyle}>← トレーニングに戻る</Link>
        <h1 style={titleStyle}>間違えた問題から復習({LEVEL_LABEL[level]})</h1>

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
                    to={`/quiz/review/${level}/answer/${row.id}`}
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
