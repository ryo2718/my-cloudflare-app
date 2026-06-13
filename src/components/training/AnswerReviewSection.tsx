// 結果画面の汎用「答え一覧」セクション。
//   ○/✕ 判定 + シナリオ pill + ハンドのカード画像 + あなた/正解 + [問題へ]。
//   AnswerReviewRecord[] を保存した全モードで共通利用する (初級基礎の振り返りカードと同じ作り)。

import type { CSSProperties } from 'react';
import type { AnswerReviewRecord } from '../../data/training/answerReviewStore';
import { handToCards } from '../../data/training/preflopBeginner';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import type { Suit, Rank } from '../../types/card';

export interface AnswerReviewSectionProps {
  records: ReadonlyArray<AnswerReviewRecord>;
  /** 各問の [問題へ] 押下 (record.id = 1-indexed)。 */
  onReview: (id: number) => void;
}

export function AnswerReviewSection({ records, onReview }: AnswerReviewSectionProps) {
  if (records.length === 0) return null;
  return (
    <section style={sectionStyle} aria-label="答え一覧">
      <header style={headerStyle}>答え一覧 ({records.length}問)</header>
      <ul style={listStyle}>
        {records.map((rec) => (
          <li key={rec.id} style={{ listStyle: 'none' }}>
            <AnswerReviewCard record={rec} onReview={() => onReview(rec.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnswerReviewCard({ record, onReview }: { record: AnswerReviewRecord; onReview: () => void }) {
  const icon = record.correct ? '○' : '✕';
  const color = record.correct ? '#3B6D11' : '#A32D2D';
  const cards = handToCards(record.hand);
  return (
    <div style={cardStyle}>
      <span style={{ ...iconBadgeStyle, color }} aria-label={`判定: ${icon}`}>
        {icon}
      </span>
      <div style={cardLeftStyle}>
        <span style={scenarioStyle}>{record.scenario}</span>
        <CardSet
          cards={cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
          size="md"
          gap={4}
        />
        <div style={answerLineStyle}>
          あなた: <span style={userStyle}>{record.userText}</span>
          {' | '}
          正解: <span style={correctStyle}>{record.correctText}</span>
        </div>
      </div>
      <button type="button" onClick={onReview} style={reviewBtnStyle}>
        問題へ
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles (TrainingResult の missed カードと同じ見た目)
// ---------------------------------------------------------------------------

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const headerStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 700, color: THEME.textSecondary };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' };
const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.7rem',
  padding: '0.7rem 0.85rem',
  background: '#fff',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
};
const iconBadgeStyle: CSSProperties = { fontSize: '1.3rem', fontWeight: 900, minWidth: '1.4rem', textAlign: 'center' };
const cardLeftStyle: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' };
const scenarioStyle: CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: '#993C1D' };
const answerLineStyle: CSSProperties = { fontSize: '0.82rem', color: THEME.textSecondary };
const userStyle: CSSProperties = { fontWeight: 700, color: THEME.textPrimary };
const correctStyle: CSSProperties = { fontWeight: 700, color: '#3B6D11' };
const reviewBtnStyle: CSSProperties = {
  padding: '0.45rem 0.8rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
