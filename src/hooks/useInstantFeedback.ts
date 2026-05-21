// 即時フィードバックトグルの状態 (localStorage 永続化)。
import { useCallback, useState } from 'react';
import { loadInstantFeedback, saveInstantFeedback } from '../data/userPreferences';

export function useInstantFeedback(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => loadInstantFeedback());
  const set = useCallback((v: boolean) => {
    setOn(v);
    saveInstantFeedback(v);
  }, []);
  return [on, set];
}
