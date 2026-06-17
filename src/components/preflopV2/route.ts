// Phase 2a: /strategy-v2 の pathname 解析 (component と分離して fast-refresh 規約を満たす)。

/** "/strategy-v2/a/b" -> ["a","b"] (decode 済、空要素除去)。 */
export function segmentsAfterBase(path: string): string[] {
  const rest = path.replace(/^\/strategy-v2\/?/, '');
  if (!rest) return [];
  return rest
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}
