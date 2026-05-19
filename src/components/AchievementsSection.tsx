// アカウント画面の「実績」セクション。 4 ティアの 2x2 カードグリッド。
// タップで /account/achievements/{tier} へ遷移。

import { type CSSProperties } from 'react';
import { Link } from '../router/router';
import { TIERS, ACHIEVEMENTS, type Tier } from '../data/achievements';

interface Props {
  unlocked: ReadonlyArray<string>;
}

export function AchievementsSection({ unlocked }: Props) {
  const unlockedSet = new Set(unlocked);
  return (
    <section style={sectionStyle} aria-label="実績">
      <header style={headerStyle}>実績</header>
      <div style={gridStyle}>
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} unlocked={unlockedSet} />
        ))}
      </div>
    </section>
  );
}

function TierCard({ tier, unlocked }: { tier: Tier; unlocked: Set<string> }) {
  const tierAch = ACHIEVEMENTS.filter((a) => a.tier === tier.id);
  const got = tierAch.filter((a) => unlocked.has(a.id)).length;
  const total = tierAch.length;
  return (
    <Link
      to={`/account/achievements/${tier.id}`}
      style={{ ...cardStyle, background: tier.bg, borderColor: tier.border }}
    >
      {tier.star && (
        <span style={starStyle} aria-hidden>★</span>
      )}
      <img src={tier.image} alt="" style={imgStyle} loading="lazy" />
      <span style={{ ...labelStyle, color: tier.textColor }}>{tier.label}</span>
      <span style={{ ...sublabelStyle, color: tier.textColor }}>{tier.sublabel}</span>
      <span style={{ ...countStyle, color: tier.textColor }}>
        {got} / {total}
      </span>
    </Link>
  );
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
  marginTop: '0.5rem',
};
const headerStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: '#5F5E5A',
  letterSpacing: '0.04em',
};
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.65rem',
};
const cardStyle: CSSProperties = {
  position: 'relative',
  border: '2px solid',
  borderRadius: '0.55rem',
  padding: '0.6rem 0.5rem 0.7rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.2rem',
  textDecoration: 'none',
};
const imgStyle: CSSProperties = {
  width: 72,
  height: 72,
  objectFit: 'contain',
};
const labelStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 800,
  letterSpacing: '0.05em',
};
const sublabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  opacity: 0.85,
};
const countStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  marginTop: '0.15rem',
};
const starStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 8,
  fontSize: '0.95rem',
  color: '#FAC775',
};
