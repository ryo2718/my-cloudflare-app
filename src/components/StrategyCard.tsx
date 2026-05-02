import {
  buildGradient,
  classifyByPlayRate,
  getSymbolStyle,
  STRATEGY_TEXT_COLORS,
} from '../utils/strategySymbol';

interface Props {
  position: string;
  raiseRate: number;
  callRate: number;
  /** 省略時は 100 - raise - call で計算 */
  foldRate?: number;
}

/**
 * Open / 3bet 共通の戦略表示カード。
 * - 背景: raise(赤)/call(緑)/fold(青) の3色 135度グラデーション
 * - 中央: ◎ ○ △ ✕ の play率記号
 * - 下: R: / C: の数値 (0% は非表示)
 */
export function StrategyCard({ position, raiseRate, callRate, foldRate }: Props) {
  const symbol = classifyByPlayRate(raiseRate, callRate);
  const style = getSymbolStyle(symbol);
  const background = buildGradient(raiseRate, callRate, foldRate);

  const showRaise = raiseRate > 0;
  const showCall = callRate > 0;

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
          minHeight: '30px',
        }}
      >
        {showRaise && (
          <div style={{ color: STRATEGY_TEXT_COLORS.raise }}>R: {fmt(raiseRate)}%</div>
        )}
        {showCall && (
          <div style={{ color: STRATEGY_TEXT_COLORS.call }}>C: {fmt(callRate)}%</div>
        )}
      </div>
    </div>
  );
}
