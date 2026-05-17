// 軽量カスタムルーターの非 component API (useRoute / navigate)。
// Link コンポーネントは router.tsx 側 (react-refresh の only-export-components 規約回避)。

import { useEffect, useState } from 'react';

/** 現在の pathname を返す。`navigate` 経由 / ブラウザの戻る/進む両方に反応。 */
export function useRoute(): string {
  const [path, setPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname;
  });

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return path;
}

/** プログラム経由で URL 切替 (pushState + popstate event)。 */
export function navigate(to: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === to) return;
  window.history.pushState({}, '', to);
  // 自前で popstate を dispatch すると、subscribe してる useRoute() がすべて更新される。
  window.dispatchEvent(new PopStateEvent('popstate'));
}
