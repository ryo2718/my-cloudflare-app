// <Link> コンポーネント。useRoute / navigate は ./router-core を参照。
// 再 export は呼び出し側の import パス互換のため残す。

import { type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { navigate } from './router-core';

/** クリックで navigate に変換する <a> ラッパー (アクセシビリティ的にも anchor を保つ)。 */
export function Link({
  to,
  children,
  style,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 修飾キー押下時 / 中クリック等はブラウザのデフォルト動作 (新タブ等) に任せる
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
    onClick?.();
  };
  return (
    <a href={to} onClick={handleClick} style={style} className={className}>
      {children}
    </a>
  );
}
