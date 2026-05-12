// Flop の action_totals (レンジ平均アクション頻度) をサマリーカードで表示。
// 背景はグラデ (buildGradient(WithAllin))、中央に記号 (◎/○/△/✕)、
// 子要素として <FlopNextActionButtons> 等を内包する。
//
// preflop の <StrategyCard> は 4 軸 (raise/call/fold/allin) の prop ベースだが、
// flop は bet/raise/check/call/allin/fold の 6 種類混在のため、ここでは
// 集計を「aggressive (bet+raise) / passive (call+check) / allin / fold」の
// 4 軸に正規化してから既存の utility (buildGradient(WithAllin)) を流用する。

import type { CSSProperties, ReactNode } from 'react';
import type { ActionSolution } from '../types/flop';
import {
  buildGradient,
  buildGradientWithAllin,
  classifyByPlayRate,
  classifyByPlayRateWithAllin,
  getSymbolStyle,
} from '../utils/strategySymbol';

interface Props {
  /**
   * action 頻度の配列。レンジ平均モードでは `FlopNode.action_totals`、
   * 選択 board モードでは `BoardSolution.action_solutions` を渡す。
   * 両者とも `{action_code, frequency}` の minimal shape を持つので
   * structural typing で互換 (ActionSolution が共通最小型)。
   */
  totals: ReadonlyArray<ActionSolution>;
  /** 中身 (通常は <FlopNextActionButtons>)。 */
  children?: ReactNode;
}

interface Aggregate {
  aggressivePct: number; // bet + raise (= R<size>)
  passivePct: number;    // check + call
  allinPct: number;      // RAI
  foldPct: number;       // F
}

function aggregate(totals: ReadonlyArray<ActionSolution>): Aggregate {
  let aggressivePct = 0;
  let passivePct = 0;
  let allinPct = 0;
  let foldPct = 0;
  for (const t of totals) {
    const pct = t.frequency * 100;
    const code = t.action_code;
    if (code === 'F') foldPct += pct;
    else if (code === 'X' || code === 'C') passivePct += pct;
    else if (code === 'RAI') allinPct += pct;
    else if (code.startsWith('R')) aggressivePct += pct;
    // 未知 code は無視 (将来 schema 追加に対する forward-compat)
  }
  return { aggressivePct, passivePct, allinPct, foldPct };
}

export function FlopActionTotalsCard({ totals, children }: Props) {
  const agg = aggregate(totals);
  const hasAllin = agg.allinPct > 0;

  const symbol = hasAllin
    ? classifyByPlayRateWithAllin(agg.aggressivePct, agg.passivePct, agg.allinPct)
    : classifyByPlayRate(agg.aggressivePct, agg.passivePct);
  const symStyle = getSymbolStyle(symbol);

  const background = hasAllin
    ? buildGradientWithAllin(agg.aggressivePct, agg.passivePct, agg.allinPct, agg.foldPct)
    : buildGradient(agg.aggressivePct, agg.passivePct, agg.foldPct);

  return (
    <div
      style={{
        ...containerStyle,
        background,
        border: `2px solid ${symStyle.border}`,
      }}
    >
      <div style={headerStyle}>
        <span style={{ ...titleStyle, color: symStyle.labelColor }}>
          Range Strategy
        </span>
        <div
          style={{
            ...symbolStyle,
            color: symStyle.symbolColor,
          }}
          aria-label={`play rate symbol ${symbol}`}
        >
          {symbol}
        </div>
      </div>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const containerStyle: CSSProperties = {
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.7rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: CSSProperties = {
  fontSize: '0.7rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const symbolStyle: CSSProperties = {
  fontSize: '2rem',
  fontWeight: 500,
  lineHeight: 1,
  textShadow: '0 1px 0 rgba(255,255,255,0.6)',
};
