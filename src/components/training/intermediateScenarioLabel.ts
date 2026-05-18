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

/** シナリオに対応する R2 上のレンジ JSON ファイル名 (拡張子含む)。 */
export function rangeFileFor(rec: Source): string {
  const op = rec.opener.toLowerCase();
  const me = rec.myPosition.toLowerCase();
  const tb = (rec.threeBettor ?? '').toLowerCase();
  switch (rec.scenarioType) {
    case 'bb_response':
      return `${op}r_bb.json`;
    case 'middle_vs_open':
      return `${op}r_${me}.json`;
    case 'vs_3bet':
      // 自分=opener、3bettor が 3bet、その後 opener (= 自分) のアクション
      return `${op}r_${tb}r_${op}.json`;
    case 'vs_4bet':
      // 自分=3bettor、opener が 4bet、その後 3bettor (= 自分) のアクション
      return `${op}r_${tb}r_${op}r_${tb}.json`;
    case 'risky_open':
      return `${me}.json`;
  }
}

/** マトリクス見出し (caption) を生成。 */
export function rangeCaption(rec: Source): string {
  switch (rec.scenarioType) {
    case 'bb_response':
      return `vs ${rec.opener} open の BB 応答レンジ`;
    case 'middle_vs_open':
      return `vs ${rec.opener} open の ${rec.myPosition} 応答レンジ`;
    case 'vs_3bet':
      return `${rec.myPosition} open vs ${rec.threeBettor} 3bet レンジ`;
    case 'vs_4bet':
      return `${rec.myPosition} 3bet vs ${rec.opener} 4bet レンジ`;
    case 'risky_open':
      return `${rec.myPosition} open レンジ`;
  }
}
