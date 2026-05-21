// QuizPage 下部の「間違えた問題」セクション。
// 「プリフロップトレーニング」配下に初級 / 中級 / 上級 (未実装) をネスト。
// 将来「単語トレーニング」等のカテゴリを並列で追加できる構造。
// タップで /quiz/review/preflop/{level} へ遷移。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiGetMissedProblems } from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

type CountKey = 'beginner' | 'intermediate' | 'ep' | 'lp' | 'blind';
type Counts = Partial<Record<CountKey, number | null>>;

interface LevelEntry {
  key: CountKey | 'advanced';
  label: string;
  href: string | null;
  implemented: boolean;
}

const PREFLOP_LEVELS: LevelEntry[] = [
  { key: 'beginner',     label: '初級',      href: '/quiz/review/preflop/beginner',     implemented: true },
  { key: 'intermediate', label: '中級 総合', href: '/quiz/review/preflop/intermediate', implemented: true },
  { key: 'ep',           label: '中級 EP',   href: '/quiz/review/preflop/ep',           implemented: true },
  { key: 'lp',           label: '中級 LP',   href: '/quiz/review/preflop/lp',           implemented: true },
  { key: 'blind',        label: '中級 Blind', href: '/quiz/review/preflop/blind',       implemented: true },
  { key: 'advanced',     label: '上級',      href: null,                                implemented: false },
];

const COUNT_KEYS: ReadonlyArray<CountKey> = ['beginner', 'intermediate', 'ep', 'lp', 'blind'];

export function MissedProblemsSection() {
  const auth = useAuth();
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    Promise.all(COUNT_KEYS.map((k) => apiGetMissedProblems(sid, { level: k, limit: 1000 })))
      .then((results) => {
        if (cancelled) return;
        const next: Counts = {};
        COUNT_KEYS.forEach((k, i) => {
          next[k] = results[i].length;
        });
        setCounts(next);
      })
      .catch(() => {
        /* silent fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  return (
    <section style={sectionStyle} aria-label="間違えた問題">
      <header style={headerStyle}>間違えた問題</header>

      <div style={categoryStyle} aria-label="プリフロップトレーニング">
        <header style={categoryHeaderStyle}>プリフロップトレーニング</header>
        <div style={cardsStyle}>
          {PREFLOP_LEVELS.map((lv) => (
            <LevelCard
              key={lv.key}
              entry={lv}
              count={lv.key === 'advanced' ? null : counts[lv.key] ?? null}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function LevelCard({ entry, count }: { entry: LevelEntry; count: number | null }) {
  if (!entry.implemented) {
    return (
      <div style={disabledCardStyle}>
        <span style={cardLabelStyle}>{entry.label}</span>
        <span style={emptyHintStyle}>未実装</span>
      </div>
    );
  }
  if (count === 0) {
    return (
      <div style={emptyCardStyle}>
        <span style={cardLabelStyle}>{entry.label}</span>
        <span style={emptyHintStyle}>(間違えた問題なし)</span>
      </div>
    );
  }
  return (
    <Link to={entry.href ?? '/quiz'} style={cardStyle}>
      <span style={cardLabelStyle}>{entry.label}</span>
      <span style={cardRightStyle}>
        {count !== null && <span style={countStyle}>{count}件</span>}
        <span style={chevronStyle} aria-hidden>▶</span>
      </span>
    </Link>
  );
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
const categoryStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
};
const categoryHeaderStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#993C1D',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #993C1D',
};
const cardsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.7rem',
  padding: '0.85rem 1rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  textDecoration: 'none',
};
const emptyCardStyle: CSSProperties = {
  ...cardStyle,
  background: '#f5f1ea',
  opacity: 0.85,
  cursor: 'default',
};
const disabledCardStyle: CSSProperties = {
  ...cardStyle,
  background: '#f5f1ea',
  borderStyle: 'dashed',
  opacity: 0.7,
  cursor: 'default',
};
const cardLabelStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: THEME.accent,
};
const cardRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
};
const countStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  fontVariantNumeric: 'tabular-nums',
};
const chevronStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textMuted,
};
const emptyHintStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
};
