// PositionActionGrid のセル判定 (純ロジック、React 非依存)。
// 全6ポジション (UTG/HJ/CO/BTN/SB/BB) × 4選択肢 (allin/raise/call|limp/fold) を、
// 「現在誰の手番か」に依存せず席ごとに独立して判定する。
//   - foldAround で その席が手番になるノードを引き、実在すれば選択肢セル (色付き/タップ可)。
//   - そのアクションがデータに無ければグレーアウト。
//   - もう手番が回らない行動済み / 降りた席は、確定アクションを該当行に 1 セルのみ表示。
// 行き先は「間の席を全員 fold」で自動補完されるため、間のポジションを 1 つずつ押す必要はない。

import {
  SEAT_ORDER,
  type Seat,
  type ActionKind,
  actorPosition,
  countRaisesInChain,
  foldAroundTarget,
  raiseName,
  simulateChain,
} from './chain';
import type { PreflopV2Index, PreflopV2Node } from './types';

/** 行の固定順 (上→下)。call 行は limp ノードで "limp" 表示。 */
export const ROW_KINDS: ActionKind[] = ['allin', 'raise', 'call', 'fold'];

export interface Cell {
  kind: 'empty' | 'committed' | 'action' | 'grey';
  label?: string;
  actionKind?: ActionKind; // 色決定用
  toStem?: string | null;
}

export interface GridColumn {
  seat: Seat;
  cells: Cell[];
}

function classifyToken(token: string): ActionKind {
  if (token === 'F') return 'fold';
  if (token === 'RAI') return 'allin';
  if (token === 'C' || token === 'X') return 'call';
  return 'raise';
}

function sizeOf(token: string): number {
  const m = token.match(/^R(\d+(?:[._]\d+)?)$/);
  return m ? Number(m[1].replace('_', '.')) : 0;
}

/** 各ポジション × 各アクションのセルを構築する。 */
export function buildGridColumns(node: PreflopV2Node, index: PreflopV2Index): GridColumn[] {
  const chain = node._meta.preflop_actions;
  const sim = simulateChain(chain);
  const actor = actorPosition(node) as Seat;

  // 確定アクション (最新)。
  const committed = new Map<Seat, { kind: ActionKind; label: string }>();
  for (const a of sim.actions) {
    const label = a.kind === 'raise' || a.kind === 'allin' ? a.raiseLabel ?? a.kind : a.kind;
    committed.set(a.seat, { kind: a.kind, label });
  }

  return SEAT_ORDER.map<GridColumn>((seat) => {
    const target = foldAroundTarget(chain, seat, index);
    const map: Record<string, string> = target ? index.nodes[target.stem] ?? {} : {};
    const hasOptions = Object.keys(map).length > 0;
    const done = seat !== actor ? committed.get(seat) : undefined;

    if (!hasOptions && done) {
      // これ以上手番が回らない確定 / 降りた列: 該当行のみ 1 セル。
      const cells = ROW_KINDS.map<Cell>((rowKind) => {
        const matches =
          rowKind === 'call' ? done.kind === 'call' || done.kind === 'limp' : rowKind === done.kind;
        if (!matches) return { kind: 'empty' };
        const label = done.kind === 'limp' ? 'limp' : done.label;
        // fold (= 降りた/auto) はグレー、それ以外は確定色。
        if (done.kind === 'fold') return { kind: 'grey', label: 'fold' };
        return { kind: 'committed', actionKind: done.kind, label };
      });
      return { seat, cells };
    }

    // raise 名は遷移先ノード基準で決める (fold 補完は raise 回数を変えないが、
    // 再手番の列も同じ式で正しく 4bet/5bet になる)。
    const priorRaises = countRaisesInChain(target ? target.chain : chain);
    const limp = priorRaises === 0;
    const cells = ROW_KINDS.map<Cell>((rowKind) => {
      // この行に該当するアクショントークン (raise は最小サイズを代表)。
      const tokens = Object.keys(map)
        .filter((t) => classifyToken(t) === rowKind)
        .sort((a, b) => sizeOf(a) - sizeOf(b));
      let label: string;
      if (rowKind === 'allin') label = 'All-in';
      else if (rowKind === 'raise') label = raiseName(priorRaises);
      else if (rowKind === 'call') label = limp ? 'limp' : 'call';
      else label = 'fold';
      if (tokens.length === 0) return { kind: 'grey', label };
      return {
        kind: 'action',
        actionKind: rowKind === 'call' && limp ? 'limp' : rowKind,
        label,
        toStem: map[tokens[0]],
      };
    });
    return { seat, cells };
  });
}
