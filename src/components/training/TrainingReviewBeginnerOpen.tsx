// /training/preflop-beginner-open/review/{n}: 初級オープンの振り返り画面。
//
// 初級基礎 (TrainingReview) と同じ体験:
//   - 問題画面と同じ ActionTable + ハンド表示
//   - 正解レイズ% / あなたの回答% を ○(正解) / ✕(不正解) 判定付きで表示
//   - [前の問題] [次の問題] で全 20 問をナビゲート (ループしない)
//   - [← 結果に戻る] で result に戻る
//
// データ取得: beginnerOpenRecordsStore (in-mem + sessionStorage)。記録なし / 範囲外は
// result にリダイレクト。初級基礎は missed のみだが、オープンは答え一覧と同じく全問を辿る。

import type { CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import {
  loadBeginnerOpenRecords,
  type BeginnerOpenRecord,
} from '../../data/training/beginnerOpenRecordsStore';
import { handToCards } from '../../data/training/preflopBeginner';
import {
  trainingPath,
  trainingReviewPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { ActionTable } from './ActionTable';
import { NodeRangeSection } from './NodeRangeSection';
import type { Suit, Rank } from '../../types/card';

export interface TrainingReviewBeginnerOpenProps {
  level: TrainingLevel;
  /** 全問内の 1-indexed 位置 (URL から)。 */
  index: number;
}

/** ?score=N&total=M を付けた result パス (records から再計算)。 */
function buildResultPath(
  levelKey: string,
  records: ReadonlyArray<BeginnerOpenRecord> | null,
): string {
  const base = trainingPath(levelKey, 'result');
  if (!records || records.length === 0) return base;
  const score = records.filter((r) => r.points > 0).length;
  const sp = new URLSearchParams({ score: String(score), total: String(records.length) });
  return `${base}?${sp.toString()}`;
}

export function TrainingReviewBeginnerOpen({ level, index }: TrainingReviewBeginnerOpenProps) {
  const records = loadBeginnerOpenRecords(level.key);
  const resultPath = buildResultPath(level.key, records);

  const i = index - 1;
  const current = records?.[i];

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

  const total = records!.length;
  const hasPrev = i > 0;
  const hasNext = i < total - 1;
  const goPrev = () => {
    if (hasPrev) navigate(trainingReviewPath(level.key, index - 1));
  };
  const goNext = () => {
    if (hasNext) navigate(trainingReviewPath(level.key, index + 1));
  };

  const nodeFile = `${current.position.toLowerCase()}.json`;
  const correct = current.points > 0;
  const color = correct ? '#1F4D11' : '#7A2A26';
  const answerText = current.answerPct === null ? '—' : `${current.answerPct}%`;
  const cards = handToCards(current.hand);

  return (
    <div style={pageStyle}>
      <main style={mainStyle}>
        <Link to={resultPath} style={crumbStyle}>
          ← 結果に戻る
        </Link>

        <div style={progressRowStyle}>
          <span style={progressLabelStyle}>振り返り</span>
          <span style={progressCountStyle}>
            {index} / {total}
          </span>
        </div>

        <div style={scenarioPillStyle}>{current.position} オープン</div>

        <ActionTable file={nodeFile} mePosition={current.position} />

        <section style={handSectionStyle}>
          <span style={handLabelStyle}>ハンド</span>
          <CardSet
            cards={cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
            size="lg"
            gap={6}
          />
        </section>

        <section style={{ ...answerPanelStyle, ...(correct ? correctPanelStyle : incorrectPanelStyle) }}>
          <span style={{ ...markStyle, color }} aria-label={correct ? '正解' : '不正解'}>
            {correct ? '○' : '✕'}
          </span>
          <div style={answerLinesStyle}>
            <div style={answerLineStyle}>
              正解(レイズ): <span style={{ ...answerValStyle, color }}>{current.raisePct}%</span>
            </div>
            <div style={answerLineStyle}>
              あなた: <span style={answerValStyle}>{answerText}</span>
            </div>
          </div>
        </section>

        <NodeRangeSection file={nodeFile} highlightHand={current.hand} />

        <nav style={navRowStyle}>
          <button type="button" onClick={goPrev} disabled={!hasPrev} style={hasPrev ? navBtnStyle : navBtnDisabledStyle}>
            ← 前の問題
          </button>
          <button type="button" onClick={goNext} disabled={!hasNext} style={hasNext ? navBtnStyle : navBtnDisabledStyle}>
            次の問題 →
          </button>
        </nav>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingReview と統一)
// ---------------------------------------------------------------------------

const pageStyle: CSSProperties = { minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column' };
const mainStyle: CSSProperties = {
  flex: 1, padding: '1rem', maxWidth: 520, width: '100%', margin: '0 auto',
  display: 'flex', flexDirection: 'column', gap: '0.9rem',
};
const crumbStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textSecondary, textDecoration: 'none' };
const progressRowStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' };
const progressLabelStyle: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, color: THEME.textPrimary };
const progressCountStyle: CSSProperties = { fontSize: '0.95rem', color: THEME.textSecondary, fontVariantNumeric: 'tabular-nums' };
const scenarioPillStyle: CSSProperties = {
  alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 700, color: '#993C1D',
  background: '#FAEEDA', border: '1px solid #E5A551', borderRadius: '999px', padding: '0.2rem 0.7rem',
};
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' };
const handLabelStyle: CSSProperties = {
  fontSize: '0.72rem', color: THEME.textSecondary, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
};
const answerPanelStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.7rem',
  padding: '0.85rem 1rem', borderRadius: '0.45rem',
};
const correctPanelStyle: CSSProperties = { background: '#E5F5DC', border: '2px solid #6B9C3C' };
const incorrectPanelStyle: CSSProperties = { background: '#F7E3E2', border: '2px solid #C25855' };
const markStyle: CSSProperties = { fontSize: '1.6rem', fontWeight: 900 };
const answerLinesStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem' };
const answerLineStyle: CSSProperties = { fontSize: '0.95rem', color: THEME.textPrimary };
const answerValStyle: CSSProperties = { fontWeight: 800, fontVariantNumeric: 'tabular-nums' };
const navRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: 'auto' };
const navBtnStyle: CSSProperties = {
  padding: '0.6rem 0.9rem', background: '#fff', color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`, borderRadius: '0.4rem', fontSize: '0.92rem', fontFamily: 'inherit', cursor: 'pointer',
};
const navBtnDisabledStyle: CSSProperties = { ...navBtnStyle, color: THEME.textFaint, cursor: 'not-allowed', opacity: 0.55 };
const notFoundStyle: CSSProperties = { margin: 'auto', textAlign: 'center', color: THEME.textSecondary };
const primaryBtnStyle: CSSProperties = {
  margin: '0 auto', padding: '0.55rem 1rem', background: THEME.accent, color: '#fff',
  border: 'none', borderRadius: '0.4rem', fontFamily: 'inherit', cursor: 'pointer',
};
