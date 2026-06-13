// 肩書きバッジ (CSS ピル)。保存済みアカウントカードとランキングで共通利用。
//
// 配色は actionColors (allin 紫 / raise 赤 / call 緑 / fold 青) と衝突しない
// 金・グレー・ティールを使用 (theme とは別のローカル定数)。絵文字は使わない。

import { type CSSProperties } from 'react';

export type RoleBadgeKind = 'admin' | 'tester' | 'vip';

const LABEL: Record<RoleBadgeKind, string> = {
  admin: 'ADMIN',
  tester: 'TESTER',
  vip: 'VIP',
};

const VARIANT: Record<RoleBadgeKind, CSSProperties> = {
  admin: { background: '#f4ead0', borderColor: '#b8901f', color: '#6f5410' },
  tester: { background: '#e9e7e2', borderColor: '#9a9286', color: '#57503f' },
  vip: { background: '#d6eef0', borderColor: '#0e7490', color: '#155e75' },
};

export function RoleBadge({ kind }: { kind: RoleBadgeKind }) {
  return <span style={{ ...badgeStyle, ...VARIANT[kind] }}>{LABEL[kind]}</span>;
}

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: 'solid',
  fontSize: '0.66rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
};
