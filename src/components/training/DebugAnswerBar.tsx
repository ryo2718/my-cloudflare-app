// admin 専用デバッグバー: ワンタップで全問を一括解答 (全問正解 / 全問不正解 / ランダム)。
// 各プレイ画面のヘッダー下に置く。非 admin には何も描画しない。

import { type CSSProperties } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function DebugAnswerBar({
  onCorrect,
  onWrong,
  onRandom,
}: {
  onCorrect: () => void;
  onWrong: () => void;
  onRandom: () => void;
}) {
  const auth = useAuth();
  if (!auth.account?.is_admin) return null;
  return (
    <div style={barStyle} aria-label="デバッグ (admin)">
      <span style={labelStyle}>DEBUG</span>
      <button type="button" style={btnStyle} onClick={onCorrect}>全問正解</button>
      <button type="button" style={btnStyle} onClick={onWrong}>全問不正解</button>
      <button type="button" style={btnStyle} onClick={onRandom}>ランダム</button>
    </div>
  );
}

const barStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
  marginTop: '0.2rem', padding: '0.3rem 0.4rem', background: '#FDF3F2',
  border: '1px dashed #E0A6A2', borderRadius: '0.35rem',
};
const labelStyle: CSSProperties = { fontSize: '0.65rem', fontWeight: 800, color: '#B23B33', letterSpacing: '0.06em' };
const btnStyle: CSSProperties = {
  padding: '0.25rem 0.6rem', background: '#fff', color: '#B23B33', border: '1px solid #E0A6A2',
  borderRadius: '0.3rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
