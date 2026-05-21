// /training/{slug}/review/{n}: 間違えた問題の振り返り画面。
//
// 表示内容:
//   - 問題画面と同じ PokerTable + ハンド表示
//   - 選択肢は disabled、正解と「あなた」ラベルを付与
//   - [前の問題] [次の問題] で missed 内をナビゲート (ループしない)
//   - [← 結果に戻る] で /training/{slug}/result に戻る
//
// データ取得: recordsStore (in-mem + sessionStorage)。記録が見つからない場合は
// /training/{slug}/result にリダイレクト。

import type { CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import {
  loadRecords,
  missedRecords,
} from '../../data/training/recordsStore';
import type { ProblemRecord } from '../../data/training/recordsStore';
import {
  trainingPath,
  trainingReviewPath,
  type TrainingLevel,
} from '../../data/trainingCatalog';
import { CardSet } from '../CardSet';
import { THEME } from '../../styles/theme';
import { ActionTable } from './ActionTable';
import { beginnerNodeFile } from '../../data/training/preflopBeginner';
import { scenarioLabel } from './scenarioLabel';
import { TrainingReviewIntermediate } from './TrainingReviewIntermediate';
import type { Suit, Rank } from '../../types/card';

export interface TrainingReviewProps {
  level: TrainingLevel;
  /** missed 問題内の 1-indexed 位置 (URL から)。 */
  index: number;
}

/** クエリパラメータ ?score=N&total=M を付けた result パス。 records から score を再計算する。 */
function buildResultPath(
  levelKey: string,
  records: ReadonlyArray<ProblemRecord> | null,
): string {
  const base = trainingPath(levelKey, 'result');
  if (!records || records.length === 0) return base;
  const score = records.filter((r) => r.isCorrect).length;
  const total = records.length;
  const sp = new URLSearchParams({ score: String(score), total: String(total) });
  return `${base}?${sp.toString()}`;
}

export function TrainingReview({ level, index }: TrainingReviewProps) {
  // 中級は別コンポーネント (戦略数値テーブル + 獲得点を表示)
  if (level.key === 'preflop_intermediate') {
    return <TrainingReviewIntermediate level={level} index={index} />;
  }
  const records = loadRecords(level.key);
  const missed = records ? missedRecords(records) : [];
  const resultPath = buildResultPath(level.key, records);

  // 1-indexed → 0-indexed
  const i = index - 1;
  const current = missed[i];

  if (!current) {
    // 記録なし / 範囲外: 結果画面へリダイレクト (score 付きで戻すことで再エラーを防ぐ)
    return (
      <div style={pageStyle}>
        <main style={mainStyle}>
          <p style={notFoundStyle}>
            振り返り対象の記録が見つかりません。
          </p>
          <button
            type="button"
            onClick={() => navigate(resultPath)}
            style={primaryBtnStyle}
          >
            結果画面へ
          </button>
        </main>
      </div>
    );
  }

  const total = missed.length;
  const hasPrev = i > 0;
  const hasNext = i < total - 1;
  const goPrev = () => {
    if (hasPrev) navigate(trainingReviewPath(level.key, index - 1));
  };
  const goNext = () => {
    if (hasNext) navigate(trainingReviewPath(level.key, index + 1));
  };

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

        <div style={scenarioPillStyle}>{scenarioLabel(current)}</div>

        <ActionTable file={beginnerNodeFile(current)} mePosition={current.myPosition} />

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

        <section style={actionRowStyle}>
          <AnswerCell
            label="参加"
            isCorrect={current.correct === 'participate'}
            isUserChoice={current.userAnswer === 'participate'}
          />
          <AnswerCell
            label="参加しない"
            isCorrect={current.correct === 'fold'}
            isUserChoice={current.userAnswer === 'fold'}
          />
        </section>

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

// ---------------------------------------------------------------------------
// AnswerCell: 押せないボタン + 正解/自分の解答ラベル
// ---------------------------------------------------------------------------

function AnswerCell({
  label,
  isCorrect,
  isUserChoice,
}: {
  label: string;
  isCorrect: boolean;
  isUserChoice: boolean;
}) {
  const cellStyle: CSSProperties = {
    ...answerCellBaseStyle,
    ...(isCorrect ? correctCellStyle : incorrectCellStyle),
  };
  const mark = isCorrect ? '○' : '×';
  return (
    <div style={cellWrapStyle}>
      <button type="button" disabled style={cellStyle} aria-disabled>
        <span style={markStyle}>{mark}</span>
        <span>{label}</span>
      </button>
      {isUserChoice && (
        <span
          style={isCorrect ? userBadgeCorrectStyle : userBadgeIncorrectStyle}
          aria-label="あなたの解答"
        >
          ↑ あなた
        </span>
      )}
      {isCorrect && !isUserChoice && (
        <span style={correctBadgeStyle} aria-label="正解">
          ↑ 正解
        </span>
      )}
    </div>
  );
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

const actionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0.7rem',
};

const cellWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  alignItems: 'center',
};

const answerCellBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.35rem',
  padding: '0.85rem 1rem',
  borderRadius: '0.45rem',
  fontSize: '1rem',
  fontWeight: 700,
  width: '100%',
  fontFamily: 'inherit',
  cursor: 'not-allowed',
};

const correctCellStyle: CSSProperties = {
  background: '#E5F5DC',
  color: '#1F4D11',
  border: '2px solid #6B9C3C',
};

const incorrectCellStyle: CSSProperties = {
  background: '#F7E3E2',
  color: '#7A2A26',
  border: '2px solid #C25855',
};

const markStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 900,
};

const userBadgeCorrectStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#1F4D11',
};

const userBadgeIncorrectStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#993C1D',
};

const correctBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#3F6A1B',
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
