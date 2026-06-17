// Phase 2a: ポジション選択画面。選んだ config の index.entries から、各ポジションの
// 開始ノードへ遷移する。entry が無いポジションは無効表示。

import { type CSSProperties } from 'react';
import { Link } from '../../router/router';
import { navigate } from '../../router/router-core';
import { THEME } from '../../styles/theme';
import { findConfig } from '../../data/preflopV2/configs';
import { usePreflopIndex } from '../../hooks/usePreflopStrategy';

export function PositionPicker({ config }: { config: string }) {
  const cfg = findConfig(config);
  const { data: index, loading, error } = usePreflopIndex(cfg ? config : null);

  if (!cfg) {
    return <NotFound message={`未知の config: ${config}`} />;
  }
  if (loading) return <p style={infoStyle}>読み込み中…</p>;
  if (error || !index) {
    return <NotFound message="データを取得できませんでした (R2 未アップロードの可能性)" />;
  }

  return (
    <div>
      <h1 style={titleStyle}>{cfg.label}</h1>
      <p style={subtitleStyle}>ポジションを選択</p>
      <nav style={gridStyle} aria-label="ポジション選択">
        {index.positionOrder.map((pos) => {
          const stem = index.entries[pos];
          if (!stem) {
            return (
              <span key={pos} style={{ ...cellStyle, ...disabledStyle }} aria-disabled>
                {pos}
              </span>
            );
          }
          return (
            <Link key={pos} to={`/strategy-v2/${config}/${stem}`} style={cellStyle}>
              {pos}
            </Link>
          );
        })}
      </nav>
      <button type="button" style={backStyle} onClick={() => navigate('/strategy-v2')}>
        ← コンフィグ選択へ
      </button>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div>
      <p style={infoStyle}>{message}</p>
      <button type="button" style={backStyle} onClick={() => navigate('/strategy-v2')}>
        ← コンフィグ選択へ
      </button>
    </div>
  );
}

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.3rem',
  fontWeight: 700,
  color: THEME.textPrimary,
  textAlign: 'center',
};
const subtitleStyle: CSSProperties = {
  margin: '0.3rem 0 1.2rem',
  fontSize: '0.85rem',
  color: THEME.textSecondary,
  textAlign: 'center',
};
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '0.7rem',
};
const cellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#fff',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.7rem',
  minHeight: 64,
  fontSize: '1.1rem',
  fontWeight: 700,
  color: THEME.accent,
  textDecoration: 'none',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
const disabledStyle: CSSProperties = {
  color: THEME.textFaint,
  background: THEME.cellEmpty,
  boxShadow: 'none',
};
const infoStyle: CSSProperties = {
  textAlign: 'center',
  color: THEME.textSecondary,
  padding: '1.5rem 0',
};
const backStyle: CSSProperties = {
  display: 'block',
  margin: '1.4rem auto 0',
  padding: '0.6rem 1rem',
  minHeight: 44,
  background: 'transparent',
  border: `1.5px solid ${THEME.border}`,
  borderRadius: '0.6rem',
  color: THEME.textSecondary,
  fontSize: '0.9rem',
  cursor: 'pointer',
};
