import { describe, it, expect } from 'vitest';
import {
  TRAINING_CATALOG,
  isPlanned,
  isPlayable,
  formatLevelInfo,
  formatScorePct,
  maxScoreFor,
  computeLevelGroupScore,
  trainingPath,
} from './trainingCatalog';

describe('TRAINING_CATALOG', () => {
  it('2 カテゴリ (preflop / flop)', () => {
    expect(TRAINING_CATALOG.map((c) => c.key)).toEqual(['preflop', 'flop']);
  });

  it('flop カテゴリは「ポストフロップトレーニング」表記, CB/ドンクは「レンジ〜」表記', () => {
    expect(TRAINING_CATALOG[1].label).toBe('ポストフロップトレーニング');
    const byKey = (k: string) => TRAINING_CATALOG[1].levels.find((l) => l.key === k);
    expect(byKey('flop_cb_srp')?.label).toBe('レンジCB SRP');
    expect(byKey('flop_cb_3bp')?.label).toBe('レンジCB 3BP/4BP/5BP');
    expect(byKey('flop_donk_bmcb')?.label).toBe('レンジドンク/BMCB');
  });

  it('preflop 10 レベル, flop 6 レベル (初級基礎/中級x4/上級/超上級/初級シナリオ別x3)', () => {
    expect(TRAINING_CATALOG[0].levels).toHaveLength(10);
    expect(TRAINING_CATALOG[1].levels).toHaveLength(6);
    expect(TRAINING_CATALOG[1].levels.map((l) => l.key)).toEqual([
      'flop_beginner',
      'flop_cb_srp',
      'flop_cb_3bp',
      'flop_donk_bmcb',
      'flop_advanced',
      'flop_expert',
    ]);
  });

  it('中級ポジション別 (EP/LP/Blind) が中級総合の直後に並ぶ / 初級シナリオ別3モードは末尾', () => {
    expect(TRAINING_CATALOG[0].levels.map((l) => l.key)).toEqual([
      'preflop_beginner',
      'preflop_intermediate',
      'preflop_intermediate_ep',
      'preflop_intermediate_lp',
      'preflop_intermediate_blind',
      'preflop_advanced',
      'preflop_expert',
      'preflop_beginner_open',
      'preflop_beginner_vs_open',
      'preflop_beginner_vs_3bet_4bet',
    ]);
  });

  it('初級シナリオ別モード: ラベル。open/vs open は実装済、vs 3bet4bet のみ未実装', () => {
    const byKey = (k: string) => TRAINING_CATALOG[0].levels.find((l) => l.key === k);
    expect(byKey('preflop_beginner')?.label).toBe('初級 基礎'); // 旧「初級」の改名
    expect(byKey('preflop_beginner_open')?.label).toBe('初級 オープン');
    expect(byKey('preflop_beginner_vs_open')?.label).toBe('初級 vs オープン');
    expect(byKey('preflop_beginner_vs_3bet_4bet')?.label).toBe('初級 vs 3ベット/4ベット');
    // vs 3ベット4ベット はまだ未実装。
    expect(byKey('preflop_beginner_vs_3bet_4bet')?.implemented).toBe(false);
    expect(byKey('preflop_beginner_vs_3bet_4bet')?.questionCount).toBeNull();
  });

  it('初級オープン: points=0.5, questionCount=20, timeLimitSec=50, implemented=true', () => {
    const open = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open');
    expect(open?.points).toBe(0.5);
    expect(open?.questionCount).toBe(20);
    expect(open?.timeLimitSec).toBe(50);
    expect(open?.implemented).toBe(true);
  });

  it('初級 vs オープン: points=1, questionCount=20, timeLimitSec=50, implemented=true', () => {
    const vs = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_vs_open');
    expect(vs?.points).toBe(1);
    expect(vs?.questionCount).toBe(20);
    expect(vs?.timeLimitSec).toBe(50);
    expect(vs?.implemented).toBe(true);
  });

  it('中級 EP/LP=20問, Blind=30問, 全て implemented=true・20s', () => {
    const [ep, lp, blind] = [
      TRAINING_CATALOG[0].levels[2],
      TRAINING_CATALOG[0].levels[3],
      TRAINING_CATALOG[0].levels[4],
    ];
    expect([ep.key, lp.key, blind.key]).toEqual([
      'preflop_intermediate_ep', 'preflop_intermediate_lp', 'preflop_intermediate_blind',
    ]);
    expect([ep.questionCount, lp.questionCount, blind.questionCount]).toEqual([20, 20, 30]);
    expect([ep.implemented, lp.implemented, blind.implemented]).toEqual([true, true, true]);
    expect([ep.timeLimitSec, lp.timeLimitSec, blind.timeLimitSec]).toEqual([20, 20, 20]);
  });

  it('preflop 初級: points=1, questionCount=20, implemented=true', () => {
    const beginner = TRAINING_CATALOG[0].levels[0];
    expect(beginner.key).toBe('preflop_beginner');
    expect(beginner.points).toBe(1);
    expect(beginner.questionCount).toBe(20);
    expect(beginner.timeLimitSec).toBe('none');
    expect(beginner.implemented).toBe(true);
  });

  it('preflop 中級: points=1 (best_score がそのまま pt), timeLimitSec=20, implemented=true', () => {
    const intermediate = TRAINING_CATALOG[0].levels[1];
    expect(intermediate.key).toBe('preflop_intermediate');
    expect(intermediate.points).toBe(1);
    expect(intermediate.questionCount).toBe(20);
    expect(intermediate.timeLimitSec).toBe(20);
    expect(intermediate.implemented).toBe(true);
  });

  it('preflop 上級/超上級 は false。flop は初級+CB SRP/CB 3BP が実装、上級/超上級は未実装', () => {
    expect(TRAINING_CATALOG[0].levels[5].implemented).toBe(false); // 上級
    expect(TRAINING_CATALOG[0].levels[6].implemented).toBe(false); // 超上級
    expect(TRAINING_CATALOG[1].levels[0].implemented).toBe(true);  // フロップ初級
    expect(TRAINING_CATALOG[1].levels[1].implemented).toBe(true);  // CB SRP
    expect(TRAINING_CATALOG[1].levels[2].implemented).toBe(true);  // CB 3BP/4BP/5BP
    expect(TRAINING_CATALOG[1].levels[3].implemented).toBe(true);  // ドンク/BMCB
    expect(TRAINING_CATALOG[1].levels.slice(4).every((l) => l.implemented === false)).toBe(true);
  });

  it('flop: 初級20問 / CB SRP・CB 3BP・ドンクBMCB は各30問、上級以降は questionCount=null', () => {
    expect(TRAINING_CATALOG[1].levels[0].questionCount).toBe(20); // 初級
    expect(TRAINING_CATALOG[1].levels[1].questionCount).toBe(30); // CB SRP
    expect(TRAINING_CATALOG[1].levels[2].questionCount).toBe(30); // CB 3BP/4BP/5BP
    expect(TRAINING_CATALOG[1].levels[3].questionCount).toBe(30); // ドンク/BMCB
    expect(TRAINING_CATALOG[1].levels.slice(4).every((l) => l.questionCount === null)).toBe(true);
  });
});

