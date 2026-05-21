// ノードの action_history (各ポジションのプリフロップアクション列) を読み込み、
// テーブル俯瞰図のテキストポップアップ + アニメーション用データに変換する。
//
// action_history の例 (ノード JSON game_info):
//   [{position:'UTG', action:'Raise 2.5'}, {position:'HJ', action:'Fold'},
//    {position:'SB', action:'Call'}, {position:'HJ', action:'Allin 100'}]
//   - 'Call' は直前までにレイズ/オールインが無ければ limp、あれば call。

import type { Position } from '../../types/strategy';

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
 * ポップアップ種別 → 色。淡いパステル背景 + 濃い文字 + 控えめな枠線
 * (テーブルの緑から浮きすぎず、文字は読みやすく)。
 *   raise=淡赤 / allin=淡紫 / call・limp=淡緑 / fold=淡青 / blind=白
 */
export const ACTION_COLORS: Record<PopupKind, ActionColor> = {
  raise: { fg: '#993C1D', bg: '#FAECE7', border: '#EBC9BE' },
  allin: { fg: '#2E2A6B', bg: '#ECEAF7', border: '#D3CEEE' },
  call: { fg: '#27500A', bg: '#E8F0DA', border: '#CFE0B4' },
  limp: { fg: '#27500A', bg: '#E8F0DA', border: '#CFE0B4' },
  fold: { fg: '#0C447C', bg: '#E6F1FB', border: '#C3DDF4' },
  blind: { fg: '#2C2C2A', bg: '#FFFFFF', border: '#D3D1C7' },
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
}
