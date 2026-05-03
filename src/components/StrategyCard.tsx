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
 * - allinRate 未指定: 3色グラデ (R/C/F) + symbol は raise+call で分類
 * - allinRate 指定:   4色グラデ (AI/R/C/F) + symbol は raise+call+allin で分類 + AI 行表示
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

  // 表示は四捨五入の整数 (小数1桁は読みづらい)
  const fmt = (v: number) => Math.round(v).toString();

  return (
    <div
      style={{
        border: `2px solid ${style.border}`,
        background,
        borderRadius: '0.5rem',
        padding: '0.75rem 0.5rem',
        textAlign: 'center',
        minHeight: '110px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
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
          margin: '0.5rem 0',
          fontWeight: 500,
        }}
      >
        {symbol}
      </div>

      <div
        style={{
          fontSize: '11px',
          lineHeight: 1.4,
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          // 行スロット数で固定高さ。useAllin=true なら 3行、false なら 2行。
          // visibility:hidden では稀に高さが 0 になる環境があるため明示固定。
          minHeight: useAllin ? '46px' : '31px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 行スロットは値が 0 でも常に占有 (visibility:hidden)。
              これでカード間で AI/R/C 行の縦位置が常に揃う (4bet ↔ AI 0% ↔ AI 50% など)。
              4bet (useAllin=true) ⇒ 3行スロット、Open/3bet ⇒ 2行スロット。 */}
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
  return (
    <div style={{ color, visibility: visible ? 'visible' : 'hidden' }}>
      {label}: {fmt(value)}%
    </div>
  );
}
