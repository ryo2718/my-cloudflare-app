// 中級トレーニングの振り返り画面。
//
// 表示:
//   - 問題画面と同じ PokerTable + ハンド + 4 アクションの GTO 戦略 (%)
//   - ユーザーが選んだアクションには ☑、選ばなかったものは ☐
//   - 獲得点 (rawScore, finalScore, theoreticalMax)
//   - 時間切れマーク
//   - [前/次] ナビゲーション (finalScore < 2 の問題のみが対象)

import type { CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { loadIntermediateRecords } from '../../data/training/recordsStore';
import type { IntermediateRecord } from '../../data/training/recordsStore';
import {
  trainingPath,
  trainingReviewPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import {
  ACTIONS,
  type VsOpenBbStrategies,
} from '../../data/training/preflopIntermediate';
import { ACTION_LABEL } from './IntermediateChoices';
import { CardSet } from '../CardSet';
import { HandRangeMatrix } from './HandRangeMatrix';
import { THEME } from '../../styles/theme';
import { PokerTable } from './PokerTable';
import type { Suit, Rank } from '../../types/card';
import type { Position } from '../../types/strategy';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import { useEffect, useState } from 'react';

export interface TrainingReviewIntermediateProps {
  level: TrainingLevel;
  index: number;
}

function buildResultPath(
  levelKey: string,
  records: ReadonlyArray<IntermediateRecord> | null,
): string {
  const base = trainingPath(levelKey, 'result');
  if (!records || records.length === 0) return base;
  const score = records.reduce((sum, r) => sum + r.finalScore, 0);
  const total = records.length * 2;
  const sp = new URLSearchParams({
    score: String(score),
    total: String(total),
    mode: 'intermediate',
  });
  return `${base}?${sp.toString()}`;
}

export function TrainingReviewIntermediate({ level, index }: TrainingReviewIntermediateProps) {
  const records = loadIntermediateRecords(level.key);
  // 中級は全 20 問を振り返り対象とする (満点問題もタップで詳細表示)。
  const allRecords = records ?? [];
  const resultPath = buildResultPath(level.key, records);

  const i = index - 1;
  const current = allRecords[i];

  if (!current) {
    return (
      <div style={pageStyle}>
        <main style={mainStyle}>
          <p style={notFoundStyle}>振り返り対象の記録が見つかりません。</p>
          <button type="button" onClick={() => navigate(resultPath)} style={primaryBtnStyle}>
            結果画面へ
          </button>
        </main>
      </div>
    );
  }

  const total = allRecords.length;
  const hasPrev = i > 0;
  const hasNext = i < total - 1;
  const goPrev = () => hasPrev && navigate(trainingReviewPath(level.key, index - 1));
  const goNext = () => hasNext && navigate(trainingReviewPath(level.key, index + 1));

  const scoreColor =
    current.finalScore < 0 ? '#7A2A26'
      : current.finalScore === 0 ? '#5F5E5A'
      : current.finalScore === 1 ? '#6B5A48'
      : '#1F4D11';

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        <Link to={resultPath} style={crumbStyle}>← 結果に戻る</Link>

        <div style={progressRowStyle}>
          <span style={progressLabelStyle}>振り返り</span>
          <span style={progressCountStyle}>{index} / {total}</span>
        </div>

        <div style={scenarioPillStyle}>vs {current.opener} open</div>

        <PokerTable
          mePosition="BB"
          opener={current.opener}
          foldedSet={current.foldedBefore}
        />

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>ハンド</span>
          <CardSet
            cards={current.cards.map((c) => ({
              rank: c.rank as Rank,
              suit: c.suit as Suit,
            }))}
            size="lg"
            gap={6}
          />
        </section>

        <section style={strategyTableStyle} aria-label="GTO 戦略">
          <header style={strategyHeaderStyle}>あなたの選択 / GTO 戦略</header>
          <ul style={strategyListStyle}>
            {ACTIONS.map((a) => {
              const freq = current.strategySnapshot[a] ?? 0;
              const picked = current.selections.includes(a);
              return (
                <li key={a} style={strategyRowStyle}>
                  <span style={pickBoxStyle}>{picked ? '☑' : '☐'}</span>
                  <span style={actionNameStyle}>{ACTION_LABEL[a]}</span>
                  <span style={freqStyle}>{formatFreq(freq)}%</span>
                </li>
              );
            })}
          </ul>
        </section>

        <div style={scoreSummaryStyle}>
          <span style={scoreSummaryLabelStyle}>獲得点</span>
          <span style={{ ...scoreSummaryValueStyle, color: scoreColor }}>
            {current.finalScore >= 0 ? `+${current.finalScore}` : current.finalScore}pt
          </span>
          {current.timedOut && <span style={timeoutBadgeStyle}>⏱ 時間切れ</span>}
        </div>

        <RangeSection opener={current.opener} highlightHand={current.hand} />

        <nav style={navRowStyle}>
          <button
            type="button"
            onClick={goPrev}
            disabled={!hasPrev}
            style={hasPrev ? navBtnStyle : navBtnDisabledStyle}
          >
            ← 前の問題
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!hasNext}
            style={hasNext ? navBtnStyle : navBtnDisabledStyle}
          >
            次の問題 →
          </button>
        </nav>
      </main>
    </div>
  );
}

