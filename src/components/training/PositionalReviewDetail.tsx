// 中級ポジション別の「各問詳細」表示 (結果画面の展開 / 答え合わせ画面で共有)。
//   - PokerTable + ハンド
//   - GTO 戦略 (頻度) + あなたの回答 (複数選択 or スライダー)
//   - 判定アイコン
//   - レンジ表 (該当ノードを遅延ロードして強調)

import { useEffect, useState, type CSSProperties } from 'react';
import {
  loadPositionalNode,
  positionalNodeFile,
  type PositionalAction,
  type PositionalQuestion,
  type PositionalResponse,
  type PositionalStrategy,
} from '../../data/training/preflopIntermediatePositional';
import { judgmentIcon, judgmentColor } from './judgmentIcon';
import { CardSet } from '../CardSet';
import { ActionTable } from './ActionTable';
import { HandRangeMatrix } from './HandRangeMatrix';
import { THEME } from '../../styles/theme';
import type { HandStrategy } from '../../data/training/preflopBeginner';
import type { Rank, Suit } from '../../types/card';

const ACTION_ORDER: ReadonlyArray<PositionalAction> = ['allin', 'raise', 'call', 'check', 'fold'];

export interface PositionalReviewDetailProps {
  question: PositionalQuestion;
  response: PositionalResponse;
  points: number;
}

export function PositionalReviewDetail({ question, response, points }: PositionalReviewDetailProps) {
  const [nodeHands, setNodeHands] = useState<Record<string, PositionalStrategy> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const file = positionalNodeFile(question.scenarioKey, {
      hero: question.myPosition,
      opener: question.opener,
      threeBettor: question.threeBettor,
    });
    if (!file) return;
    void loadPositionalNode(file).then((h) => {
      if (!cancelled) setNodeHands(h);
    });
    return () => {
      cancelled = true;
    };
  }, [question.scenarioKey, question.myPosition, question.opener, question.threeBettor]);

  const icon = judgmentIcon(points);
  const iconColor = judgmentColor(points);

  return (
    <div style={wrapStyle}>
      <ActionTable
        file={positionalNodeFile(question.scenarioKey, {
          hero: question.myPosition,
          opener: question.opener,
          threeBettor: question.threeBettor,
        })}
        mePosition={question.myPosition}
      />

      <section style={handSectionStyle}>
        <span style={mutedSmallStyle}>ハンド</span>
        <CardSet
          cards={question.cards.map((c) => ({ rank: c.rank as Rank, suit: c.suit as Suit }))}
          size="md"
          gap={4}
        />
      </section>

      <div style={judgmentRowStyle}>
        <span style={{ ...judgmentIconStyle, color: iconColor }}>{icon}</span>
        <span style={judgmentPtStyle}>{points >= 0 ? `+${points}` : points}pt</span>
      </div>

      {question.format === 'slider' ? (
        <SliderAnswer question={question} response={response} />
      ) : (
        <SelectAnswer question={question} response={response} />
      )}

      <div>
        <div style={mutedSmallStyle}>レンジ表</div>
        {nodeHands ? (
          <HandRangeMatrix
            hands={nodeHands as Record<string, HandStrategy>}
            highlightHand={question.hand}
          />
        ) : (
          <div style={mutedSmallStyle}>レンジ読み込み中…</div>
        )}
      </div>
    </div>
  );
}

function SliderAnswer({
  question,
  response,
}: {
  question: PositionalQuestion;
  response: PositionalResponse;
}) {
  const correct = Math.round(question.sliderCorrectPct);
  const your =
    response.kind === 'slider'
      ? `${response.pct}%`
      : response.kind === 'skip'
        ? '飛ばし'
        : response.kind === 'timeout'
          ? '時間切れ'
          : '—';
  return (
    <div style={answerBoxStyle}>
      <div style={answerRowStyle}>
        <span style={answerLabelStyle}>正解 ({question.actionLabels[question.sliderAction]} 頻度)</span>
        <span style={answerCorrectStyle}>{correct}%</span>
      </div>
      <div style={answerRowStyle}>
        <span style={answerLabelStyle}>あなたの回答</span>
        <span style={answerYourStyle}>{your}</span>
      </div>
    </div>
  );
}

function SelectAnswer({
  question,
  response,
}: {
  question: PositionalQuestion;
  response: PositionalResponse;
}) {
  const selected = response.kind === 'select' ? response.selections : [];
  const actions = ACTION_ORDER.filter((a) => question.availableActions.includes(a));
  return (
    <div style={answerBoxStyle}>
      <div style={mutedSmallStyle}>GTO 戦略 / あなたの選択</div>
      <ul style={listStyle}>
        {actions.map((a) => {
          const freq = question.strategy[a] ?? 0;
          const isMajor = freq >= 20;
          const chose = selected.includes(a);
          return (
            <li key={a} style={rowStyle}>
              <span style={{ ...nameStyle, fontWeight: isMajor ? 700 : 400 }}>
                {question.actionLabels[a]}
              </span>
              <span style={pctStyle}>{formatPct(freq)}</span>
              <span style={chose ? choseStyle : notChoseStyle}>{chose ? '選択' : '—'}</span>
            </li>
          );
        })}
      </ul>
      {response.kind === 'timeout' && <div style={noteStyle}>時間切れ</div>}
      {response.kind === 'select' && selected.length === 0 && <div style={noteStyle}>無回答</div>}
    </div>
  );
}

function formatPct(pct: number): string {
  if (Math.abs(pct - Math.round(pct)) < 0.01) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const wrapStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.7rem' };
const handSectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' };
const mutedSmallStyle: CSSProperties = { fontSize: '11px', color: '#5F5E5A' };
const judgmentRowStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '0.5rem' };
const judgmentIconStyle: CSSProperties = { fontSize: '1.3rem', fontWeight: 700 };
const judgmentPtStyle: CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: THEME.textPrimary };
const answerBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  background: '#F7F5F0',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
  padding: '0.6rem 0.7rem',
};
const answerRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' };
const answerLabelStyle: CSSProperties = { fontSize: '0.8rem', color: THEME.textSecondary };
const answerCorrectStyle: CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: '#3B6D11', fontVariantNumeric: 'tabular-nums' };
const answerYourStyle: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, color: THEME.textPrimary, fontVariantNumeric: 'tabular-nums' };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: THEME.textPrimary };
const nameStyle: CSSProperties = {};
const pctStyle: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: THEME.textSecondary };
const choseStyle: CSSProperties = { fontSize: '0.78rem', fontWeight: 700, color: '#3B6D11' };
const notChoseStyle: CSSProperties = { fontSize: '0.78rem', color: THEME.textMuted };
const noteStyle: CSSProperties = { fontSize: '0.8rem', color: '#A32D2D', fontWeight: 600 };
