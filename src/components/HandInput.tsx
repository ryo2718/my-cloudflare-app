import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { THEME } from '../styles/theme';
import {
  isInvalidInput,
  parseHandInput,
  type HandNotation,
} from '../utils/handNotation';
import { HandKeyboard } from './HandKeyboard';

interface Props {
  /** 169 hand notation を返す。incomplete / invalid は null。 */
  onChange?: (notation: HandNotation | null) => void;
  /** 親が初期/制御値を渡す場合の生入力文字列。 */
  value?: string;
}

/**
 * combo ("AhKs") と 169 ("AKs") の両方を受け付けるハンド入力。
 * - 入力欄: 物理キーボードでの直接入力 (大小文字許容)
 * - スクリーンキーボード: ランク13 + スート4 + タイプ2 + Backspace/Clear
 * - 入力ごとに parseHandInput → onChange(notation | null) を発火
 * - 4文字以上で parse 失敗時のみエラー表示
 */
export function HandInput({ onChange, value }: Props) {
  const [text, setText] = useState<string>(value ?? '');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 親が value を制御する場合の sync
  useEffect(() => {
    // 親 prop の変化を internal text state に反映する controlled-input パターン。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value !== undefined) setText(value);
  }, [value]);

  const updateText = (next: string) => {
    setText(next);
    onChange?.(parseHandInput(next));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateText(e.target.value);
  };

  const handleAppend = (c: string) => {
    // 入力欄に focus を戻して append (text input と一体感を出す)
    updateText(text + c);
    inputRef.current?.focus();
  };

  const handleBackspace = () => {
    updateText(text.slice(0, -1));
    inputRef.current?.focus();
  };

  const handleClear = () => {
    updateText('');
    inputRef.current?.focus();
  };

  const notation = parseHandInput(text);
  const showError = isInvalidInput(text);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        background: THEME.bg,
        padding: '0.75rem',
        border: `1px solid ${THEME.border}`,
        borderRadius: '0.5rem',
        maxWidth: '640px',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          color: THEME.textMuted,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        Hand Input
      </div>

      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleInputChange}
        placeholder="例: AKs / AhKs / 98s / 9h7h"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        style={{
          background: THEME.cardElevated,
          border: `1px solid ${showError ? THEME.errorBorder : THEME.border}`,
          borderRadius: '0.375rem',
          color: THEME.textPrimary,
          padding: '0.5rem 0.7rem',
          fontSize: '1.05rem',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      <NotationFeedback notation={notation} showError={showError} />

      <HandKeyboard
        onAppend={handleAppend}
        onBackspace={handleBackspace}
        onClear={handleClear}
      />
    </div>
  );
}

function NotationFeedback({ notation, showError }: { notation: HandNotation | null; showError: boolean }) {
  if (showError) {
    return (
      <span style={{ fontSize: '0.78rem', color: THEME.errorText }}>
        ✕ 無効なハンド入力です
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: '0.85rem',
        color: notation ? THEME.textPrimary : THEME.textFaint,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      }}
    >
      {notation ? `= ${notation} ✓` : '= —'}
    </span>
  );
}
