// § 5: OOP アクション一覧 (Phase R3 で 5 列 table 化)。
//
// 元要件:
//   ヘッダ: "OOP: <position>"
//   行: [記号] [アクション名] [サイズ%] [混合戦略%] [実行ボタン]
//   0% 非表示、既存 STRATEGY_TEXT_COLORS + classifyByPlayRate 流用
//
// R3 は immediate-commit (クリックで chain push)。R4 で tentative pattern に refactor 予定。
// `actor` prop で OOP / IP のヘッダラベルだけ切替、振る舞いは同じ。

import type { CSSProperties } from 'react';
import type {
  ActionSolution,
  FlopAction,
  FlopAvailableAction,
} from '../types/flop';
import {
  classifyByPlayRate,
  getSymbolStyle,
  STRATEGY_TEXT_COLORS,
} from '../utils/strategySymbol';
import { THEME } from '../styles/theme';

export interface FlopOOPActionsProps {
  /** 'OOP' or 'IP' (ヘッダラベル切替)。 */
  actor: 'OOP' | 'IP';
  /** Position display (例: 'BB')。 */
  position: string;
  actions: ReadonlyArray<FlopAvailableAction>;
  totals: ReadonlyArray<ActionSolution>;
  afterAggression: boolean;
  /** クリック時に呼ばれる。R4: 上段 (current) なら tentative set、下段 (next) なら commit。 */
  onSelect: (actionCode: string) => void;
  disabled?: boolean;
  /** ヘッダに「OOP の選択待ち」等の追加表示。任意。 */
  subtitle?: string;
  /**
   * R4: 上段で OOP が tentative 選択中の action code。該当行を highlight + 再 click で取消可。
   * 下段 (= next actor row) や未選択時は null。
   */
  pendingActionCode?: string | null;
}

export function FlopOOPActions({
  actor,
  position,
  actions,
  totals,
  afterAggression,
  onSelect,
  disabled = false,
  subtitle,
  pendingActionCode = null,
}: FlopOOPActionsProps) {
  const freqByCode = new Map<string, number>();
  for (const t of totals) freqByCode.set(t.action_code, t.frequency);

  // 0% (= 表示値が "0%" になる ~0.5% 未満) アクションは非表示
  const visible = actions.filter((a) => {
    const freq = freqByCode.get(a.action.code) ?? 0;
    return Math.round(freq * 100) > 0;
  });

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={actorBadgeStyle(actor)}>{actor}</span>
        <span style={positionLabelStyle}>{position}</span>
        {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
      </div>

      {visible.length === 0 ? (
        <div style={emptyStyle}>有効なアクションなし</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>記号</th>
              <th style={thLeftStyle}>アクション</th>
              <th style={thStyle}>サイズ</th>
              <th style={thStyle}>混合戦略</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <ActionRow
                key={a.action.code}
                action={a.action}
                frequency={freqByCode.get(a.action.code) ?? 0}
                afterAggression={afterAggression}
                disabled={disabled}
                pending={pendingActionCode === a.action.code}
                onClick={() => onSelect(a.action.code)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
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
  pending: boolean;
  onClick: () => void;
}

function ActionRow({ action, frequency, afterAggression, disabled, pending, onClick }: ActionRowProps) {
  const pct = frequency * 100;
  const symbol = classifyByPlayRate(pct, 0);
  const symStyle = getSymbolStyle(symbol);
  const { actionLabel, sizeLabel } = formatActionAndSize(action, afterAggression);
  const textColor = getActionTextColor(action);

  const rowStyle: CSSProperties = pending
    ? { background: '#fef3c7' /* amber-100 */, outline: `1px solid ${THEME.accent}` }
    : {};

  return (
    <tr style={rowStyle}>
      <td style={{ ...tdStyle, color: symStyle.symbolColor, fontSize: '1.15rem', fontWeight: 500 }}>
        {symbol}
      </td>
      <td style={{ ...tdLeftStyle, color: textColor, fontWeight: 600 }}>{actionLabel}</td>
      <td style={tdStyle}>{sizeLabel ?? '—'}</td>
      <td style={tdMonoStyle}>{pct.toFixed(0)}%</td>
      <td style={tdStyle}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={pending ? execButtonPendingStyle : disabled ? execButtonDisabledStyle : execButtonStyle}
          title={pending ? '再クリックで取消' : undefined}
        >
          {pending ? '取消' : '実行'}
        </button>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Format helpers
// ----------------------------------------------------------------------------

function formatActionAndSize(action: FlopAction, afterAggression: boolean): {
  actionLabel: string;
  sizeLabel: string | null;
} {
  const code = action.code;
  if (code === 'X') return { actionLabel: 'check', sizeLabel: null };
  if (code === 'C') return { actionLabel: 'call', sizeLabel: null };
  if (code === 'F') return { actionLabel: 'fold', sizeLabel: null };
  if (code === 'RAI') return { actionLabel: 'all-in', sizeLabel: null };
  if (code.startsWith('R')) {
    const verb = afterAggression ? 'raise' : 'bet';
    const potPct = action.betsize_by_pot
      ? `${Math.round(parseFloat(action.betsize_by_pot) * 100)}%`
      : null;
    return { actionLabel: verb, sizeLabel: potPct };
  }
  return { actionLabel: code, sizeLabel: null };
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

const containerStyle: CSSProperties = {
  background: THEME.card,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  padding: '0.85rem 1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.55rem',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

function actorBadgeStyle(label: 'OOP' | 'IP'): CSSProperties {
  return {
    display: 'inline-block',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '0.2rem 0.55rem',
    borderRadius: '0.25rem',
    background: label === 'OOP' ? '#fef3c7' : '#dbeafe',
    color: label === 'OOP' ? '#92400e' : '#1e3a8a',
    letterSpacing: '0.06em',
  };
}

const positionLabelStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};

const subtitleStyle: CSSProperties = {
  fontSize: '0.74rem',
  color: THEME.textMuted,
  fontStyle: 'italic',
  marginLeft: '0.3rem',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.88rem',
};

const thStyle: CSSProperties = {
  textAlign: 'center',
  padding: '0.3rem 0.4rem',
  fontSize: '0.7rem',
  color: THEME.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
  borderBottom: `1px solid ${THEME.border}`,
};

const thLeftStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'left',
};

const tdStyle: CSSProperties = {
  textAlign: 'center',
  padding: '0.4rem 0.4rem',
  borderBottom: `1px solid ${THEME.bg}`,
};

const tdLeftStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'left',
};

const tdMonoStyle: CSSProperties = {
  ...tdStyle,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontWeight: 600,
  color: THEME.textPrimary,
};

const execButtonStyle: CSSProperties = {
  background: THEME.accent,
  color: '#fff',
  border: 'none',
  borderRadius: '0.3rem',
  padding: '0.32rem 0.7rem',
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

const execButtonPendingStyle: CSSProperties = {
  ...execButtonStyle,
  background: '#92400e' /* amber-800 */,
};

const emptyStyle: CSSProperties = {
  fontSize: '0.82rem',
  color: THEME.textMuted,
  padding: '0.5rem',
  textAlign: 'center',
};
