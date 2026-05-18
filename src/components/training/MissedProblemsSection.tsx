// QuizPage 下部の「間違えた問題から復習」セクション。
//
// 構成:
//   - 件数選択 (10/20/50/100) + [復習する] (全体復習開始)
//   - 個別リスト (最大 20 件): シナリオ + ハンド + [復習する] + [復習リストから消す]
//
// データ取得は GET /api/account/missed-problems (Step 1 API)。
// Step 1 で記録対象は中級のみのため、ここでも level=intermediate 固定。

import { useEffect, useState, type CSSProperties } from 'react';
import {
  apiGetMissedProblems,
  apiRemoveMissedProblem,
  type MissedProblemRow,
} from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';

const LIMIT_OPTIONS = [10, 20, 50, 100] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];

export function MissedProblemsSection() {
  const auth = useAuth();
  const [limit, setLimit] = useState<LimitOption>(10);
  const [items, setItems] = useState<MissedProblemRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiGetMissedProblems(sid, { level: 'intermediate', limit: 20 })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [auth.sessionId]);

  const startBulkReview = () => {
    const params = new URLSearchParams({
      level: 'intermediate',
      limit: String(limit),
    });
    navigate(`/training/review/play?${params.toString()}`);
  };

  const startSingleReview = (problemId: number) => {
    const params = new URLSearchParams({
      level: 'intermediate',
      problem_id: String(problemId),
    });
    navigate(`/training/review/play?${params.toString()}`);
  };

  const handleRemove = async (problemId: number) => {
    if (!auth.sessionId) return;
    try {
      await apiRemoveMissedProblem(auth.sessionId, problemId);
      setItems((prev) => (prev ? prev.filter((p) => p.id !== problemId) : prev));
    } catch {
      // silent fallback
    }
  };

  return (
    <section style={sectionStyle} aria-label="間違えた問題から復習">
      <header style={headerStyle}>間違えた問題から復習</header>

      <div style={controlRowStyle}>
        <label style={labelStyle}>
          問題数
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) as LimitOption)}
            style={selectStyle}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}問</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={startBulkReview}
          style={primaryBtnStyle}
          disabled={!items || items.length === 0}
        >
          復習する
        </button>
      </div>

      {loadError && <div style={errorStyle}>取得失敗: {loadError}</div>}

      {items === null ? (
        <div style={infoStyle}>読み込み中…</div>
      ) : items.length === 0 ? (
        <div style={infoStyle}>まだ間違えた問題がありません。</div>
      ) : (
        <ul style={listStyle}>
          {items.map((row) => (
            <li key={row.id} style={itemStyle}>
              <div style={itemLeftStyle}>
                <span style={scenarioPillStyle}>{labelFor(row)}</span>
                <span style={handStyle}>{row.hand}</span>
              </div>
              <div style={itemBtnRowStyle}>
                <button
                  type="button"
                  onClick={() => startSingleReview(row.id)}
                  style={smallBtnStyle}
                >
                  復習する
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(row.id)}
                  style={smallBtnDangerStyle}
                >
                  復習リストから消す
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** missed_problems row → 日本語ラベル (intermediateScenarioLabel を参考に最小実装)。 */
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
    default:
      return row.scenario_type;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};
const headerStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const controlRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.6rem 0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};
const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
};
const selectStyle: CSSProperties = {
  padding: '0.3rem 0.45rem',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.3rem',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
};
const primaryBtnStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '0.45rem 0.95rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const infoStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
  padding: '0.5rem 0.85rem',
};
const errorStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.4rem 0.6rem',
};
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const itemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  padding: '0.55rem 0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
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
const itemBtnRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.45rem',
};
const smallBtnStyle: CSSProperties = {
  padding: '0.35rem 0.7rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const smallBtnDangerStyle: CSSProperties = {
  padding: '0.35rem 0.7rem',
  background: '#fff',
  color: '#7A2A26',
  border: `1px solid #C25855`,
  borderRadius: '0.3rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
