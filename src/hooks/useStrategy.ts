import { useEffect, useState } from 'react';
import type { StrategyData } from '../types/strategy';
import type { Scenario } from '../data/scenarios';
import { normalize, type RawStrategyFile } from '../utils/normalize';

export interface UseStrategyResult {
  data: StrategyData | null;
  loading: boolean;
  error: Error | null;
}

export function useStrategy(scenario: Scenario | null): UseStrategyResult {
  const [data, setData] = useState<StrategyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!scenario) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    fetch(scenario.path, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${scenario.path}: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<RawStrategyFile>;
      })
      .then((raw) => {
        setData(normalize(raw, scenario.id));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [scenario]);

  return { data, loading, error };
}
