import { THEME } from '../styles/theme';

interface Props {
  label: string;
  enabled: boolean;
  onClick?: () => void;
  /** enabled 時の背景色・枠色 (FIXED_ACTIONS のアクション色と揃える)。 */
  enabledColor: string;
  /** ホバー時のツールチップ。enabled / disabled でメッセージを分ける。 */
  enabledTitle: string;
  disabledTitle: string;
}

/**
 * アクション遷移ボタン (Raise / All-in 共通)。
 * enabled 時は色付き、disabled 時はカード地のグレー化。
 */
export function ActionButton({
  label,
  enabled,
  onClick,
  enabledColor,
  enabledTitle,
  disabledTitle,
}: Props) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={enabled ? onClick : undefined}
      title={enabled ? enabledTitle : disabledTitle}
      style={{
        padding: '0.5rem 1rem',
        background: enabled ? enabledColor : THEME.cardElevated,
        color: enabled ? '#fff' : THEME.textMuted,
        border: `1px solid ${enabled ? enabledColor : THEME.border}`,
        borderRadius: '0.375rem',
        cursor: enabled ? 'pointer' : 'not-allowed',
        fontSize: '0.825rem',
        fontWeight: 600,
        opacity: enabled ? 1 : 0.55,
      }}
    >
      {label} ▸
    </button>
  );
}
