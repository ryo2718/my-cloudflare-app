import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Position } from '../../types/strategy';
import {
  parseActionHistory,
  toSeatPopups,
  actionLabel,
  actionsBeforeHero,
  getActionDelay,
  withBlinds,
  FOLD_DELAY_MS,
  OTHER_DELAY_MS,
} from './actionHistory';

describe('parseActionHistory', () => {
  it('Raise/Fold/Allin を額つきで解析', () => {
    const items = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'HJ', action: 'Fold' },
      { position: 'CO', action: 'Allin 100' },
    ]);
    expect(items).toEqual([
      { position: 'UTG', kind: 'raise', amount: 2.5 },
      { position: 'HJ', kind: 'fold' },
      { position: 'CO', kind: 'allin', amount: 100 },
    ]);
  });

  it('Call はレイズ前なら limp、レイズ後なら call', () => {
    // SB が最初に Call → limp
    const limp = parseActionHistory([
      { position: 'UTG', action: 'Fold' },
      { position: 'SB', action: 'Call' },
    ]);
    expect(limp[1]).toEqual({ position: 'SB', kind: 'limp' });

    // レイズ後の Call → call
    const call = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'BB', action: 'Call' },
    ]);
    expect(call[1]).toEqual({ position: 'BB', kind: 'call' });
  });
});

describe('actionLabel', () => {
  it('raise は額つき、その他は語のみ', () => {
    expect(actionLabel({ position: 'UTG', kind: 'raise', amount: 2.5 })).toBe('raise 2.5');
    expect(actionLabel({ position: 'HJ', kind: 'raise', amount: 12 })).toBe('raise 12');
    expect(actionLabel({ position: 'CO', kind: 'fold' })).toBe('fold');
    expect(actionLabel({ position: 'SB', kind: 'limp' })).toBe('limp');
    expect(actionLabel({ position: 'BB', kind: 'call' })).toBe('call');
    expect(actionLabel({ position: 'BTN', kind: 'allin', amount: 100 })).toBe('allin');
  });
});

describe('actionsBeforeHero (ヒーロー以降を除外)', () => {
  // GTO データはヒーロー以降の席もアイソレーションの fold として含む。
  const vsOpenHJ = parseActionHistory([
    { position: 'UTG', action: 'Raise 2.5' },
    { position: 'CO', action: 'Fold' },
    { position: 'BTN', action: 'Fold' },
    { position: 'SB', action: 'Fold' },
    { position: 'BB', action: 'Fold' },
  ]);

  it('hero=HJ (未行動): UTG だけ残り CO/BTN/SB/BB は除外', () => {
    const r = actionsBeforeHero(vsOpenHJ, 'HJ');
    expect(r.map((x) => x.position)).toEqual(['UTG']);
  });

  it('hero=UTG (最先頭・open): 履歴は空 → 空', () => {
    // UTG は最初に行動するため、UTG の最初の決断 (open) では履歴が空。
    expect(actionsBeforeHero([], 'UTG')).toEqual([]);
  });

  it('hero=BB (未行動・最後尾): 手前の席すべて残る', () => {
    const items = parseActionHistory([
      { position: 'UTG', action: 'Fold' },
      { position: 'HJ', action: 'Fold' },
      { position: 'CO', action: 'Raise 2.5' },
      { position: 'BTN', action: 'Fold' },
      { position: 'SB', action: 'Fold' },
    ]);
    expect(actionsBeforeHero(items, 'BB').map((x) => x.position)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB']);
  });

  it('多ラウンド (hero が既に行動済 = vs3bet): 全アクションを残す', () => {
    // UTG open → 各 fold → HJ 3bet → UTG (hero) の決断
    const vs3bet = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'CO', action: 'Fold' },
      { position: 'BTN', action: 'Fold' },
      { position: 'SB', action: 'Fold' },
      { position: 'BB', action: 'Fold' },
      { position: 'HJ', action: 'Raise 7.5' },
    ]);
    const r = actionsBeforeHero(vs3bet, 'UTG');
    expect(r).toHaveLength(6); // HJ(3bet, 後ろの席) も含む
    expect(r.some((x) => x.position === 'HJ' && x.kind === 'raise')).toBe(true);
  });

  it('vs3bet: 後段の 3bet を時系列 (席順) に並べ替える (HJ 3bet は fold より前)', () => {
    // データは UTG open → CO/BTN/SB/BB fold → HJ 3bet の順 (非時系列)。
    const vs3bet = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'CO', action: 'Fold' },
      { position: 'BTN', action: 'Fold' },
      { position: 'SB', action: 'Fold' },
      { position: 'BB', action: 'Fold' },
      { position: 'HJ', action: 'Raise 7.5' },
    ]);
    const r = actionsBeforeHero(vs3bet, 'UTG');
    // 時系列 (席順): UTG, HJ(3bet), CO, BTN, SB, BB
    expect(r.map((x) => x.position)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(r[1]).toEqual({ position: 'HJ', kind: 'raise', amount: 7.5 });
  });

  it('vs4bet: 多ラウンドを時系列に (UTG open, HJ 3bet, folds, UTG 4bet)', () => {
    const vs4bet = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'CO', action: 'Fold' },
      { position: 'BTN', action: 'Fold' },
      { position: 'SB', action: 'Fold' },
      { position: 'BB', action: 'Fold' },
      { position: 'HJ', action: 'Raise 7.5' },
      { position: 'UTG', action: 'Raise 20' },
    ]);
    const r = actionsBeforeHero(vs4bet, 'HJ');
    expect(r.map((x) => `${x.position}:${x.kind}`)).toEqual([
      'UTG:raise', 'HJ:raise', 'CO:fold', 'BTN:fold', 'SB:fold', 'BB:fold', 'UTG:raise',
    ]);
    expect(r[6]).toEqual({ position: 'UTG', kind: 'raise', amount: 20 }); // 4bet は最後 (round2)
  });
});