/**
 * 該当 opener の vs_open_bb レンジを fetch して 13x13 マトリクスを表示。
 * 取得失敗時は何も描画しない (UX 上は致命的でないので silent fallback)。
 */
function RangeSection({
  opener,
  highlightHand,
}: {
  opener: Position;
  highlightHand: string;
}) {
  const [hands, setHands] = useState<Record<string, HandStrategy> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOpenerVsBbHands(opener)
      .then((h) => {
        if (cancelled) return;
        setHands(h);
      })
      .catch(() => {
        // silent: 取得失敗時はマトリクスを描画しない
      });
    return () => {
      cancelled = true;
    };
  }, [opener]);

  if (!hands) return null;
  return (
    <section style={rangeSectionStyle} aria-label="このシナリオのレンジ">
      <HandRangeMatrix
        hands={hands}
        highlightHand={highlightHand}
        caption={`vs ${opener} open の BB 応答レンジ`}
      />
    </section>
  );
}

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';
const vsBbCache: VsOpenBbStrategies = {};

async function fetchOpenerVsBbHands(opener: Position): Promise<Record<string, HandStrategy>> {
  if (vsBbCache[opener]) return vsBbCache[opener]!;
  const url = `${PREFLOP_DATA_ROOT}/${opener.toLowerCase()}r_bb.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
  const raw = (await res.json()) as { hands: Record<string, HandStrategy> };
  vsBbCache[opener] = raw.hands;
  return raw.hands;
}

function formatFreq(pct: number): string {
  // 0-100 (例: 5.5) → 整数化 (5.5% は許容、それ以外は四捨五入)
  if (Math.abs(pct - Math.round(pct)) < 0.01) return String(Math.round(pct));
  return pct.toFixed(1);
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
  padding: '1rem',
  maxWidth: 520,
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
};
const crumbStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textSecondary,
  textDecoration: 'none',
};
const progressRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
};
const progressLabelStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const progressCountStyle: CSSProperties = {
  fontSize: '0.95rem',
  color: THEME.textSecondary,
  fontVariantNumeric: 'tabular-nums',
};
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#993C1D',
  background: '#FAEEDA',
  border: '1px solid #E5A551',
  borderRadius: '999px',
  padding: '0.2rem 0.7rem',
};
const handSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.4rem',
};
const handLabelStyle: CSSProperties = {
  fontSize: '0.72rem',
  color: THEME.textSecondary,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const strategyTableStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};
const strategyHeaderStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: THEME.textSecondary,
  letterSpacing: '0.04em',
};
const strategyListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};
const strategyRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr auto',
  alignItems: 'center',
  gap: '0.55rem',
  fontSize: '0.9rem',
  color: THEME.textPrimary,
};
const pickBoxStyle: CSSProperties = {
  fontSize: '1rem',
  color: '#993C1D',
  textAlign: 'center',
};
const actionNameStyle: CSSProperties = {
  fontWeight: 600,
};
const freqStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 600,
  color: THEME.textPrimary,
};
const scoreSummaryStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.55rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
};
const scoreSummaryLabelStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: THEME.textSecondary,
  fontWeight: 600,
};
const scoreSummaryValueStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  fontVariantNumeric: 'tabular-nums',
};
const rangeSectionStyle: CSSProperties = {
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.45rem',
  padding: '0.7rem 0.85rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};
const timeoutBadgeStyle: CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#b91c1c',
};
const navRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.6rem',
  marginTop: 'auto',
};
const navBtnStyle: CSSProperties = {
  padding: '0.6rem 0.9rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.92rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const navBtnDisabledStyle: CSSProperties = {
  ...navBtnStyle,
  color: THEME.textFaint,
  cursor: 'not-allowed',
  opacity: 0.55,
};
const notFoundStyle: CSSProperties = {
  margin: 'auto',
  textAlign: 'center',
  color: THEME.textSecondary,
};
const primaryBtnStyle: CSSProperties = {
  margin: '0 auto',
  padding: '0.55rem 1rem',
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.4rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