describe('helpers', () => {
  it('isPlanned: questionCount !== null は planned', () => {
    expect(isPlanned(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlanned(TRAINING_CATALOG[0].levels[2])).toBe(true);  // EP (questionCount=20)
    expect(isPlanned(TRAINING_CATALOG[0].levels[5])).toBe(false); // 上級 (未計画)
    expect(isPlanned(TRAINING_CATALOG[1].levels[0])).toBe(true);  // フロップ初級 (計画済)
    expect(isPlanned(TRAINING_CATALOG[1].levels[1])).toBe(true);  // CB SRP (計画済)
    expect(isPlanned(TRAINING_CATALOG[1].levels[4])).toBe(false); // フロップ上級 (未計画)
  });

  it('isPlayable: implemented=true かつ pt/問数あり', () => {
    expect(isPlayable(TRAINING_CATALOG[0].levels[0])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[1])).toBe(true);
    expect(isPlayable(TRAINING_CATALOG[0].levels[2])).toBe(true);  // EP
    expect(isPlayable(TRAINING_CATALOG[0].levels[5])).toBe(false); // 上級 (未実装)
    expect(isPlayable(TRAINING_CATALOG[1].levels[0])).toBe(true);  // フロップ初級 (実装済)
    expect(isPlayable(TRAINING_CATALOG[1].levels[1])).toBe(true);  // CB SRP (実装済)
    expect(isPlayable(TRAINING_CATALOG[1].levels[4])).toBe(false); // フロップ上級 (未実装)
  });

  it('formatLevelInfo: "1pt × 20問・制限時間なし"', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[0])).toBe('1pt × 20問・制限時間なし');
  });

  it('formatLevelInfo: 中級は "20問・最大 40pt・制限時間 20s" 形式', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[0].levels[1])).toBe('20問・最大 40pt・制限時間 20s');
  });

  it('formatLevelInfo: 初級オープンは "20問・最大 10pt・制限時間 50s"', () => {
    const open = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open')!;
    expect(formatLevelInfo(open)).toBe('20問・最大 10pt・制限時間 50s');
  });

  it('formatLevelInfo: フロップ CB SRP/CB 3BP/ドンクBMCB は "30問・最大 60pt・制限時間なし"', () => {
    expect(formatLevelInfo(TRAINING_CATALOG[1].levels[1])).toBe('30問・最大 60pt・制限時間なし');
    expect(formatLevelInfo(TRAINING_CATALOG[1].levels[2])).toBe('30問・最大 60pt・制限時間なし');
    expect(formatLevelInfo(TRAINING_CATALOG[1].levels[3])).toBe('30問・最大 60pt・制限時間なし');
  });

  it('trainingPath: snake_case → kebab-case slug', () => {
    expect(trainingPath('preflop_beginner', 'confirm')).toBe('/training/preflop-beginner/confirm');
    expect(trainingPath('preflop_intermediate', 'play')).toBe('/training/preflop-intermediate/play');
    expect(trainingPath('preflop_advanced', 'result')).toBe('/training/preflop-advanced/result');
  });
});

