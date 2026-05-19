// /account/achievements/{tier}: ティア詳細画面。
// 各実績の ☑ / ☐ 表示と説明、 末尾に他ティアへのリンク。

import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from '../router/router';
import { useAuth } from '../hooks/useAuth';
import { apiAccountAchievements } from '../api/account';
import {
  ACHIEVEMENTS,
  TIERS,
  tierById,
  type TierId,
  type Tier,
} from '../data/achievements';
import { AppHeader } from './AppHeader';
import { THEME } from '../styles/theme';

interface Props {
  tier: TierId;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; unlocked: Set<string> };

export function AchievementTierPage({ tier }: Props) {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const tierData = tierById(tier);

  useEffect(() => {
    if (!auth.sessionId) return;
    const sid = auth.sessionId;
    let cancelled = false;
    apiAccountAchievements(sid)
      .then((res) => {
        if (!cancelled) setState({ kind: 'ok', unlocked: new Set(res.unlocked) });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [auth.sessionId]);

  if (!tierData) {
    return (
      <div style={pageStyle}>
        <AppHeader showBack />
        <main style={mainStyle}>
          <div style={errorStyle}>未知のティアです: {tier}</div>
        </main>
      </div>
    );
  }

  if (!tierData.implemented) {
    return (
      <div style={pageStyle}>
        <AppHeader showBack />
        <main style={mainStyle}>
          <Link to="/account" style={crumbStyle}>← アカウントに戻る</Link>
          <div
            style={{
              ...heroStyle,
              background: '#f5f1ea',
              borderColor: '#D6CFC1',
              borderStyle: 'dashed',
              color: '#5F5E5A',
            }}
          >
            <img src={tierData.image} alt="" style={{ ...heroImgStyle, filter: 'grayscale(0.6)', opacity: 0.75 }} loading="lazy" />
            <div style={heroTextStyle}>
              <span style={{ ...heroLabelStyle, color: '#5F5E5A' }}>
                {tierData.label}
              </span>
            </div>
            <span style={{ ...heroSubStyle, color: '#888780' }}>未実装</span>
          </div>
          <div style={notImplementedNoteStyle}>
            このランクは現在準備中です。
          </div>
          <OtherTiers current={tier} />
        </main>
      </div>
    );
  }

  const tierAch = ACHIEVEMENTS.filter((a) => a.tier === tier);
  const unlockedSet =
    state.kind === 'ok' ? state.unlocked : new Set<string>();
  const got = tierAch.filter((a) => unlockedSet.has(a.id)).length;

  return (
    <div style={pageStyle}>
      <AppHeader showBack />
      <main style={mainStyle}>
        <Link to="/account" style={crumbStyle}>← アカウントに戻る</Link>

        <div
          style={{
            ...heroStyle,
            background: tierData.bg,
            borderColor: tierData.border,
            color: tierData.textColor,
          }}
        >
          {tierData.star && <span style={starStyle} aria-hidden>★</span>}
          <img src={tierData.image} alt="" style={heroImgStyle} loading="lazy" />
          <div style={heroTextStyle}>
            <span style={{ ...heroLabelStyle, color: tierData.textColor }}>
              {tierData.label}
            </span>
          </div>
          <span style={{ ...heroCountStyle, color: tierData.textColor }}>
            {got} / {tierAch.length} 達成
          </span>
        </div>

        {state.kind === 'loading' && <div style={infoStyle}>読み込み中…</div>}
        {state.kind === 'error' && (
          <div style={errorStyle}>取得失敗: {state.message}</div>
        )}

        <ul style={listStyle}>
          {tierAch.map((a) => {
            const ok = unlockedSet.has(a.id);
            return (
              <li key={a.id} style={itemStyle}>
                <span
                  style={ok ? checkStyleOk : checkStyleNo}
                  aria-label={ok ? '達成' : '未達成'}
                >
                  {ok ? '☑' : '☐'}
                </span>
                <div style={itemTextStyle}>
                  <span style={ok ? nameStyleOk : nameStyleNo}>{a.name}</span>
                  <span style={descStyle}>{a.desc}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <OtherTiers current={tier} />
      </main>
    </div>
  );
}

function OtherTiers({ current }: { current: TierId }) {
  const others = TIERS.filter((t) => t.id !== current);
  return (
    <section style={otherSectionStyle} aria-label="他の実績">
      <header style={otherHeaderStyle}>他の実績</header>
      <div style={otherGridStyle}>
        {others.map((t: Tier) => {
          if (!t.implemented) {
            return (
              <div
                key={t.id}
                style={{ ...otherCardDisabledStyle }}
                aria-label={`${t.label} (未実装)`}
              >
                <img
                  src={t.image}
                  alt=""
                  style={{ ...otherImgStyle, filter: 'grayscale(0.6)', opacity: 0.75 }}
                  loading="lazy"
                />
                <span style={otherLabelDisabledStyle}>{t.label}</span>
              </div>
            );
          }
          return (
            <Link
              key={t.id}
              to={`/account/achievements/${t.id}`}
              style={{ ...otherCardStyle, background: t.bg, borderColor: t.border }}
            >
              <img src={t.image} alt="" style={otherImgStyle} loading="lazy" />
              <span style={{ ...otherLabelStyle, color: t.textColor }}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

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
  gap: '0.85rem',
};
const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};
const heroStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.35rem',
  border: '2px solid',
  borderRadius: '0.6rem',
  padding: '1rem 0.8rem 1.1rem',
};
const heroImgStyle: CSSProperties = { width: 110, height: 110, objectFit: 'contain' };
const heroTextStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.4rem',
};
const heroLabelStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
};
const heroSubStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
};
const heroCountStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
};
const starStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 10,
  fontSize: '1.1rem',
  color: '#FAC775',
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
  gap: '0.6rem',
  alignItems: 'flex-start',
  padding: '0.65rem 0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
};
const checkStyleOk: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 800,
  color: '#3B6D11',
  lineHeight: 1.1,
};
const checkStyleNo: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 800,
  color: THEME.textFaint,
  lineHeight: 1.1,
};
const itemTextStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
};
const nameStyleOk: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const nameStyleNo: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textSecondary,
};
const descStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
};
const infoStyle: CSSProperties = {
  color: THEME.textMuted,
  fontSize: '0.85rem',
};
const errorStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.errorText,
  background: THEME.errorBg,
  border: `1px solid ${THEME.errorBorder}`,
  borderRadius: '0.3rem',
  padding: '0.45rem 0.7rem',
};
const otherSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  marginTop: '0.6rem',
  paddingTop: '0.7rem',
  borderTop: `1px solid ${THEME.border}`,
};
const otherHeaderStyle: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 700,
  color: THEME.textSecondary,
};
const otherGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.55rem',
};
const otherCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.15rem',
  padding: '0.45rem 0.4rem',
  border: '2px solid',
  borderRadius: '0.4rem',
  textDecoration: 'none',
};
const otherImgStyle: CSSProperties = { width: 44, height: 44, objectFit: 'contain' };
const otherLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
};
const otherCardDisabledStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.15rem',
  padding: '0.45rem 0.4rem',
  border: `1px dashed ${THEME.border}`,
  borderRadius: '0.4rem',
  background: '#f5f1ea',
  opacity: 0.7,
};
const otherLabelDisabledStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  color: THEME.textMuted,
};
const notImplementedNoteStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: THEME.textSecondary,
  textAlign: 'center',
};
