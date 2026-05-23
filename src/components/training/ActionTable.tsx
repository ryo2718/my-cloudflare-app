// テーブル俯瞰図 + アクションのテキストポップアップ表示。
//   - file の action_history を読み込み、各座席のアクションをポップアップ表示
//   - animate=true: 0.2 秒間隔で順次表示し、全アクション再生後に onAnimationDone を呼ぶ
//     (ヒーローの番 = 制限時間スタートのトリガに使う)
//   - animate=false: 全アクションを即時表示 (振り返り / 答え合わせ画面)
//   - resetKey を変えると (問題切替) アニメを最初から再生

import { useEffect, useRef, useState } from 'react';
import type { Position } from '../../types/strategy';
import {
  loadActionHistory,
  loadFoldedPositions,
  actionsBeforeHero,
  toSeatPopups,
  withBlinds,
  getActionDelay,
  type ActionItem,
} from '../../data/training/actionHistory';
import { PokerTable } from './PokerTable';

export interface ActionTableProps {
  /** 対象ノードのファイル名 (例: 'utgr_hjr_utg.json')。null/未指定なら空テーブル (items 指定時は不要)。 */
  file?: string | null;
  mePosition: Position;
  /** true: 0.2 秒間隔アニメ。false: 即時全表示。 */
  animate?: boolean;
  /** アニメ完了 (ヒーローの番に到達) で呼ばれる。 */
  onAnimationDone?: () => void;
  /** 問題切替でアニメを再生し直すためのキー。 */
  resetKey?: string | number;
  /**
   * 直接アクション列を渡す (フロップ等、preflop ノード由来でない局面用)。
   * 指定時は file からの読み込み・actionsBeforeHero を行わず、この列をそのまま再生する。
   */
  items?: ReadonlyArray<ActionItem>;
}

export function ActionTable({
  file,
  mePosition,
  animate = false,
  onAnimationDone,
  resetKey,
  items: providedItems,
}: ActionTableProps) {
  // items===null は「未ロード」(アニメ判定を保留)。配列はロード完了 (空も含む)。
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const doneRef = useRef(onAnimationDone);
  useEffect(() => {
    doneRef.current = onAnimationDone;
  }, [onAnimationDone]);

  // action_history の読み込み (file 単位)。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    // items 直接指定時は読み込み不要 (フロップ等)。そのまま再生する。
    if (providedItems) {
      setItems([...providedItems]);
      return;
    }
    setItems(null); // 新しい file をロード中は未ロード扱いにする
    if (!file) {
      setItems([]);
      return;
    }
    Promise.all([loadActionHistory(file), loadFoldedPositions(file)]).then(([loaded, folded]) => {
      // ヒーロー以降の席を除外 + 多ラウンドノードでは欠落した過去の fold を補完。
      if (!cancelled) setItems(actionsBeforeHero(loaded, mePosition, folded));
    });
    return () => {
      cancelled = true;
    };
  }, [file, mePosition, providedItems]);

  // アニメーション (items ロード後、items / animate / resetKey が変わるたび再生)。
  useEffect(() => {
    if (items === null) return; // ロード待ち
    if (!animate) {
      setRevealed(items.length);
      doneRef.current?.();
      return;
    }
    setRevealed(0);
    if (items.length === 0) {
      doneRef.current?.();
      return;
    }
    // 各アクションを表示する前に、そのアクション種別に応じた待ち時間を入れる
    // (fold=0.4秒 / それ以外=0.6秒)。setTimeout を連鎖させる。
    let i = 0;
    let cancelled = false;
    let timer = 0;
    const scheduleNext = () => {
      if (i >= items.length) {
        doneRef.current?.();
        return;
      }
      const delay = getActionDelay(items[i].kind);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        i += 1;
        setRevealed(i);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [items, animate, resetKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ブラインド (SB 0.5bb / BB 1bb) は最初から表示。アクションした SB/BB はそのラベルに差し替え。
  const popups = withBlinds(items ? toSeatPopups(items.slice(0, revealed)) : []);
  return <PokerTable mePosition={mePosition} popups={popups} />;
}