describe('maxScoreFor', () => {
  it('初級: 20 (questionCount)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[0])).toBe(20);
  });
  it('中級: 40 (questionCount * 2)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[1])).toBe(40);
  });
  it('中級ポジション別: EP/LP=20, Blind=30 (questionCount, ÷2 済の満点)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[2])).toBe(20); // EP
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[3])).toBe(20); // LP
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[4])).toBe(30); // Blind
  });
  it('初級オープン: 10 (questionCount * 0.5, best_score は正解数 0-20)', () => {
    const open = TRAINING_CATALOG[0].levels.find((l) => l.key === 'preflop_beginner_open')!;
    expect(maxScoreFor(open)).toBe(10);
  });
  it('フロップ CB SRP/CB 3BP/ドンクBMCB: 60 (questionCount * 2)', () => {
    expect(maxScoreFor(TRAINING_CATALOG[1].levels[1])).toBe(60);
    expect(maxScoreFor(TRAINING_CATALOG[1].levels[2])).toBe(60);
    expect(maxScoreFor(TRAINING_CATALOG[1].levels[3])).toBe(60);
  });
  it('未計画 (questionCount=null) → 0', () => {
    expect(maxScoreFor(TRAINING_CATALOG[0].levels[5])).toBe(0); // 上級
    expect(maxScoreFor(TRAINING_CATALOG[1].levels[4])).toBe(0); // フロップ上級 (未計画)
  });
});

describe('computeLevelGroupScore (階級の合計点)', () => {
  const preflop = TRAINING_CATALOG[0].levels;
  const beginnerGroup = preflop.filter((l) => l.key.startsWith('preflop_beginner'));

  it('プリフロップ初級: 基礎+オープン+vsオープンの満点合計 50pt (vs3bet4betは未実装で分母外)', () => {
    const { current, max } = computeLevelGroupScore(beginnerGroup, []);
    expect(max).toBe(50); // 基礎20 + オープン10 + vsオープン20
    expect(current).toBe(0); // 記録なし
  });

  it('current は best_score × points を実装済みモードで合算 (例: 基礎20 + オープン19→9.5 = 29.5)', () => {
    const records = [
      { training_type: 'preflop_beginner', best_score: 20 },        // 20 × 1 = 20
      { training_type: 'preflop_beginner_open', best_score: 19 },   // 19 × 0.5 = 9.5
    ];
    const { current, max } = computeLevelGroupScore(beginnerGroup, records);
    expect(current).toBe(29.5);
    expect(max).toBe(50);
  });

  it('全モード未実装の階級は max=0 (上級)', () => {
    const advanced = preflop.filter((l) => l.key === 'preflop_advanced' || l.key === 'preflop_expert');
    expect(computeLevelGroupScore(advanced, []).max).toBe(0);
  });

  it('未実装モードは分子にも含めない (記録があっても無視)', () => {
    const { current } = computeLevelGroupScore(beginnerGroup, [
      { training_type: 'preflop_beginner_vs_3bet_4bet', best_score: 99 },
    ]);
    expect(current).toBe(0);
  });
});

describe('formatScorePct (整数のみ無小数、小数あれば 1 桁)', () => {
  it('20/20 → "100%"', () => {
    expect(formatScorePct(20, 20)).toBe('100%');
  });
  it('27/40 → "67.5%"', () => {
    expect(formatScorePct(27, 40)).toBe('67.5%');
  });
  it('15/20 → "75%" (整数)', () => {
    expect(formatScorePct(15, 20)).toBe('75%');
  });
  it('1/40 → "2.5%"', () => {
    expect(formatScorePct(1, 40)).toBe('2.5%');
  });
  it('0/20 → "0%"', () => {
    expect(formatScorePct(0, 20)).toBe('0%');
  });
  it('max=0 (未計画) → "—"', () => {
    expect(formatScorePct(0, 0)).toBe('—');
  });
});
