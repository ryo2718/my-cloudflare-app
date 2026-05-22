// ノードの action_history (各ポジションのプリフロップアクション列) を読み込み、
// テーブル俯瞰図のテキストポップアップ + アニメーション用データに変換する。
//
// action_history の例 (ノード JSON game_info):
//   [{position:'UTG', action:'Raise 2.5'}, {position:'HJ', action:'Fold'},
//    {position:'SB', action:'Call'}, {position:'HJ', action:'Allin 100'}]
//   - 'Call' は直前までにレイズ/オールインが無ければ limp、あれば call。

import type { Position } from '../../types/strategy';
import { ACTION_COLOR } from '../../styles/actionColors';

const PREFLOP_DATA_ROOT = '/data/preflop/cash_100bb_6max_nl500_2.5x';

export type ActionKind = 'fold' | 'raise' | 'call' | 'limp' | 'allin';

export interface ActionItem {
  position: Position;
  kind: ActionKind;
  /** raise のベット額 (bb)。fold/call/limp/allin は undefined。 */
  amount?: number;
}

/** ポップアップの種別。アクション + ブラインド (強制ベット、白ラベル)。 */
export type PopupKind = ActionKind | 'blind';

export interface SeatPopup {
  position: Position;
  kind: PopupKind;
  label: string;
}

interface RawHistoryEntry {
  position: string;
  action: string;
}

/** "Raise 2.5" / "Fold" / "Call" / "Allin 100" の配列 → ActionItem[] (limp 判定込み)。 */
export function parseActionHistory(raw: ReadonlyArray<RawHistoryEntry>): ActionItem[] {
  let sawRaise = false;
  const out: ActionItem[] = [];
  for (const e of raw) {
    const parts = e.action.split(' ');
    const verb = parts[0];
    const amount = parts.length > 1 ? Number(parts[1]) : undefined;
    const position = e.position as Position;
    if (verb === 'Raise') {
      sawRaise = true;
      out.push({ position, kind: 'raise', amount });
    } else if (verb === 'Allin') {
      sawRaise = true;
      out.push({ position, kind: 'allin', amount });
    } else if (verb === 'Call') {
      out.push({ position, kind: sawRaise ? 'call' : 'limp' });
    } else if (verb === 'Check') {
      out.push({ position, kind: 'call' });
    } else {
      out.push({ position, kind: 'fold' });
    }
  }
  return out;
}

/** プリフロップのアクション順 (座席順)。 */
const SEAT_ORDER: ReadonlyArray<Position> = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/**
 * ヒーローの「現在の決断」より前のアクションだけに絞る。
 *
 * GTO ノードの action_history は、ヒーローより後ろの席のフォールドも
 * アイソレーション (他全員降ろし) として含むため、そのまま表示するとヒーロー以降まで出てしまう。
 *   - ヒーローが履歴に登場しない (= 最初の決断) → 座席順でヒーローより前の席のアクションのみ
 *   - ヒーローが履歴に登場する (= vs3bet/4bet 等の多ラウンド) → 全アクション (全て現決断より前)
 *
 * folded (= ノードの folded_positions) を渡すと、多ラウンドノードに限り、action_history に
 * fold が欠落している「過去に降りた席」(主に 3bettor より後ろの SB/BB) の fold を補完する。
 * これにより、降りた席が withBlinds で「生存中のブラインド」と誤表示されるのを防ぐ。
 */
export function actionsBeforeHero(
  items: ReadonlyArray<ActionItem>,
  hero: Position,
  folded: ReadonlyArray<Position> = [],
): ActionItem[] {
  if (items.some((it) => it.position === hero)) {
    // 多ラウンド (ヒーロー再判断)。folded_positions のうち履歴に登場しない席は
    // 「過去に降りた席」なので fold を補完する (chronologicalOrder が席順に並べる)。
    const present = new Set(items.map((it) => it.position));
    const synthesizedFolds: ActionItem[] = folded
      .filter((p) => !present.has(p))
      .map((p) => ({ position: p, kind: 'fold' as const }));
    return chronologicalOrder([...items, ...synthesizedFolds]);
  }
  // vs_open (ヒーロー初回行動)。ヒーローより後ろの席の fold は「未来」のため補完しない
  // (補完すると「後ろの席まで表示する」既知バグの再発になる)。
  const heroIdx = SEAT_ORDER.indexOf(hero);
  if (heroIdx < 0) return chronologicalOrder(items);
  return chronologicalOrder(items.filter((it) => SEAT_ORDER.indexOf(it.position) < heroIdx));
}

/**
 * アクション列を時系列 (ベッティングラウンド × 席順) に並べ直す。
 *
 * GTO ノードの action_history は後段のレイズ (3bet/4bet/5bet) を末尾にまとめて並べるため
 * (例: 「UTG open → CO/BTN/SB/BB fold → HJ 3bet」)、そのまま再生すると
 * 「全員フォールド後に HJ が 3bet」のように非時系列なアニメになる。
 * 各ポジションの N 回目アクションを席順に拾うことで、各ラウンドを席順に再構成する
 * (round0 = 各席の1回目を席順 = UTG open, HJ 3bet, …fold、round1 = 2回目 = UTG 4bet …)。
 */
