/// <reference types="node" />
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { scoreAnswer, type Action } from './preflopIntermediate';
import {
  scoreSelectBase,
  scoreBlindAnswer,
  limpRelaxApplies,
  scorePositionalPoints,
  totalPositionalScore,
  maxScoreForMode,
  generatePositionalQuestions,
  MODE_RECIPES,
  __testing__,
  type PositionalStrategy,
  type PositionalQuestion,
  type PositionalMode,
} from './preflopIntermediatePositional';

function st(p: Partial<PositionalStrategy>): PositionalStrategy {
  return { allin: 0, raise: 0, call: 0, check: 0, fold: 0, ...p };
}

// ---------------------------------------------------------------------------
// scoreSelectBase は scoreAnswer (中級総合) と同一挙動 (check 無しノード)
// ---------------------------------------------------------------------------

describe('scoreSelectBase parity with scoreAnswer (4 アクション)', () => {
  const cases: Array<{ s: PositionalStrategy; sel: Action[] }> = [
    { s: st({ raise: 100 }), sel: ['raise'] },
    { s: st({ raise: 50, call: 50 }), sel: ['raise'] },
    { s: st({ raise: 50, call: 50 }), sel: ['raise', 'call'] },
    { s: st({ raise: 80, call: 20 }), sel: ['call'] },
    { s: st({ raise: 30, call: 30, fold: 40 }), sel: ['raise', 'call'] },
    { s: st({ allin: 25, raise: 75 }), sel: ['allin', 'raise'] },
    { s: st({ raise: 3, call: 97 }), sel: ['raise'] },
    { s: st({ raise: 50, call: 50 }), sel: [] },
  ];
  it('finalScore が一致', () => {
    for (const { s, sel } of cases) {
      expect(scoreSelectBase(s, sel).finalScore).toBe(scoreAnswer(s, sel).finalScore);
    }
  });
});

// ---------------------------------------------------------------------------
// limp 配点緩和 (Blind)
// ---------------------------------------------------------------------------

