// QuizPage 下部の「間違えた問題」セクション。
// 「プリフロップトレーニング」「ポストフロップトレーニング」をカテゴリ別に折りたたみ表示。
// 各カテゴリ配下にモード一覧をネスト。タップで /quiz/review/preflop/{level} へ遷移。
// ※ ポストフロップは現状「間違えた問題」の収集が無いため件数は 0 固定 (集計は後続対応)。

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { apiGetMissedProblems, type MissedLevelQuery } from '../../api/missedProblems';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../router/router';
import { THEME } from '../../styles/theme';

type Counts = Record<string, number | null>;

interface LevelEntry {
  key: string;
  label: string;
  href: string | null;
  implemented: boolean;
  /** 件数取得用の level クエリ。未指定なら集計対象外 (件数 0 固定)。 */
  level?: MissedLevelQuery;
}

const PREFLOP_LEVELS: LevelEntry[] = [
  { key: 'beginner',     label: '初級',      href: '/quiz/review/preflop/beginner',     implemented: true, level: 'beginner' },
  { key: 'intermediate', label: '中級 総合', href: '/quiz/review/preflop/intermediate', implemented: true, level: 'intermediate' },
  { key: 'ep',           label: '中級 EP',   href: '/quiz/review/preflop/ep',           implemented: true, level: 'ep' },
  { key: 'lp',           label: '中級 LP',   href: '/quiz/review/preflop/lp',           implemented: true, level: 'lp' },
  { key: 'blind',        label: '中級 Blind', href: '/quiz/review/preflop/blind',       implemented: true, level: 'blind' },
  { key: 'advanced',     label: '上級',      href: null,                                implemented: false },
];

// ポストフロップ (初級 + レンジCB / レンジドンク・BMCB)。level=training_type で件数取得。
const POSTFLOP_LEVELS: LevelEntry[] = [
  { key: 'flop_beginner',  label: '初級',                 href: '/quiz/review/flop/flop_beginner',  implemented: true, level: 'flop_beginner' },
  { key: 'flop_cb_srp',    label: 'レンジCB SRP',         href: '/quiz/review/flop/flop_cb_srp',    implemented: true, level: 'flop_cb_srp' },
  { key: 'flop_cb_3bp',    label: 'レンジCB 3BP/4BP/5BP', href: '/quiz/review/flop/flop_cb_3bp',    implemented: true, level: 'flop_cb_3bp' },
  { key: 'flop_donk_bmcb', label: 'レンジドンク/BMCB',    href: '/quiz/review/flop/flop_donk_bmcb',  implemented: true, level: 'flop_donk_bmcb' },
];

// 件数取得対象 (level を持つ全モード)。
const FETCH_LEVELS: ReadonlyArray<MissedLevelQuery> = [
  ...PREFLOP_LEVELS.map((l) => l.level).filter((l): l is MissedLevelQuery => !!l),
  ...POSTFLOP_LEVELS.map((l) => l.level).filter((l): l is MissedLevelQuery => !!l),
];

export function MissedProblemsSection() {
  const auth = useAuth();
  const [counts, setCounts] = useState<Counts>({});
  const [openPreflop, setOpenPreflop] = useState(true);
  const [openPostflop, setOpenPostflop] = useState(true);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    Promise.all(FETCH_LEVELS.map((k) => apiGetMissedProblems(sid, { level: k, limit: 1000 })))
      .then((results) => {
        if (cancelled) return;
        const next: Counts = {};
        FETCH_LEVELS.forEach((k, i) => {
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

  const countFor = (entry: LevelEntry): number | null => {
    if (!entry.implemented) return null;
    if (!entry.level) return 0;
    return counts[entry.level] ?? null;
  };

  return (
    <section style={sectionStyle} aria-label="間違えた問題">
      <header style={headerStyle}>間違えた問題</header>

      <CategoryBlock
        title="プリフロップトレーニング"
        open={openPreflop}
        onToggle={() => setOpenPreflop((v) => !v)}
      >
        {PREFLOP_LEVELS.map((lv) => (
          <LevelCard key={lv.key} entry={lv} count={countFor(lv)} />
        ))}
      </CategoryBlock>

      <CategoryBlock
        title="ポストフロップトレーニング"
        open={openPostflop}
        onToggle={() => setOpenPostflop((v) => !v)}
      >
        {POSTFLOP_LEVELS.map((lv) => (
          <LevelCard key={lv.key} entry={lv} count={countFor(lv)} />
        ))}
      </CategoryBlock>
    </section>
  );
}

function CategoryBlock({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div style={categoryStyle} aria-label={title}>
      <button type="button" style={categoryToggleStyle} onClick={onToggle} aria-expanded={open}>
        <span style={categoryHeaderStyle}>{title}</span>
        <span style={categoryChevronStyle} aria-hidden>{open ? '▼' : '▶'}</span>
      </button>
      {open && <div style={cardsStyle}>{children}</div>}
    </div>
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
const categoryToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};
const categoryHeaderStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#993C1D',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #993C1D',
};
const categoryChevronStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textMuted,
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
