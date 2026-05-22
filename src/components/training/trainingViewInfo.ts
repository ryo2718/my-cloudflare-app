// 「問題 → 標準ビュー一式 (ActionTable / NodeRangeSection) に必要な情報」を返す共通アダプタ。
// モードごとに別だったノードファイル導出 (beginnerNodeFile / rangeFileFor / positionalNodeFile) を
// この1ファイルに束ね、呼び出し側 (プレイ画面ハーネス・復習画面) は共通の TrainingViewInfo で扱える。
// 導出結果は各既存関数と完全に同一 (挙動不変)。

import { beginnerNodeFile, type PreflopQuestion } from '../../data/training/preflopBeginner';
import { rangeFileFor } from './intermediateScenarioLabel';
import type { IntermediateQuestion } from '../../data/training/preflopIntermediate';
import {
  positionalNodeFile,
  type PositionalQuestion,
} from '../../data/training/preflopIntermediatePositional';
import type { Position } from '../../types/strategy';

export interface TrainingViewInfo {
  /** ActionTable / NodeRangeSection に渡すノードファイル名。null は対応ノード無し。 */
  nodeFile: string | null;
  /** ヒーローのポジション (ActionTable 用)。 */
  mePosition: Position;
  /** 出題ハンド (NodeRangeSection の強調 + 既定の頻度表示対象)。 */
  hand: string;
  /** 頻度バーのラベル上書き (例 SB open の call → 「リンプ」)。無ければ既定ラベル。 */
  actionLabels?: Partial<Record<string, string>>;
}

export function beginnerViewInfo(q: PreflopQuestion): TrainingViewInfo {
  return { nodeFile: beginnerNodeFile(q), mePosition: q.myPosition, hand: q.hand };
}

export function intermediateViewInfo(q: IntermediateQuestion): TrainingViewInfo {
  return { nodeFile: rangeFileFor(q), mePosition: q.myPosition, hand: q.hand };
}

export function positionalViewInfo(q: PositionalQuestion): TrainingViewInfo {
  return {
    nodeFile: positionalNodeFile(q.scenarioKey, {
      hero: q.myPosition,
      opener: q.opener,
      threeBettor: q.threeBettor,
    }),
    mePosition: q.myPosition,
    hand: q.hand,
    actionLabels: q.actionLabels,
  };
}