function chronologicalOrder(items: ReadonlyArray<ActionItem>): ActionItem[] {
  const byPos = new Map<Position, ActionItem[]>();
  for (const it of items) {
    const arr = byPos.get(it.position);
    if (arr) arr.push(it);
    else byPos.set(it.position, [it]);
  }
  const out: ActionItem[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const pos of SEAT_ORDER) {
      const arr = byPos.get(pos);
      if (arr && arr.length > round) {
        out.push(arr[round]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

const cache: Record<string, ActionItem[]> = {};

/** ノードファイルの action_history を取得 (キャッシュ)。失敗時は空配列。 */
export async function loadActionHistory(file: string): Promise<ActionItem[]> {
  if (cache[file]) return cache[file];
  try {
    const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
    if (!res.ok) throw new Error(`failed ${file}`);
    const json = (await res.json()) as { game_info?: { action_history?: RawHistoryEntry[] } };
    const items = parseActionHistory(json.game_info?.action_history ?? []);
    cache[file] = items;
    return items;
  } catch {
    return [];
  }
}

const foldedCache: Record<string, Position[]> = {};

/** ノードファイルの folded_positions を取得 (キャッシュ)。失敗時は空配列。 */
export async function loadFoldedPositions(file: string): Promise<Position[]> {
  if (foldedCache[file]) return foldedCache[file];
  try {
    const res = await fetch(`${PREFLOP_DATA_ROOT}/${file}`);
    if (!res.ok) throw new Error(`failed ${file}`);
    const json = (await res.json()) as { game_info?: { folded_positions?: string[] } };
    const folded = (json.game_info?.folded_positions ?? []) as Position[];
    foldedCache[file] = folded;
    return folded;
  } catch {
    return [];
  }
}

function formatAmount(a: number): string {
  return Number.isInteger(a) ? String(a) : a.toFixed(1);
}

export function actionLabel(item: ActionItem): string {
  switch (item.kind) {
    case 'fold':
      return 'fold';
    case 'raise':
      return item.amount != null ? `raise ${formatAmount(item.amount)}` : 'raise';
    case 'call':
      return 'call';
    case 'limp':
      return 'limp';
    case 'allin':
      return 'allin';
  }
}

/**
 * ActionItem 列 → 各ポジションの「最新アクション」ポップアップ。
 * (同じポジションが複数回行動した場合は最後のものを表示。)
 */
export function toSeatPopups(items: ReadonlyArray<ActionItem>): SeatPopup[] {
  const latest = new Map<Position, ActionItem>();
  for (const it of items) latest.set(it.position, it);
  return [...latest.values()].map((it) => ({
    position: it.position,
    kind: it.kind,
    label: actionLabel(it),
  }));
}

export interface ActionColor {
  fg: string;
  bg: string;
  border: string;
}

/**
 * ポップアップ種別 → 色。アクションは中間色のベタ塗り + 白文字 (緑フェルトで映える)。
 * ブラインドのみ白地 + 黒文字 + 薄グレー枠。
 *   raise=赤 / allin=紫 / call・limp=緑 / fold=青 / blind=白
 */
export const ACTION_COLORS: Record<PopupKind, ActionColor> = {
  raise: { fg: '#FFFFFF', bg: ACTION_COLOR.raise, border: ACTION_COLOR.raise },
  allin: { fg: '#FFFFFF', bg: ACTION_COLOR.allin, border: ACTION_COLOR.allin },
  call: { fg: '#FFFFFF', bg: ACTION_COLOR.call, border: ACTION_COLOR.call },
  limp: { fg: '#FFFFFF', bg: ACTION_COLOR.limp, border: ACTION_COLOR.limp },
  fold: { fg: '#FFFFFF', bg: ACTION_COLOR.fold, border: ACTION_COLOR.fold },
  blind: { fg: '#2C2C2A', bg: '#FFFFFF', border: '#C9C7BD' },
};

/** ブラインドのラベル (強制ベット)。 */
export const BLIND_LABEL: Partial<Record<Position, string>> = { SB: '0.5bb', BB: '1bb' };

/**
 * アクションポップアップにブラインド (SB 0.5bb / BB 1bb) を重ねる。
 * すでにアクション済 (= actionPopups に含まれる) のブラインドは差し替え済なので出さない。
 */
export function withBlinds(actionPopups: ReadonlyArray<SeatPopup>): SeatPopup[] {
  const acted = new Set(actionPopups.map((p) => p.position));
  const blinds: SeatPopup[] = [];
  for (const pos of ['SB', 'BB'] as Position[]) {
    if (!acted.has(pos)) blinds.push({ position: pos, kind: 'blind', label: BLIND_LABEL[pos]! });
  }
  return [...blinds, ...actionPopups];
}

// アニメーションの待ち時間 (アクションを表示する前に待つ ms)。
// fold は速め、それ以外 (raise/call/limp/allin) はややタメる。
export const FOLD_DELAY_MS = 400;
export const OTHER_DELAY_MS = 600;

export function getActionDelay(kind: ActionKind): number {
  return kind === 'fold' ? FOLD_DELAY_MS : OTHER_DELAY_MS;
}

/** テスト用にキャッシュをクリア。 */
export function __resetActionHistoryCache(): void {
  for (const k of Object.keys(cache)) delete cache[k];
  for (const k of Object.keys(foldedCache)) delete foldedCache[k];
}
