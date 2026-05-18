// QuizPage 下部の「間違えた問題から復習」セクション。
// 初級 / 中級 の 2 カードのみ。 タップで /quiz/review/{level} へ遷移。

import { useEffect, useState, type CSSProperties } from 'react';
import { apiGetMissedProblems } from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

type Counts = {
  beginner: number | null;
  intermediate: number | null;
};

const CARDS = [
  { key: 'beginner', label: '初級', href: '/quiz/review/beginner' },
  { key: 'intermediate', label: '中級', href: '/quiz/review/intermediate' },
] as const;

export function MissedProblemsSection() {
  const auth = useAuth();
  const [counts, setCounts] = useState<Counts>({ beginner: null, intermediate: null });

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    Promise.all([
      apiGetMissedProblems(sid, { level: 'beginner', limit: 1000 }),
      apiGetMissedProblems(sid, { level: 'intermediate', limit: 1000 }),
    ])
      .then(([b, i]) => {
        if (!cancelled) setCounts({ beginner: b.length, intermediate: i.length });
      })
      .catch(() => {
        /* silent fallback */
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  return (
    <section style={sectionStyle} aria-label="間違えた問題から復習">
      <header style={headerStyle}>間違えた問題から復習</header>
      {CARDS.map((c) => (
        <Card
          key={c.key}
          label={c.label}
          href={c.href}
          count={counts[c.key]}
        />
      ))}
    </section>
  );
}

function Card({
  label,
  href,
  count,
}: {
  label: string;
  href: string;
  count: number | null;
}) {
  if (count === 0) {
    return (
      <div style={emptyCardStyle}>
        <span style={cardLabelStyle}>{label}</span>
        <span style={emptyHintStyle}>(間違えた問題なし)</span>
      </div>
    );
  }
  return (
    <Link to={href} style={cardStyle}>
      <span style={cardLabelStyle}>{label}</span>
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
