// 問題のシナリオを日本語表記に変換 (Result / Review で共有)。
//   - open: "UTG オープン判定"
//   - vs_open: "vs BTN open"

import type { ProblemRecord } from '../../data/training/recordsStore';

export function scenarioLabel(record: ProblemRecord): string {
  if (record.scenario === 'open') return `${record.myPosition} オープン判定`;
  return `vs ${record.opener} open`;
}
