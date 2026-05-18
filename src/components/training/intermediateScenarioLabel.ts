// 中級トレーニングのシナリオを日本語ラベル化 (Result / Review / Play で共有)。

import type { IntermediateRecord } from '../../data/training/recordsStore';
import type { IntermediateQuestion } from '../../data/training/preflopIntermediate';

type Source = IntermediateRecord | IntermediateQuestion;

export function intermediateScenarioLabel(rec: Source): string {
  switch (rec.scenarioType) {
    case 'bb_response':
      return `vs ${rec.opener} open`;
    case 'vs_3bet':
      return `${rec.myPosition} → vs ${rec.threeBettor} 3bet`;
    case 'vs_4bet':
      return `${rec.myPosition} → vs ${rec.opener} 4bet`;
    case 'middle_vs_open':
      return `${rec.myPosition} vs ${rec.opener} open`;
    case 'risky_open':
      return `${rec.myPosition} open`;
  }
}
