interface Props {
  label: string;
}

/**
 * Solution 表示。Phase 2A 時点ではタップ無効 (将来の選択UI拡張に備えて見た目だけ)。
 * cursor:'default' + onClick 無し でセマンティクス上「ボタンではない」ことを示す。
 */
export function SolutionLabel({ label }: Props) {
  return (
    <div
      style={{
        background: '#f5efe5',
        borderRadius: '6px',
        padding: '8px 12px',
        marginBottom: '0.75rem',
        fontSize: '12px',
        color: '#6b5a48',
        cursor: 'default',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#b45309' }}>{label}</span>
      <span style={{ color: '#b0a18e' }}>▼</span>
    </div>
  );
}
