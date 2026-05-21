import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nodePathFor,
  availableOpponents,
  scenarioAvailable,
  rangeFromNode,
  presetLabel,
  type PreflopNode,
} from './presetRange';
import { handKeys, handAt } from './combos';

const ROOT = join(process.cwd(), 'public/data/preflop/cash_100bb_6max_nl500_2.5x');
const loadNode = (name: string): PreflopNode => JSON.parse(readFileSync(join(ROOT, `${name}.json`), 'utf8'));

describe('presetRange: ノードパス構築', () => {
  it('open / vs open / vs 3bet / vs 4bet の規則', () => {
    expect(nodePathFor('CO', 'open', null)).toBe('co');
    expect(nodePathFor('BB', 'vsopen', 'CO')).toBe('cor_bb');
    expect(nodePathFor('CO', 'vs3bet', 'BB')).toBe('cor_bbr_co');
    expect(nodePathFor('BB', 'vs4bet', 'CO')).toBe('cor_bbr_cor_bb');
  });

  it('存在しない組み合わせは null (UTG vs open は相手がいない)', () => {
    expect(nodePathFor('UTG', 'vsopen', 'HJ')).toBeNull();
    expect(scenarioAvailable('UTG', 'vsopen')).toBe(false);
    expect(availableOpponents('UTG', 'vsopen')).toEqual([]);
  });

  it('availableOpponents は存在ノードのみ・全て有効パス', () => {
    const opps = availableOpponents('BB', 'vsopen');
    expect(opps.length).toBeGreaterThan(0);
    for (const o of opps) expect(nodePathFor('BB', 'vsopen', o)).not.toBeNull();
    // UTG は誰よりも前なので open のみ可能。
    expect(scenarioAvailable('UTG', 'open')).toBe(true);
    expect(scenarioAvailable('UTG', 'vs3bet')).toBe(true);
  });
});

describe('presetRange: ラベル', () => {
  it('open / vs open / vs 3bet / vs 4bet のラベル + 編集済み', () => {
    expect(presetLabel({ position: 'UTG', scenario: 'open', vsPosition: null }, false)).toBe('UTG open');
    expect(presetLabel({ position: 'HJ', scenario: 'vsopen', vsPosition: 'UTG' }, false)).toBe('HJ vs open (UTG)');
    expect(presetLabel({ position: 'BTN', scenario: 'vs3bet', vsPosition: 'SB' }, false)).toBe('BTN vs 3bet (SB)');
    expect(presetLabel({ position: 'CO', scenario: 'vs4bet', vsPosition: 'BTN' }, false)).toBe('CO vs 4bet (BTN)');
    expect(presetLabel({ position: 'UTG', scenario: 'open', vsPosition: null }, true)).toBe('UTG open (編集済み)');
  });
});

describe('presetRange: ノード → 頻度付きレンジ', () => {
  it('CO open: AA は weight 1、22 は部分 (raise<100)', () => {
    const range = rangeFromNode(loadNode('co'));
    for (const k of handKeys(handAt(0, 0))) expect(range.get(k)).toBe(1); // AA 全コンボ 1.0
    // 72o のような最弱はレンジ外 (weight 無し or 0)。
    const worst = handKeys(handAt(12, 1)); // 72o 付近
    for (const k of worst) expect(range.get(k) ?? 0).toBeLessThan(1);
  });

  it('参加頻度 = (raise+call+allin)/100。CO open の 22 は raise 56 → weight 0.56', () => {
    const node = loadNode('co');
    const f = node.hands!['22'];
    const part = ((f.raise ?? 0) + (f.call ?? 0) + (f.allin ?? 0)) / 100;
    const range = rangeFromNode(node);
    for (const k of handKeys(handAt(12, 12))) expect(range.get(k)).toBeCloseTo(part, 5); // 22
  });
});
