// 現ノードの available_actions を 1 行 1 アクションで表示。
// レイアウト: [記号] [ラベル] [%] [→ 実行]
//
// - 0% アクションは非表示 (Q4 確定済)
// - 記号は個別 action の頻度で classifyByPlayRate (0以外で評価)
// - 実行クリックで onSelect(actionCode) → 親 (FlopStrategyView) で chain に push
// - 文字色は ActionType / RAI から STRATEGY_TEXT_COLORS で導出

import type { CSSProperties } from 'react';
import type { ActionSolution, FlopAction, FlopAvailableAction } from '../types/flop';
import {
  classifyByPlayRate,
  getSymbolStyle,
  STRATEGY_TEXT_COLORS,
} from '../utils/strategySymbol';
import { THEME } from '../styles/theme';

interface Props {
  /** game_point.available_actions */
  actions: ReadonlyArray<FlopAvailableAction>;
  /** action 頻度の配列。`action_totals` (レンジ平均) または `action_solutions` (board 別) を許容。 */
  totals: ReadonlyArray<ActionSolution>;
  /** Chain 既に aggressive ありなら R<size> は Raise、なければ Bet 表記 */
  afterAggression: boolean;
  /** 実行ボタンクリック時に呼ばれる (actionCode = "F" / "C" / "X" / "RAI" / "R6.35" 等) */
  onSelect: (actionCode: string) => void;
  /** loading 中などで disable する場合 */
  disabled?: boolean;
}

export function FlopNextActionButtons({
  actions,
  totals,
  afterAggression,
  onSelect,
  disabled = false,
}: Props) {
  const freqByCode = new Map<string, number>();
  for (const t of totals) freqByCode.set(t.action_code, t.frequency);

  // 0% (= ラウンド後表示が "0%" になる ~0.005 未満) アクションは表示しない (Q4 確定)。
  // 厳密に frequency > 0 だけだと 0.0001 等の極小値が "0%" として残ってしまうため、
  // 表示時の pct を 1 以上 (= 四捨五入で 0% にならない) で filter。
  const visible = actions.filter((a) => {
    const freq = freqByCode.get(a.action.code) ?? 0;
    return Math.round(freq * 100) > 0;
  });

  if (visible.length === 0) {
    return (
      <div style={emptyStyle}>有効なアクション無し (全 frequency = 0)</div>
    );
  }

  return (
    <ul style={listStyle}>
      {visible.map((a) => (
        <ActionRow
          key={a.action.code}
          action={a.action}
          frequency={freqByCode.get(a.action.code) ?? 0}
          afterAggression={afterAggression}
          disabled={disabled}
          onClick={() => onSelect(a.action.code)}
        />
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------------
// Action row
// ----------------------------------------------------------------------------

interface ActionRowProps {
  action: FlopAction;
  frequency: number;
  afterAggression: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ActionRow({ action, frequency, afterAggression, disabled, onClick }: ActionRowProps) {
  const pct = frequency * 100;
  // 単一アクション頻度で記号判定 (≥90:◎ / ≥30:○ / ≥10:△ / else:✕)
  const symbol = classifyByPlayRate(pct, 0);
  const symStyle = getSymbolStyle(symbol);
  const label = formatActionLabel(action, afterAggression);
  const textColor = getActionTextColor(action);

  return (
    <li style={rowStyle}>
      <span style={{ ...symbolStyle, color: symStyle.symbolColor }}>{symbol}</span>
      <span style={{ ...labelStyle, color: textColor }}>{label}</span>
      <span style={pctStyle}>{pct.toFixed(0)}%</span>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={disabled ? execButtonDisabledStyle : execButtonStyle}
      >
        → 実行
      </button>
    </li>
  );
}

// ----------------------------------------------------------------------------
// Format helpers
// ----------------------------------------------------------------------------

function formatActionLabel(action: FlopAction, afterAggression: boolean): string {
  const code = action.code;
  if (code === 'X') return 'Check';
  if (code === 'C') return 'Call';
  if (code === 'F') return 'Fold';
  if (code === 'RAI') return 'All-in';
  if (code.startsWith('R')) {
    const verb = afterAggression ? 'Raise' : 'Bet';
    const potPct = action.betsize_by_pot
      ? Math.round(parseFloat(action.betsize_by_pot) * 100)
      : null;
    return potPct !== null ? `${verb} ${potPct}%` : verb;
  }
  return code;
}

function getActionTextColor(action: FlopAction): string {
  if (action.code === 'RAI') return STRATEGY_TEXT_COLORS.allin;
  if (action.type === 'FOLD') return STRATEGY_TEXT_COLORS.fold;
  if (action.type === 'CHECK' || action.type === 'CALL') return STRATEGY_TEXT_COLORS.call;
  if (action.type === 'RAISE') return STRATEGY_TEXT_COLORS.raise;
  return THEME.textPrimary;
}

// ----------------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------------

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto auto',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.7rem',
  background: 'rgba(255,255,255,0.7)',
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.4rem',
};

const symbolStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 500,
  lineHeight: 1,
  textAlign: 'center',
  minWidth: '24px',
};

const labelStyle: CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 600,
};

const pctStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.85rem',
  color: THEME.textPrimary,
  fontWeight: 600,
  minWidth: '40px',
  textAlign: 'right',
};

const execButtonStyle: CSSProperties = {
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  padding: '0.35rem 0.75rem',
  fontSize: '0.78rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
};

const execButtonDisabledStyle: CSSProperties = {
  ...execButtonStyle,
  background: THEME.textFaint,
  cursor: 'not-allowed',
};

const emptyStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
  padding: '0.5rem',
  textAlign: 'center',
};
