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
// 相手オールインノード (vs 5bet): 2択表示でも採点が壊れない
// ---------------------------------------------------------------------------

describe('相手オールインノードの採点', () => {
  it('GTO=call100% で call 選択 → 満点 2pt', () => {
    expect(scoreSelectBase(st({ call: 100 }), ['call']).finalScore).toBe(2);
  });
  it('GTO=call100% で fold 選択 → -1pt', () => {
    expect(scoreSelectBase(st({ call: 100 }), ['fold']).finalScore).toBe(-1);
  });
  it('raise/allin が 0% (選択肢に無い) でも未選択で減点されない', () => {
    // GTO=call60/fold40。call+fold を選べば満点。raise/allin (0%) を選ばなくても
    // 「70%以上の取りこぼし」に該当せず減点されない。
    expect(scoreSelectBase(st({ call: 60, fold: 40 }), ['call', 'fold']).finalScore).toBe(2);
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
  it('EP 内訳: ジャム受け上限3 → open 8 / vs3bet 9 / vs4bet 3 (合計20)', () => {
    expect(MODE_RECIPES.ep).toEqual([
      { spec: 'ep_open', count: 8 },
      { spec: 'ep_vs_3bet', count: 9 },
      { spec: 'ep_vs_4bet', count: 3 },
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

  it('EP: raise/allin があるノード (vs3bet 等) は 4 択固定 (buildQuestion)', () => {
    const hands = { AA: st({ allin: 20, raise: 30, call: 20, fold: 30 }), KK: st({ raise: 60, fold: 40 }) };
    const q = __testing__.buildQuestion(
      'ep',
      __testing__.SPECS.ep_vs_3bet,
      { file: 'x', hero: 'HJ', opener: 'HJ', threeBettor: 'BTN' },
      'AA',
      hands,
    );
    expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
  });

  it('EP: 相手オールイン (call/fold のみ) のノードは 2 択 (buildQuestion)', () => {
    const hands = { AA: st({ call: 50, fold: 50 }), KK: st({ call: 30, fold: 70 }) };
    const q = __testing__.buildQuestion(
      'ep',
      __testing__.SPECS.ep_vs_4bet,
      { file: 'x', hero: 'HJ', opener: 'HJ', threeBettor: 'BTN' },
      'AA',
      hands,
    );
    expect([...q.availableActions]).toEqual(['call', 'fold']);
  });

  it('Blind: 相手4bet (allin/call/fold のみ・raise頻度0) でも 4択 (3択にしない)', () => {
    const hands = { AA: st({ allin: 30, call: 40, fold: 30 }), KK: st({ allin: 10, call: 20, fold: 70 }) };
    const q = __testing__.buildQuestion(
      'blind',
      __testing__.SPECS.bb_vs_4bet,
      { file: 'x', hero: 'BB', opener: 'SB', threeBettor: 'BB' },
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
          expect(q.sliderCorrectPct).toBe(q.sliderAction === 'raise' ? q.strategy.raise : q.strategy.call);
        } else if (mode === 'blind') {
          expect(q.availableActions.length).toBeGreaterThan(0);
        } else {
          // EP/LP: 通常は 4 択固定。相手オールイン (vs 5bet) のみ call/fold 2択。
          const a = [...q.availableActions];
          const ok =
            JSON.stringify(a) === JSON.stringify(['allin', 'raise', 'call', 'fold']) ||
            JSON.stringify(a) === JSON.stringify(['call', 'fold']);
          expect(ok).toBe(true);
        }
      }
    });
  }

  it('ep: vs3bet は 4 択固定、vs4bet (vs5bet=相手オールイン) は call 軸スライダー', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('ep');
    const vs3 = qs.filter((q) => q.scenarioKey === 'ep_vs_3bet');
    const vs4 = qs.filter((q) => q.scenarioKey === 'ep_vs_4bet');
    expect(vs3.length).toBeGreaterThan(0);
    expect(vs4.length).toBeGreaterThan(0);
    for (const q of vs3) {
      expect(q.format).toBe('select');
      expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
      expect(q.actionLabels.call).toBe('コール'); // EP/LP は call=コール (リンプではない)
    }
    for (const q of vs4) {
      expect(q.format).toBe('slider'); // 2択 → スライダー
      expect(q.sliderAction).toBe('call');
      expect(q.sliderCorrectPct).toBe(q.strategy.call);
    }
  });

  it('lp: vs4bet (vs5bet) は call 軸スライダー、その他 select は 4 択', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('lp');
    const vs4 = qs.filter((q) => q.scenarioKey === 'lp_vs_4bet');
    expect(vs4.length).toBeGreaterThan(0);
    for (const q of vs4) {
      expect(q.format).toBe('slider');
      expect(q.sliderAction).toBe('call');
    }
    for (const q of qs.filter((x) => x.format === 'select')) {
      expect([...q.availableActions]).toEqual(['allin', 'raise', 'call', 'fold']);
    }
  });

  it('全モード: 中途半端な3択 (allin/call/fold 等) が発生しない', async () => {
    const VALID = new Set([
      'allin,call,fold,raise', // 4択固定
      'call,fold',             // 相手オールイン 2択
      'call,fold,raise',       // SB open (limp系: リンプ/レイズ/フォールド)
      'check,raise',           // BB vs limp (チェック/レイズ)
    ]);
    for (const mode of ['ep', 'lp', 'blind'] as PositionalMode[]) {
      __testing__.resetCache();
      const qs = await generatePositionalQuestions(mode);
      for (const q of qs.filter((x) => x.format === 'select')) {
        const a = [...q.availableActions];
        // allin があるなら必ず raise もある (allin/call/fold の3択を禁止)
        if (a.includes('allin')) expect(a).toContain('raise');
        expect(VALID.has([...a].sort().join(','))).toBe(true);
      }
    }
  });

  it('blind: bb_vs_4bet / sb_vs_4bet は 4択 (相手は4betでありジャムではない)', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('blind');
    const v4 = qs.filter((q) => q.scenarioKey === 'bb_vs_4bet' || q.scenarioKey === 'sb_vs_4bet');
    expect(v4.length).toBeGreaterThan(0);
    for (const q of v4) {
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

  it('blind: BB vs limp は raise 軸スライダー (レイズ/チェック2択, fold非提示, limpAction=check)', async () => {
    __testing__.resetCache();
    const qs = await generatePositionalQuestions('blind');
    const bbLimp = qs.filter((q) => q.scenarioKey === 'bb_vs_limp');
    expect(bbLimp.length).toBeGreaterThan(0);
    for (const q of bbLimp) {
      expect(q.format).toBe('slider'); // 2択 → スライダー
      expect(q.sliderAction).toBe('raise');
      expect(q.sliderCorrectPct).toBe(q.strategy.raise);
      expect(q.availableActions).toContain('check');
      expect(q.availableActions).not.toContain('fold');
      expect(q.limpAction).toBe('check');
    }
  });

  it('変更3: EP のジャム受け (ep_vs_4bet) は最大3問・総数は20問', async () => {
    for (let trial = 0; trial < 5; trial++) {
      __testing__.resetCache();
      const qs = await generatePositionalQuestions('ep');
      expect(qs).toHaveLength(20);
      const jam = qs.filter((q) => q.scenarioKey === 'ep_vs_4bet');
      expect(jam.length).toBeLessThanOrEqual(3);
    }
  });

  it('変更4: 同一シナリオ内でハンド重複なし (lp_vs_4bet はプール枯渇のため例外)', async () => {
    for (const mode of ['ep', 'lp', 'blind'] as PositionalMode[]) {
      __testing__.resetCache();
      const qs = await generatePositionalQuestions(mode);
      const byScenario = new Map<string, string[]>();
      for (const q of qs) {
        const arr = byScenario.get(q.scenarioKey) ?? [];
        arr.push(q.hand);
        byScenario.set(q.scenarioKey, arr);
      }
      for (const [scenario, hands] of byScenario) {
        if (scenario === 'lp_vs_4bet') continue; // ユニーク4 < 6: 枯渇時のみ重複許容
        expect(new Set(hands).size).toBe(hands.length);
      }
    }
  });
});
