import {
  buildGradient,
  buildGradientWithAllin,
  classifyByPlayRate,
  classifyByPlayRateWithAllin,
  getSymbolStyle,
  STRATEGY_TEXT_COLORS,
} from '../utils/strategySymbol';

interface Props {
  position: string;
  raiseRate: number;
  callRate: number;
  /** 省略時は 100 - raise - call (- allin) で計算 */
  foldRate?: number;
  /** 指定時は 4色グラデ + AI 表示 + play率に allin を含む (4bet 用)。
   *   未指定 = Open / 3bet 互換挙動。 */
  allinRate?: number;
}

/**
 * Open / 3bet / 4bet 共通の戦略表示カード。
 * - allinRate 未指定: 3色グラデ (R/C/F) + symbol は raise+call で分類 + 2行スロット
 * - allinRate 指定:   4色グラデ (AI/R/C/F) + symbol は raise+call+allin で分類 + 3行スロット
 *
 * 内部レイアウトは CSS Grid。各行 (位置 / symbol / AI / R / C) を明示的にスロット化し、
 * AI 有無に関わらずカード間で行の Y 座標が必ず揃う。空行も非破壊空白 ( ) で
 * 必ず描画してブラウザ依存 (visibility:hidden の解釈差) を排除。
 */
export function StrategyCard({
  position,
  raiseRate,
  callRate,
  foldRate,
  allinRate,
}: Props) {
  const useAllin = allinRate !== undefined;
  const symbol = useAllin
    ? classifyByPlayRateWithAllin(raiseRate, callRate, allinRate ?? 0)
    : classifyByPlayRate(raiseRate, callRate);
  const style = getSymbolStyle(symbol);
  const background = useAllin
    ? buildGradientWithAllin(raiseRate, callRate, allinRate ?? 0, foldRate)
    : buildGradient(raiseRate, callRate, foldRate);

  const showRaise = raiseRate > 0;
  const showCall = callRate > 0;
  const showAllin = useAllin && (allinRate ?? 0) > 0;

  const fmt = (v: number) => Math.round(v).toString();

  // grid-template-rows: auto (位置) / 1fr (symbol が伸びる) / auto×N (stats)
  const gridRows = useAllin ? 'auto 1fr auto auto auto' : 'auto 1fr auto auto';

  return (
    <div
      style={{
        border: `2px solid ${style.border}`,
        background,
        borderRadius: '0.5rem',
        padding: '0.75rem 0.5rem',
        textAlign: 'center',
        display: 'grid',
        gridTemplateRows: gridRows,
        rowGap: '0.25rem',
        minHeight: useAllin ? '140px' : '120px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: style.labelColor,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 500,
        }}
      >
        {position}
      </div>

      <div
        style={{
          fontSize: '28px',
          lineHeight: 1,
          color: style.symbolColor,
          fontWeight: 500,
          alignSelf: 'center',
        }}
      >
        {symbol}
      </div>

      {/* stats 行 — 各行は grid 上の独立スロット。空行も &nbsp; で描画して必ず lineHeight ぶんを確保。 */}
      {useAllin && (
        <StatLine
          color={STRATEGY_TEXT_COLORS.allin}
          label="AI"
          value={allinRate ?? 0}
          visible={showAllin}
          fmt={fmt}
        />
      )}
      <StatLine
        color={STRATEGY_TEXT_COLORS.raise}
        label="R"
        value={raiseRate}
        visible={showRaise}
        fmt={fmt}
      />
      <StatLine
        color={STRATEGY_TEXT_COLORS.call}
        label="C"
        value={callRate}
        visible={showCall}
        fmt={fmt}
      />
    </div>
  );
}

interface StatLineProps {
  color: string;
  label: string;
  value: number;
  visible: boolean;
  fmt: (v: number) => string;
}

function StatLine({ color, label, value, visible, fmt }: StatLineProps) {
  // 不可視時も ' ' (NBSP) を入れて行高を必ず確保 — visibility:hidden 依存を回避。
  return (
    <div
      style={{
        color,
        fontSize: '11px',
        lineHeight: 1.4,
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      }}
    >
      {visible ? `${label}: ${fmt(value)}%` : ' '}
    </div>
  );
}
