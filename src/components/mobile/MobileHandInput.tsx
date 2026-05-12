import { useEffect, useState, type CSSProperties } from 'react';
import {
  isInvalidInput,
  parseHandInput,
  type HandNotation,
} from '../../utils/handNotation';

interface Props {
  /** 169 hand notation を返す。incomplete / invalid は null。 */
  onChange?: (notation: HandNotation | null) => void;
  /** 親が初期/制御値を渡す場合の生入力文字列。 */
  value?: string;
}

const RANKS_TOP = ['A', 'K', 'Q', 'J', 'T', '9', '8'] as const;
const RANKS_BOTTOM = ['7', '6', '5', '4', '3', '2'] as const;

/**
 * モバイル版 Hand Input。
 *  - パース/状態管理は PC版 HandInput と同等 (parseHandInput/isInvalidInput を共有)
 *  - キーボードは 7+6 行のランクのみ。スートボタン (♠♥♦♣) は廃止 (combo入力不可)
 *  - s / o (suited/offsuit) と Backspace / Clear は残す
 *  - スマホ画面 (375px 想定) で横にハミ出さない
 */
export function MobileHandInput({ onChange, value }: Props) {
  const [text, setText] = useState<string>(value ?? '');

  useEffect(() => {
    // 親 prop の変化を internal text state に反映する controlled-input パターン。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value !== undefined) setText(value);
  }, [value]);

  const updateText = (next: string) => {
    setText(next);
    onChange?.(parseHandInput(next));
  };

  // 入力欄は表示専用 (div) — OS キーボードを抑制し、オンスクリーンキーボードのみで操作。
  // input ref / handleInputChange は不要 (focus 不要)。
  const handleAppend = (c: string) => updateText(text + c);
  const handleBackspace = () => updateText(text.slice(0, -1));
  const handleClear = () => updateText('');

  const notation = parseHandInput(text);
  const showError = isInvalidInput(text);
  const PLACEHOLDER = '例: AKs / AKo / AA';

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>Hand Input</div>

      {/* 表示専用 (タップしても OS キーボードが出ない) */}
      <div
        role="textbox"
        aria-readonly="true"
        style={{
          ...inputStyle,
          borderColor: showError ? '#ef4444' : '#d6cfc1',
          color: text ? '#3d2f1f' : '#b0a18e',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          minHeight: '1.4em',
          cursor: 'default',
        }}
      >
        {text || PLACEHOLDER}
      </div>

      <NotationFeedback notation={notation} showError={showError} />

      {/* ランクキーボード 7 + 6 (画面幅 375px に収まる) */}
      <div style={rankRowStyle}>
        {RANKS_TOP.map((r) => (
          <KeyButton key={r} label={r} onClick={() => handleAppend(r)} />
        ))}
      </div>
      <div style={rankRowStyle}>
        {RANKS_BOTTOM.map((r) => (
          <KeyButton key={r} label={r} onClick={() => handleAppend(r)} />
        ))}
        {/* 7列目を空セルで埋めて grid を整える */}
        <span aria-hidden style={{ visibility: 'hidden' }} />
      </div>

      {/* s / o */}
      <div style={twoColRow}>
        <KeyButton label="s" onClick={() => handleAppend('s')} title="suited" />
        <KeyButton label="o" onClick={() => handleAppend('o')} title="offsuit" />
      </div>

      {/* Backspace / Clear */}
      <div style={twoColRow}>
        <KeyButton label="⌫ Backspace" onClick={handleBackspace} wide />
        <KeyButton label="Clear" onClick={handleClear} wide />
      </div>
    </div>
  );
}

function NotationFeedback({
  notation,
  showError,
}: {
  notation: HandNotation | null;
  showError: boolean;
}) {
  if (showError) {
    return <span style={{ fontSize: '12px', color: '#b91c1c' }}>✕ 無効なハンド入力です</span>;
  }
  return (
    <span
      style={{
        fontSize: '12px',
        color: notation ? '#3d2f1f' : '#b0a18e',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      }}
    >
      {notation ? `= ${notation} ✓` : '= —'}
    </span>
  );
}

function KeyButton({
  label,
  onClick,
  title,
  wide,
}: {
  label: string;
  onClick: () => void;
  title?: string;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      onMouseDown={(e) => e.preventDefault()} // 入力欄から focus を奪わない
      style={{
        background: '#fefdf9',
        border: '1px solid #d6cfc1',
        borderRadius: '6px',
        color: '#3d2f1f',
        fontSize: wide ? '13px' : '15px',
        fontWeight: 500,
        padding: wide ? '12px 0' : '14px 0',
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
      }}
    >
      {label}
    </button>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  background: '#faf6f0',
  padding: '12px',
  border: '1px solid #d6cfc1',
  borderRadius: '8px',
};

const labelStyle: CSSProperties = {
  fontSize: '11px',
  color: '#8c7d6a',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const inputStyle: CSSProperties = {
  background: '#f5efe5',
  border: '1px solid #d6cfc1',
  borderRadius: '6px',
  color: '#3d2f1f',
  padding: '10px 12px',
  fontSize: '16px', // iOS が auto-zoom しないように 16px 以上
  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const rankRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, 1fr)',
  gap: '4px',
};

const twoColRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '8px',
};