describe('withBlinds', () => {
  it('誰もアクションしてなければ SB 0.5bb / BB 1bb を白ラベルで表示', () => {
    const popups = withBlinds([]);
    expect(popups).toContainEqual({ position: 'SB', kind: 'blind', label: '0.5bb' });
    expect(popups).toContainEqual({ position: 'BB', kind: 'blind', label: '1bb' });
  });

  it('アクション済の SB はブラインドを出さず、そのアクションラベルに差し替え', () => {
    const popups = withBlinds([{ position: 'SB', kind: 'raise', label: 'raise 3' }]);
    expect(popups.find((p) => p.position === 'SB')).toEqual({ position: 'SB', kind: 'raise', label: 'raise 3' });
    expect(popups.find((p) => p.position === 'BB')).toEqual({ position: 'BB', kind: 'blind', label: '1bb' });
    // SB のブラインドポップアップは無い
    expect(popups.filter((p) => p.position === 'SB')).toHaveLength(1);
  });
});

describe('getActionDelay', () => {
  it('fold は速め (0.4秒)、その他は 0.6秒', () => {
    expect(getActionDelay('fold')).toBe(FOLD_DELAY_MS);
    expect(getActionDelay('fold')).toBe(400);
    expect(getActionDelay('raise')).toBe(OTHER_DELAY_MS);
    expect(getActionDelay('raise')).toBe(600);
    expect(getActionDelay('call')).toBe(600);
    expect(getActionDelay('limp')).toBe(600);
    expect(getActionDelay('allin')).toBe(600);
  });
});

describe('toSeatPopups', () => {
  it('同一ポジションの複数行動は最新を採用', () => {
    const items = parseActionHistory([
      { position: 'UTG', action: 'Raise 2.5' },
      { position: 'HJ', action: 'Raise 7.5' },
      { position: 'UTG', action: 'Raise 20' },
    ]);
    const popups = toSeatPopups(items);
    const utg = popups.find((p) => p.position === 'UTG');
    expect(utg?.label).toBe('raise 20');
    expect(popups).toHaveLength(2); // UTG, HJ
  });
});

describe('actionsBeforeHero: 多ラウンドの fold 補完 (バグ1)', () => {
  // cor_btnr_co 相当: CO open → BTN 3bet。folded=[UTG,HJ,SB,BB] だが
  // action_history に SB/BB の fold が欠落している。
  const items = parseActionHistory([
    { position: 'UTG', action: 'Fold' },
    { position: 'HJ', action: 'Fold' },
    { position: 'CO', action: 'Raise 2.5' },
    { position: 'BTN', action: 'Raise 7.5' },
  ]);
  const folded: Position[] = ['UTG', 'HJ', 'SB', 'BB'];

  it('多ラウンド: 欠落した SB/BB の fold を補完し、席順に並べる', () => {
    const r = actionsBeforeHero(items, 'CO', folded);
    expect(r.map((x) => `${x.position}:${x.kind}`)).toEqual([
      'UTG:fold', 'HJ:fold', 'CO:raise', 'BTN:raise', 'SB:fold', 'BB:fold',
    ]);
  });

  it('補完後 withBlinds は SB/BB をブラインドにせず fold 表示にする', () => {
    const popups = withBlinds(toSeatPopups(actionsBeforeHero(items, 'CO', folded)));
    expect(popups.find((p) => p.position === 'SB')).toEqual({ position: 'SB', kind: 'fold', label: 'fold' });
    expect(popups.find((p) => p.position === 'BB')).toEqual({ position: 'BB', kind: 'fold', label: 'fold' });
    expect(popups.some((p) => p.kind === 'blind')).toBe(false);
  });

  it('folded 未指定なら従来どおり補完しない (後方互換)', () => {
    const r = actionsBeforeHero(items, 'CO');
    expect(r.some((x) => x.position === 'SB')).toBe(false);
    expect(r.some((x) => x.position === 'BB')).toBe(false);
  });

  it('vs_open: folded を渡しても後ろの席は補完しない (既知バグ再発防止)', () => {
    const vsOpen = parseActionHistory([{ position: 'UTG', action: 'Raise 2.5' }]);
    const r = actionsBeforeHero(vsOpen, 'HJ', ['CO', 'BTN', 'SB', 'BB']);
    expect(r.map((x) => x.position)).toEqual(['UTG']);
  });
});

describe('実ノードデータ: 多ラウンドで降りた席が fold 表示 (バグ1)', () => {
  const root = 'public/data/preflop/cash_100bb_6max_nl500_2.5x/';
  for (const f of ['cor_btnr_co.json', 'cor_btnai_co.json', 'hjr_cor_hjai_co.json']) {
    it(`${f}: folded_positions の席がブラインドではなく fold で表示される`, () => {
      const gi = JSON.parse(readFileSync(root + f, 'utf8')).game_info as {
        hero_position: Position;
        folded_positions: Position[];
        action_history: { position: string; action: string }[];
      };
      const items = parseActionHistory(gi.action_history);
      const before = actionsBeforeHero(items, gi.hero_position, gi.folded_positions);
      const popups = withBlinds(toSeatPopups(before));
      for (const pos of gi.folded_positions) {
        expect(popups.find((p) => p.position === pos)?.kind).toBe('fold');
      }
      expect(popups.some((p) => p.kind === 'blind')).toBe(false);
    });
  }
});
