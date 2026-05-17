// Flop レポートの 1 セル (matchup × depth × scenario)。
//
// Phase 2: マウント時に loadFlopReportCell でデータ取得 → loading/ok/error/NA の
// 4 view で render。Phase 3 で FlopReportMatrix から 6×6 配置されて使われる予定。
//
// データ取得の最適化:
//   - variant === null → fetch せず NA 表示
//   - scenario==='donk' かつ !donkApplicable → fetch せず NA 表示
//   - scenario が donk⇔cb で切り替わると再 fetch (簡易実装、Phase 3 で matrix 側 cache 化)
//
// NA / fetch 状態の役割分離:
//   - NA は props だけで決まるので render 内で derive (state には乗せない)
//   - state は fetch ライフサイクル (loading/ok/error) のみを保持

import { useEffect, useState, type CSSProperties } from 'react';
import { THEME } from '../styles/theme';
import {
  classifyByBetRate,
  DEFAULT_BET_RATE_THRESHOLDS,
  loadFlopReportCell,
  type BetRateSymbol,
  type BetRateThresholds,
  type FlopReportCellResult,
  type FlopReportDepth,
  type MatchupCell,
} from '../data/flopReport';

export interface FlopReportCellProps {
  matchup: MatchupCell;
  depth: FlopReportDepth;
  scenario: 'donk' | 'cb';
  /** 選択中ボード名 (正準化済)。null = 全ボード平均。 */
  board: string | null;
  thresholds?: BetRateThresholds;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; result: FlopReportCellResult };

type NaReason = 'no-variant' | 'donk-na' | null;

function deriveNaReason(matchup: MatchupCell, scenario: 'donk' | 'cb'): NaReason {
  if (matchup.variant === null) return 'no-variant';
  if (scenario === 'donk' && !matchup.donkApplicable) return 'donk-na';
  return null;
}

export function FlopReportCell({
  matchup,
  depth,
  scenario,
  board,
  thresholds = DEFAULT_BET_RATE_THRESHOLDS,
}: FlopReportCellProps) {
  const naReason = deriveNaReason(matchup, scenario);
  const variant = matchup.variant;

  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    // NA 確定 or variant 不在 → fetch スキップ。state は使わず render で NA を出す。
    if (naReason !== null || variant === null) return;

    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });

    loadFlopReportCell(variant, depth, board, undefined, ctrl.signal)
      .then((result) => setState({ kind: 'ok', result }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message });
      });

    return () => ctrl.abort();
  }, [variant, depth, board, naReason]);

  // ----- render --------------------------------------------------------------
  if (naReason !== null) {
    return (
      <div style={naCellStyle} title={naTooltip(matchup, scenario)}>
        <span style={naSymbolStyle}>−</span>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div style={cellBaseStyle}>
        <span style={loadingStyle}>…</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div style={errorCellStyle} title={state.message}>
        <span style={errorTextStyle}>err</span>
      </div>
    );
  }

  // state.kind === 'ok'
  const rate =
    scenario === 'donk' ? state.result.donkRate : state.result.cbRate;
  if (rate === null) {
    // fetch 後に判明する N/A (例: donk-applicable でも all-N/A な board)。
    // 現状の loadFlopReportCell では発生しないが、防衛的に対応。
    return (
      <div style={naCellStyle} title={naTooltip(matchup, scenario)}>
        <span style={naSymbolStyle}>−</span>
      </div>
    );
  }
  const symbol = classifyByBetRate(rate, thresholds);
  const pct = (rate * 100).toFixed(rate >= 0.995 ? 0 : 1);
  const tone = symbolToTone(symbol);

  return (
    <div
      style={{ ...cellBaseStyle, background: tone.bg, color: tone.fg, borderColor: tone.border }}
      title={cellTooltip(matchup, scenario, rate)}
    >
      <span style={symbolStyle}>{symbol}</span>
      <span style={pctStyle}>{pct}%</span>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Tooltip helpers
// ----------------------------------------------------------------------------

function naTooltip(matchup: MatchupCell, scenario: 'donk' | 'cb'): string {
  if (matchup.variant === null) return 'データなし';
  if (scenario === 'donk' && !matchup.donkApplicable) {
    return `Donk 適用外 (caller=${matchup.caller} は IP)`;
  }
  return '—';
}

function cellTooltip(
  matchup: MatchupCell,
  scenario: 'donk' | 'cb',
  rate: number,
): string {
  const label = scenario === 'donk' ? 'Donk' : 'CB';
  const actor =
    scenario === 'donk' ? matchup.caller ?? '?' : matchup.aggressor ?? '?';
  return `${label} by ${actor}: ${(rate * 100).toFixed(2)}%`;
}

// ----------------------------------------------------------------------------
// Styles (Phase 6: CSS 変数で応答的に。PC=64 / 中=54 / mobile<480=46)
//   トークン定義は src/index.css の :root + @media を参照。
// ----------------------------------------------------------------------------

/** 同期用フォールバック値 (= 中サイズ)。CSS 変数が効かない環境向けの数値 fallback。 */
export const CELL_SIZE = 54;

const cellBaseStyle: CSSProperties = {
  width: 'var(--flop-cell-size, 54px)',
  height: 'var(--flop-cell-size, 54px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontFamily: 'inherit',
  color: THEME.textPrimary,
  boxSizing: 'border-box',
};

const naCellStyle: CSSProperties = {
  ...cellBaseStyle,
  background: '#ffffff',
  borderColor: THEME.border,
  color: THEME.textFaint,
};

const errorCellStyle: CSSProperties = {
  ...cellBaseStyle,
  background: THEME.errorBg,
  borderColor: THEME.errorBorder,
};

const symbolStyle: CSSProperties = {
  fontSize: 'var(--flop-cell-icon, 19px)',
  lineHeight: 1,
};

const pctStyle: CSSProperties = {
  fontSize: 'var(--flop-cell-pct, 9px)',
  marginTop: '3px',
  opacity: 0.8,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.01em',
  fontWeight: 600,
};

const naSymbolStyle: CSSProperties = {
  fontSize: 'var(--flop-cell-na, 16px)',
  color: THEME.textFaint,
  lineHeight: 1,
};

const loadingStyle: CSSProperties = {
  fontSize: 'var(--flop-cell-load, 14px)',
  color: THEME.textMuted,
  letterSpacing: '0.1em',
  lineHeight: 1,
};

const errorTextStyle: CSSProperties = {
  fontSize: 'var(--flop-cell-err, 10px)',
  color: THEME.errorText,
  fontWeight: 700,
  lineHeight: 1,
};

interface ToneColors {
  bg: string;
  fg: string;
  border: string;
}

/**
 * 4 階調 (案B 仕様): ◎=濃いアンバー, ○=中アンバー, △=薄アンバー, ×=ウォームグレー。
 * 視認性のため bg と fg は十分なコントラスト比を確保。
 */
function symbolToTone(symbol: BetRateSymbol): ToneColors {
  switch (symbol) {
    case '◎':
      return { bg: '#FAC775', fg: '#412402', border: '#D97706' };
    case '○':
      return { bg: '#FAEEDA', fg: '#633806', border: '#E5A551' };
    case '△':
      return { bg: '#FCF5E2', fg: '#8B6914', border: '#E8D9A8' };
    case '×':
      return { bg: '#F1EFE8', fg: '#444441', border: '#D6CFC1' };
    case '−':
      return { bg: '#ffffff', fg: THEME.textFaint, border: THEME.border };
  }
}
