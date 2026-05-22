import { describe, it, expect } from 'vitest';
import { beginnerNodeFile, type PreflopQuestion } from '../../data/training/preflopBeginner';
import { rangeFileFor } from './intermediateScenarioLabel';
import {
  positionalNodeFile,
  type PositionalQuestion,
} from '../../data/training/preflopIntermediatePositional';
import type { IntermediateQuestion } from '../../data/training/preflopIntermediate';
import { beginnerViewInfo, intermediateViewInfo, positionalViewInfo } from './trainingViewInfo';

describe('trainingViewInfo (共通アダプタ: 既存導出と同一)', () => {
  it('beginnerViewInfo は beginnerNodeFile と同一の nodeFile', () => {
    const open = { scenario: 'open', myPosition: 'UTG', opener: null, hand: 'AA' } as PreflopQuestion;
    const vs = { scenario: 'vs_open', myPosition: 'BB', opener: 'CO', hand: 'KK' } as PreflopQuestion;
    expect(beginnerViewInfo(open)).toEqual({ nodeFile: beginnerNodeFile(open), mePosition: 'UTG', hand: 'AA' });
    expect(beginnerViewInfo(open).nodeFile).toBe('utg.json');
    expect(beginnerViewInfo(vs).nodeFile).toBe(beginnerNodeFile(vs));
    expect(beginnerViewInfo(vs).nodeFile).toBe('cor_bb.json');
  });

  it('intermediateViewInfo は rangeFileFor と同一の nodeFile', () => {
    const q = { scenarioType: 'bb_response', myPosition: 'BB', opener: 'CO', hand: 'QQ' } as IntermediateQuestion;
    expect(intermediateViewInfo(q)).toEqual({ nodeFile: rangeFileFor(q), mePosition: 'BB', hand: 'QQ' });
    expect(intermediateViewInfo(q).nodeFile).toBe('cor_bb.json');
  });

  it('positionalViewInfo は positionalNodeFile と同一 + actionLabels を伝搬', () => {
    const labels = { allin: 'オールイン', raise: 'レイズ', call: 'コール', check: 'チェック', fold: 'フォールド' };
    const q = {
      scenarioKey: 'ep_open',
      myPosition: 'UTG',
      opener: null,
      hand: 'JJ',
      actionLabels: labels,
    } as unknown as PositionalQuestion;
    const info = positionalViewInfo(q);
    expect(info.nodeFile).toBe(positionalNodeFile('ep_open', { hero: 'UTG', opener: null }));
    expect(info.nodeFile).toBe('utg.json');
    expect(info.mePosition).toBe('UTG');
    expect(info.hand).toBe('JJ');
    expect(info.actionLabels).toBe(labels);
  });
});
