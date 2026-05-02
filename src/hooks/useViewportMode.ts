import { useEffect, useState } from 'react';

export type ViewportMode = 'pc' | 'mobile';

const STORAGE_KEY = 'viewport_mode_override';
const MOBILE_BREAKPOINT = '(max-width: 767px)';

/**
 * 画面サイズ × 手動オーバーライドから「実効モード」を返すフック。
 * - 画面幅 < 768px → 自動で 'mobile'
 * - 画面幅 >= 768px → 自動で 'pc'
 * - ユーザーが toggle() で手動切替すると localStorage に保存され、自動判定を上書き
 * - isAuto: 現在のモードが自動判定によるものか (= 手動オーバーライドが無いか)
 *
 * SSR セーフではない (window 直接参照)。本プロジェクトはクライアント完結なのでOK。
 */
export function useViewportMode(): {
  mode: ViewportMode;
  toggle: () => void;
  isAuto: boolean;
} {
  // 手動オーバーライド: 'pc' | 'mobile' | null (null = 自動)
  const [override, setOverride] = useState<ViewportMode | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'pc' || stored === 'mobile' ? stored : null;
    } catch {
      return null;
    }
  });

  // matchMedia ベースの自動判定
  const [autoMode, setAutoMode] = useState<ViewportMode>(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT).matches
      ? 'mobile'
      : 'pc',
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(MOBILE_BREAKPOINT);
    const handler = (e: MediaQueryListEvent) => {
      setAutoMode(e.matches ? 'mobile' : 'pc');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const mode: ViewportMode = override ?? autoMode;

  const toggle = () => {
    const next: ViewportMode = mode === 'pc' ? 'mobile' : 'pc';
    setOverride(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage 不可な環境は state だけ更新 */
    }
  };

  return { mode, toggle, isAuto: override === null };
}
