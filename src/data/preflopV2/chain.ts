// Phase 2a: アクション連鎖 (canonical "F-F-R2.5" / R2 file stem "F_F_R2_5") の
// 変換と、ノードナビゲーション用の純関数。旧 scenarios.ts / nodePathFor には依存しない。

import type { PreflopV2Index, PreflopV2Node } from './types';

export const ROOT_STEM = 'root';

export const SEAT_ORDER = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Seat = (typeof SEAT_ORDER)[number];

/** チェーン中の raise 回数 (RAI=allin は除く)。 */
export function countRaisesInChain(chain: string): number {
  if (!chain) return 0;
  return chain.split('-').filter((t) => t.startsWith('R') && t !== 'RAI').length;
}

/** raise の名称: 直前までの raise 回数から (0→open, 1→3bet, 2→4bet, 3→5bet, ...)。 */
export function raiseName(priorRaises: number): string {
  return priorRaises === 0 ? 'open' : `${priorRaises + 2}bet`;
}

export type ActionKind = 'fold' | 'call' | 'limp' | 'raise' | 'allin';

export interface SeatAction {
  seat: Seat;
  token: string;
  kind: ActionKind;
  /** raise/allin の表示名 (open/3bet/.../All-in)。それ以外は undefined。 */
  raiseLabel?: string;
}

interface SimResult {
  /** 各トークンを着席順に割り当てた結果。 */
  actions: SeatAction[];
  /** 全トークン消費後に次に行動する席 (= ノードの actor)。closed なら null。 */
  nextToAct: Seat | null;
}

/**
 * プリフロップのアクション順を厳密にシミュレートし、チェーンの各トークンを席に割り当てる。
 * マルチウェイ・再レイズ (action の再オープン)・BB オプションに対応。
 * 検証: 全 gto ノードで nextToAct === _meta.actor / folded === players.is_folded を確認済み。
 */
export function simulateChain(chain: string): SimResult {
  const tokens = chain ? chain.split('-') : [];
  const folded = new Set<Seat>();
  const committed: Record<Seat, number> = { UTG: 0, HJ: 0, CO: 0, BTN: 0, SB: 0.5, BB: 1 };
  const actedSinceRaise = new Set<Seat>();
  let bet = 1; // BB
  let raisesSoFar = 0;
  const actions: SeatAction[] = [];

  const nextToActFrom = (fromIdx: number): Seat | null => {
    for (let k = 1; k <= SEAT_ORDER.length; k++) {
      const seat = SEAT_ORDER[(fromIdx + k) % SEAT_ORDER.length];
      if (folded.has(seat)) continue;
      if (committed[seat] < bet) return seat; // まだ bet に満たない
      if (!actedSinceRaise.has(seat)) return seat; // 未行動 (BB オプション/リンプ周回)
    }
    return null;
  };

  // 最初の行動者は UTG (index 0)。fromIdx=-1 から探索開始。
  let toAct: Seat | null = nextToActFrom(-1);
  for (const token of tokens) {
    const seat: Seat = toAct ?? 'UTG';
    let kind: ActionKind;
    let raiseLabel: string | undefined;
    if (token === 'F') {
      kind = 'fold';
      folded.add(seat);
      actedSinceRaise.add(seat);
    } else if (token === 'C' || token === 'X') {
      // raise がまだ無い状態の C は limp (SB コンプリート等)
      kind = raisesSoFar === 0 ? 'limp' : 'call';
      committed[seat] = bet;
      actedSinceRaise.add(seat);
    } else if (token === 'RAI') {
      kind = 'allin';
      raiseLabel = 'All-in';
      bet = Math.max(bet, committed[seat] + 1);
      committed[seat] = bet;
      raisesSoFar += 1;
      actedSinceRaise.clear();
      actedSinceRaise.add(seat);
    } else {
      // R<size>
      kind = 'raise';
      raiseLabel = raiseName(raisesSoFar);
      const m = token.match(/^R(\d+(?:\.\d+)?)$/);
      const size = m ? Number(m[1]) : bet + 1;
      bet = size;
      committed[seat] = size;
      raisesSoFar += 1;
      actedSinceRaise.clear();
      actedSinceRaise.add(seat);
    }
    actions.push({ seat, token, kind, raiseLabel });
    toAct = nextToActFrom(SEAT_ORDER.indexOf(seat));
  }
  return { actions, nextToAct: toAct };
}

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

/**
 * ノードの actor (大文字ポジション)。
 * 注: _meta.actor はマルチウェイで誤ラベルがあるため使わない。players の is_hero/
 * is_active が正 (全 gto ノードで betting-order シミュレーションと一致確認済み)。
 * フォールバックでシミュレーション結果を使う。
 */
export function actorPosition(node: PreflopV2Node): string {
  const players = node.game_info.players ?? [];
  const hero = players.find((p) => p.is_hero || p.is_active);
  if (hero && (SEAT_ORDER as readonly string[]).includes(hero.position)) {
    return hero.position;
  }
  return simulateChain(node._meta.preflop_actions).nextToAct ?? '';
}

/** リンプ可能ノード: まだ誰も raise しておらず actor が call (C) できる (= SB コンプリート等)。 */
export function isLimpNode(node: PreflopV2Node): boolean {
  return 'C' in node.actions_legend && countRaisesInChain(node._meta.preflop_actions) === 0;
}

/**
 * 自動補完: 現チェーンから targetSeat が actor になるまで「間の席を全員 fold」した
 * ノードの stem を返す (index に実在する場合のみ)。targetSeat が現 actor より手前 /
 * 到達不能なら null。
 */
export function foldAroundStem(
  chain: string,
  targetSeat: Seat,
  index: PreflopV2Index,
): string | null {
  let cur = chain;
  for (let i = 0; i <= SEAT_ORDER.length; i++) {
    const sim = simulateChain(cur);
    if (sim.nextToAct === targetSeat) {
      const stem = chainToStem(cur);
      return stem in index.nodes ? stem : null;
    }
    if (sim.nextToAct === null) return null;
    cur = cur ? `${cur}-F` : 'F';
  }
  return null;
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

/**
 * 現ノード(canonical chain)で actor が token のアクションを取った後の遷移先 stem を返す。
 * 直後のノードが存在しない (single-villain データで中間 fold ノードが欠ける) 場合は、
 * 次の手番が fold した連鎖を辿り、最寄りの実在ノードへスキップ接続する。
 * 実在ノードに到達できなければ null (= タップ無効)。
 */
export function resolveChild(
  chain: string,
  token: string,
  index: PreflopV2Index,
): string | null {
  let c = chain ? `${chain}-${token}` : token;
  for (let guard = 0; guard <= SEAT_ORDER.length; guard++) {
    const stem = chainToStem(c);
    if (stem in index.nodes) return stem;
    c = `${c}-F`; // 次の手番が fold した先へ
  }
  return null;
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
