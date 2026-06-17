// Phase 2a: アクション連鎖 (canonical "F-F-R2.5" / R2 file stem "F_F_R2_5") の
// 変換と、ノードナビゲーション用の純関数。旧 scenarios.ts / nodePathFor には依存しない。

import type { PreflopV2Index, PreflopV2Node } from './types';

export const ROOT_STEM = 'root';

/** canonical chain ("F-F-R2.5" / "" = root) -> R2 file stem ("F_F_R2_5" / "root")。 */
export function chainToStem(chain: string): string {
  if (!chain) return ROOT_STEM;
  return chain.replace(/-/g, '_').replace(/\./g, '_');
}

/** 1 アクショントークン ("R13.1") -> stem 断片 ("R13_1")。 */
export function tokenToStem(token: string): string {
  return token.replace(/\./g, '_');
}

/** canonical chain -> 親ノードの stem。root の場合は null。 */
export function parentStem(chain: string): string | null {
  if (!chain) return null;
  const toks = chain.split('-');
  return chainToStem(toks.slice(0, -1).join('-'));
}

/** _meta.active_positions が無い config (nl50) では players から導出。 */
export function activePositions(node: PreflopV2Node): string[] {
  const ap = node._meta.active_positions;
  if (Array.isArray(ap) && ap.length > 0) return ap;
  const players = node.game_info.players ?? [];
  return players.filter((p) => !p.is_folded).map((p) => p.position);
}

/** ノードの actor (大文字ポジション)。 */
export function actorPosition(node: PreflopV2Node): string {
  return (node._meta.actor || '').toUpperCase();
}

export interface NextAction {
  /** legend のトークン ("F" / "R13.1" / "RAI")。 */
  token: string;
  /** 遷移先ノードの stem。 */
  childStem: string;
  /** legend ラベル ("raise (13.1bb)" 等)。 */
  actionLabel: string;
}

/**
 * 現ノードから遷移可能な次アクション一覧。actions_legend の各トークンのうち、
 * index に実在する子ノードを持つものだけを legend 順で返す (終端アクションは除外)。
 */
export function nextActions(node: PreflopV2Node, index: PreflopV2Index): NextAction[] {
  const stem = chainToStem(node._meta.preflop_actions);
  const children = new Set(index.nodes[stem] ?? []);
  const out: NextAction[] = [];
  for (const [token, actionLabel] of Object.entries(node.actions_legend)) {
    const frag = tokenToStem(token);
    const childStem = stem === ROOT_STEM ? frag : `${stem}_${frag}`;
    if (children.has(childStem)) out.push({ token, childStem, actionLabel });
  }
  return out;
}

/** breadcrumb 用: 1 トークンを読みやすいラベルに。 */
export function formatToken(token: string): string {
  if (token === 'F') return 'Fold';
  if (token === 'C') return 'Call';
  if (token === 'X') return 'Check';
  if (token === 'RAI') return 'All-in';
  const m = token.match(/^R(\d+(?:\.\d+)?)$/);
  if (m) return `Raise ${m[1]}bb`;
  return token;
}

/** canonical chain -> breadcrumb の各ステップラベル ([] = root)。 */
export function chainSteps(chain: string): string[] {
  if (!chain) return [];
  return chain.split('-').map(formatToken);
}
