// 6×6 Flop レポートマトリクス (案B レイアウト)。
//
// HTML <table> で描画 (CSS grid ではない、要件:意味的なテーブル構造):
//   - thead: 列ヘッダー (SB / BB / UTG / HJ / CO / BTN)
//   - tbody: 各行に行ヘッダー + 6 セル
//   - 対角線 (hero === villain): 「—」グレーアウト
//   - データなしマッチアップ: 「—」中央 (通常背景)
//   - データありマッチアップ: <FlopReportCell> を埋め込み
//
// レスポンシブ: 親 div で `overflow-x: auto`、table 自体は縮めない。

import { useMemo, type CSSProperties } from 'react';
import { THEME } from '../styles/theme';
import {
  enumerateMatchups,
  type BetRateThresholds,
  type FlopReportDepth,
  type MatchupCell,
} from '../data/flopReport';
import { FlopReportCell } from './FlopReportCell';
import type { Position } from '../types/strategy';

export interface FlopReportMatrixProps {
  depth: FlopReportDepth;
  scenario: 'donk' | 'cb';
  /** 選択中ボード名 (null = 全ボード平均)。 */
  board: string | null;
  thresholds?: BetRateThresholds;
}

/** Matrix 表示順 (postflop seating: SB が最 OOP)。 */
const MATRIX_POSITIONS: ReadonlyArray<Position> = [
  'SB',
  'BB',
  'UTG',
  'HJ',
  'CO',
  'BTN',
];

/** 同一マッチアップを (順序不問の) 一意キーに変換。 */
function pairKey(a: Position, b: Position): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * セルの構造的ラベル ("UTG CB vs BB at AsKsQs" 等)。td の title / aria-label に使う。
 * 数値部分は FlopReportCell 内部の tooltip ("CB by UTG: 59.24%") が担う。
 */
function buildCellLabel(
  hero: Position,
  villain: Position,
  scenario: 'donk' | 'cb',
  board: string | null,
): string {
  const action = scenario === 'cb' ? 'CB' : 'donk';
  const boardPart = board ? ` at ${board}` : ' (全ボード平均)';
  return `${hero} ${action} vs ${villain}${boardPart}`;
}

export function FlopReportMatrix({
  depth,
  scenario,
  board,
  thresholds,
}: FlopReportMatrixProps) {
  // Depth ごとの 15 cell を pair-key で索引化。lookup は O(1)。
  const matchupMap = useMemo(() => {
    const map = new Map<string, MatchupCell>();
    for (const cell of enumerateMatchups(depth)) {
      map.set(pairKey(cell.oop, cell.ip), cell);
    }
    return map;
  }, [depth]);

  return (
    <div style={scrollWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cornerThStyle} aria-hidden />
            {MATRIX_POSITIONS.map((pos) => (
              <th key={pos} scope="col" style={colHeaderStyle}>
                {pos}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX_POSITIONS.map((hero) => (
            <tr key={hero}>
              <th scope="row" style={rowHeaderStyle}>
                {hero}
              </th>
              {MATRIX_POSITIONS.map((villain) => {
                const key = `${hero}-${villain}`;
                if (hero === villain) {
                  return (
                    <td key={key} style={diagCellStyle} aria-label="同ポジション">
                      <span style={dashStyle}>—</span>
                    </td>
                  );
                }
                const cell = matchupMap.get(pairKey(hero, villain));
                if (!cell || cell.variant === null) {
                  return (
                    <td key={key} style={emptyCellStyle} aria-label="データなし">
                      <span style={dashStyle}>—</span>
                    </td>
                  );
                }

                // hero (行) が当該 scenario の actor (= 実行者) でなければ empty 扱い。
                //   - cb  : actor は aggressor
                //   - donk: actor は caller、かつ donkApplicable (caller=OOP) のみ
                // データ層は順序非依存の MatchupCell を返すので、ここで非対称化する。
                const heroIsActor =
                  scenario === 'cb'
                    ? hero === cell.aggressor
                    : hero === cell.caller && cell.donkApplicable;

                if (!heroIsActor) {
                  return (
                    <td
                      key={key}
                      style={emptyCellStyle}
                      aria-label={`${hero} は ${scenario.toUpperCase()} を行わない`}
                    >
                      <span style={dashStyle}>—</span>
                    </td>
                  );
                }

                const label = buildCellLabel(hero, villain, scenario, board);
                return (
                  <td
                    key={key}
                    style={dataCellStyle}
                    title={label}
                    aria-label={label}
                  >
                    <FlopReportCell
                      matchup={cell}
                      depth={depth}
                      scenario={scenario}
                      board={board}
                      thresholds={thresholds}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const scrollWrapStyle: CSSProperties = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};

// Phase 6: 全寸法を CSS 変数化 (index.css の @media と連動)。
const tableStyle: CSSProperties = {
  borderCollapse: 'separate',
  borderSpacing: 'var(--flop-matrix-gap, 2px)',
  width: 'max-content',
  tableLayout: 'fixed',
};

const cornerThStyle: CSSProperties = {
  width: 'var(--flop-matrix-header-w, 24px)',
  height: 'var(--flop-matrix-corner-h, 18px)',
  padding: 0,
  background: 'transparent',
};

const colHeaderStyle: CSSProperties = {
  width: 'var(--flop-cell-size, 54px)',
  fontSize: '11px',
  fontWeight: 500,
  color: THEME.textSecondary,
  padding: 0,
  textAlign: 'center',
  letterSpacing: '0.04em',
};

const rowHeaderStyle: CSSProperties = {
  width: 'var(--flop-matrix-header-w, 24px)',
  fontSize: '11px',
  fontWeight: 500,
  color: THEME.textSecondary,
  padding: '0 4px 0 0',
  textAlign: 'right',
  verticalAlign: 'middle',
  letterSpacing: '0.04em',
};

const dataCellStyle: CSSProperties = {
  width: 'var(--flop-cell-size, 54px)',
  height: 'var(--flop-cell-size, 54px)',
  padding: 0,
  verticalAlign: 'middle',
};

const diagCellStyle: CSSProperties = {
  width: 'var(--flop-cell-size, 54px)',
  height: 'var(--flop-cell-size, 54px)',
  padding: 0,
  verticalAlign: 'middle',
  textAlign: 'center',
  background: THEME.cellEmpty,
  color: THEME.textFaint,
  borderRadius: '0.35rem',
};

const emptyCellStyle: CSSProperties = {
  width: 'var(--flop-cell-size, 54px)',
  height: 'var(--flop-cell-size, 54px)',
  padding: 0,
  verticalAlign: 'middle',
  textAlign: 'center',
  background: THEME.card,
  color: THEME.textFaint,
  border: `0.5px solid ${THEME.border}`,
  borderRadius: '0.35rem',
};

const dashStyle: CSSProperties = {
  fontSize: 'var(--flop-matrix-dash, 16px)',
  lineHeight: 1,
};