describe('limp 配点緩和', () => {
  // 例1: allin0/raise20/limp(call)80/fold0、レイズのみ選択 → 救済 +1pt
  it('例1: raise+limp主体・raiseのみ選択 → -1 を +1 に救済', () => {
    const s = st({ raise: 20, call: 80 });
    expect(scoreSelectBase(s, ['raise']).finalScore).toBe(-1);
    expect(scoreBlindAnswer(s, ['raise'], 'call').finalScore).toBe(1);
  });

  // 例2: 同じGTOで raise+fold 選択 → fold を含むため救済なし (-1)
  it('例2: fold を含むと救済なし', () => {
    const s = st({ raise: 20, call: 80 });
    expect(scoreBlindAnswer(s, ['raise', 'fold'], 'call').finalScore).toBe(-1);
  });

  it('allin は救済対象外', () => {
    const s = st({ raise: 20, call: 80 });
    expect(scoreBlindAnswer(s, ['allin'], 'call').finalScore).toBe(-1);
    expect(limpRelaxApplies(s, ['allin'], 'call')).toBe(false);
  });

  it('GTO が fold 主体なら救済しない (降りるべきハンド)', () => {
    const s = st({ raise: 10, call: 10, fold: 80 });
    expect(scoreBlindAnswer(s, ['raise'], 'call').finalScore).toBe(-1);
    expect(limpRelaxApplies(s, ['raise'], 'call')).toBe(false);
  });

  it('BB vs limp: limp=check でも救済 (raise+check主体)', () => {
    const s = st({ raise: 20, check: 80 });
    expect(scoreSelectBase(s, ['raise']).finalScore).toBe(-1);
    expect(scoreBlindAnswer(s, ['raise'], 'check').finalScore).toBe(1);
  });

  it('limpAction=null (緩和なしシナリオ) は基礎採点のまま', () => {
    const s = st({ raise: 20, call: 80 });
    expect(scoreBlindAnswer(s, ['raise'], null).finalScore).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------------

describe('totalPositionalScore (÷2 floor, 下限0)', () => {
  it('合計を2で割って切り捨て', () => {
    expect(totalPositionalScore([2, 2, 2, 2])).toBe(4);
    expect(totalPositionalScore([2, 1, -1, 0])).toBe(1); // floor(2/2)
    expect(totalPositionalScore([2, 1])).toBe(1);        // floor(3/2)
  });
  it('合計が負なら 0', () => {
    expect(totalPositionalScore([-1, -1])).toBe(0);
    expect(totalPositionalScore([-1, 0])).toBe(0);
  });
});

describe('maxScoreForMode / MODE_RECIPES', () => {
  it('満点: EP/LP=20, Blind=30', () => {
    expect(maxScoreForMode('ep')).toBe(20);
    expect(maxScoreForMode('lp')).toBe(20);
    expect(maxScoreForMode('blind')).toBe(30);
  });
  it('レシピ合計が満点と一致', () => {
    const sum = (m: PositionalMode) => MODE_RECIPES[m].reduce((a, b) => a + b.count, 0);
    expect(sum('ep')).toBe(20);
    expect(sum('lp')).toBe(20);
    expect(sum('blind')).toBe(30);
  });
  it('EP 内訳: open 6 / vs3bet 7 / vs4bet 7', () => {
    expect(MODE_RECIPES.ep).toEqual([
      { spec: 'ep_open', count: 6 },
      { spec: 'ep_vs_3bet', count: 7 },
      { spec: 'ep_vs_4bet', count: 7 },
    ]);
  });
  it('Blind: SB limp vs raise = 2 問', () => {
    const limp = MODE_RECIPES.blind.find((r) => r.spec === 'sb_limp_vs_raise');
    expect(limp?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// scorePositionalPoints (slider / select / skip / timeout)
// ---------------------------------------------------------------------------

function makeQ(over: Partial<PositionalQuestion>): PositionalQuestion {
  return {
    mode: 'ep',
    scenarioKey: 'ep_open',
    label: 'UTG open',
    format: 'slider',
    myPosition: 'UTG',
    opener: null,
    foldedBefore: [],
    chipExtras: [],
    hand: 'A2s',
    cards: [{ rank: 'A', suit: 's' }, { rank: '2', suit: 's' }],
    strategy: st({ raise: 50, fold: 50 }),
    sliderAction: 'raise',
    sliderCorrectPct: 50,
    availableActions: ['raise', 'fold'],
    actionLabels: { allin: 'オールイン', raise: 'レイズ', call: 'コール', check: 'チェック', fold: 'フォールド' },
    limpAction: null,
    ...over,
  };
}

describe('scorePositionalPoints', () => {
  it('slider: 回答/飛ばし/時間切れ', () => {
    const q = makeQ({ format: 'slider', sliderCorrectPct: 50 });
    expect(scorePositionalPoints(q, { kind: 'slider', pct: 50 })).toBe(2);
    expect(scorePositionalPoints(q, { kind: 'slider', pct: 20 })).toBe(-1);
    expect(scorePositionalPoints(q, { kind: 'skip' })).toBe(0);
    expect(scorePositionalPoints(q, { kind: 'timeout' })).toBe(-1);
  });

  it('select (非Blind): scoreAnswer に一致', () => {
    const q = makeQ({ mode: 'ep', format: 'select', strategy: st({ raise: 100 }) });
    expect(scorePositionalPoints(q, { kind: 'select', selections: ['raise'] })).toBe(2);
    expect(scorePositionalPoints(q, { kind: 'timeout' })).toBe(-1);
  });

  it('select (Blind): limp 緩和が効く', () => {
    const q = makeQ({
      mode: 'blind',
      format: 'select',
      strategy: st({ raise: 20, call: 80 }),
      limpAction: 'call',
    });
    expect(scorePositionalPoints(q, { kind: 'select', selections: ['raise'] })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// pickHand / availableActionsOf / buildQuestion (内部)
// ---------------------------------------------------------------------------

describe('availableActionsOf / labels (buildQuestion)', () => {
  it('availableActionsOf: 頻度>0 のアクションのみ (正規順)', () => {
    const hands = {
      AA: st({ raise: 100 }),
      KK: st({ call: 50, fold: 50 }),
      QQ: st({ check: 100 }),
    };
    expect(__testing__.availableActionsOf(hands)).toEqual(['raise', 'call', 'check', 'fold']);
  });

  it('SB open は call ラベルが「リンプ」', () => {
    const hands = { AA: st({ raise: 80, call: 20 }), KK: st({ raise: 50, fold: 50 }) };
    const q = __testing__.buildQuestion('blind', __testing__.SPECS.sb_open, { file: 'sb.json', hero: 'SB', opener: null }, 'AA', hands);
    expect(q.actionLabels.call).toBe('リンプ');
    expect(q.limpAction).toBe('call');
  });

  it('EP は call/fold のみのノードでも 4 択固定 (buildQuestion)', () => {
    const hands = { AA: st({ call: 50, fold: 50 }), KK: st({ call: 30, fold: 70 }) };
    const q = __testing__.buildQuestion(
      'ep',
      __testing__.SPECS.ep_vs_4bet,
      { file: 'x', hero: 'HJ', opener: 'HJ', threeBettor: 'BTN' },
      'AA',
      hands,
    );
    expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
  });

  it('vs open は call ラベルが「コール」', () => {
    const hands = { AA: st({ raise: 80, call: 20 }), KK: st({ call: 50, fold: 50 }) };
    const q = __testing__.buildQuestion('blind', __testing__.SPECS.sb_vs_open, { file: 'utgr_sb.json', hero: 'SB', opener: 'UTG' }, 'AA', hands);
    expect(q.actionLabels.call).toBe('コール');
    expect(q.limpAction).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 実データを使った生成パイプライン (fetch を public/data から読むようスタブ)
// ---------------------------------------------------------------------------

describe('generatePositionalQuestions (実データ)', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', async (url: string) => {
      const rel = url.replace(/^\//, '');
      try {
        const text = await readFile(path.join(process.cwd(), 'public', rel), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(text) } as Response;
      } catch {
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }
    });
  });
  afterAll(() => vi.unstubAllGlobals());

  const expected: Record<PositionalMode, number> = { ep: 20, lp: 20, blind: 30 };

  for (const mode of ['ep', 'lp', 'blind'] as PositionalMode[]) {
    it(`${mode}: 満点分の問題を生成し各問が整合`, async () => {
      __testing__.resetCache();
      const qs = await generatePositionalQuestions(mode);
      expect(qs).toHaveLength(expected[mode]);
      for (const q of qs) {
        expect(q.cards).toHaveLength(2);
        expect(q.strategy).toBeTruthy();
        expect(q.hand.length).toBeGreaterThanOrEqual(2);
        if (q.format === 'slider') {
          expect(q.sliderCorrectPct).toBe(q.strategy.raise);
        } else if (mode === 'blind') {
          expect(q.availableActions.length).toBeGreaterThan(0);
        } else {
          // EP/LP の複数選択は常に 4 択固定 (allin/raise/call/fold)。
          expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
        }
      }
    });
  }

  it('ep: vs3bet / vs4bet の複数選択は常に 4 択固定 (レイズ欠落しない)', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('ep');
    const selects = qs.filter((q) => q.format === 'select');
    expect(selects.length).toBeGreaterThan(0);
    for (const q of selects) {
      expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
      expect(q.actionLabels.call).toBe('コール'); // EP/LP は call=コール (リンプではない)
    }
  });

  it('lp: 複数選択は常に 4 択固定', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('lp');
    for (const q of qs.filter((x) => x.format === 'select')) {
      expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
    }
  });

  it('blind: SB open は call=リンプ・limpAction=call の問題を含む', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('blind');
    const sbOpen = qs.filter((q) => q.scenarioKey === 'sb_open');
    expect(sbOpen.length).toBeGreaterThan(0);
    for (const q of sbOpen) {
      expect(q.actionLabels.call).toBe('リンプ');
      expect(q.limpAction).toBe('call');
    }
  });

  it('blind: BB vs limp は check ベース (fold 非提示・limpAction=check)', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('blind');
    const bbLimp = qs.filter((q) => q.scenarioKey === 'bb_vs_limp');
    expect(bbLimp.length).toBeGreaterThan(0);
    for (const q of bbLimp) {
      expect(q.availableActions).toContain('check');
      expect(q.availableActions).not.toContain('fold');
      expect(q.limpAction).toBe('check');
    }
  });
});
