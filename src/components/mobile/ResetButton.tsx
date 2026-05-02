interface Props {
  onReset: () => void;
}

/** 画面下のリセットボタン。HOME と同じ動作 (全状態を初期化)。 */
export function ResetButton({ onReset }: Props) {
  return (
    <button
      type="button"
      onClick={onReset}
      style={{
        background: 'transparent',
        border: '1px solid #b8a888',
        borderRadius: '6px',
        padding: '10px',
        fontSize: '12px',
        color: '#6b5a48',
        textAlign: 'center',
        marginTop: '1rem',
        width: '100%',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      リセット
    </button>
  );
}
