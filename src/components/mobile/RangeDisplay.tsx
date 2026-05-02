import type { PositionSelection } from '../../types/mobile';

interface Props {
  selection: PositionSelection;
}

/**
 * Phase 2A スケルトン。Phase 2C で 13×13 レンジマトリクス + Aggregate バーを実装。
 * 現状は選択状態をデバッグ表示するだけ。
 */
export function RangeDisplay({ selection }: Props) {
  if (!selection.opener) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '2rem 0',
          color: '#b0a18e',
          fontSize: '13px',
        }}
      >
        ポジションを選択してください
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1rem',
        background: '#fefdf9',
        border: '1px solid #d6cfc1',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#6b5a48',
      }}
    >
      <div>選択状態 (Phase 2C で実装):</div>
      <div style={{ marginTop: '0.5rem', color: '#1e40af' }}>Opener: {selection.opener}</div>
      {selection.responder && (
        <div style={{ color: '#b91c1c' }}>Responder: {selection.responder}</div>
      )}
    </div>
  );
}
