// 出題傾向ガードレールテスト: 各モードを多数セッション生成し、難易度・構成が
// 想定帯に収まることを検証する。ロジック変更で難易度が激変したら検知する。
// 閾値は「激変検知」向けのやや緩めの帯 (小さな調整では落ちない)。
//
// シミュレーション: 各モード 200 セッション (fetch は public/data をスタブ)。

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generatePreflopQuestions } from './preflopBeginner';
import { generateIntermediateQuestions } from './preflopIntermediate';
import {
  generatePositionalQuestions,
  positionalNodeFile,
  maxScoreForMode,
  __testing__,
  type PositionalMode,
} from './preflopIntermediatePositional';

const SESSIONS = 200;
const ACTS = ['allin', 'raise', 'call', 'check', 'fold'] as const;
type Strat = Record<string, number>;

/** 混合戦略: 2アクション以上が頻度>0 かつ 最大頻度<99.5% (集計レポート定義)。 */
function isMixed(s: Strat | undefined): boolean {
  if (!s) return false;
  const present = ACTS.filter((k) => (s[k] ?? 0) > 0.0001);
  const max = Math.max(0, ...ACTS.map((k) => s[k] ?? 0));
  return present.length >= 2 && max < 99.5;
}

interface Stats {
  throws: number;
  totalQ: number;
  mixedQ: number;
  perSessionTotal: number[];
  format: { slider: number; select: number };
  perSessionSlider: number[];
  perSessionSelect: number[];
  sliderEnds: number;
  sliderMid: number;
  scenario: Record<string, number[]>; // scenario -> per-session counts
  blindLight: number[];
}

function newStats(): Stats {
  return { throws: 0, totalQ: 0, mixedQ: 0, perSessionTotal: [], format: { slider: 0, select: 0 }, perSessionSlider: [], perSessionSelect: [], sliderEnds: 0, sliderMid: 0, scenario: {}, blindLight: [] };
}

const stats: Record<string, Stats> = {};

beforeAll(async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const rel = (url as string).replace(/^\//, '');
    try {
      const t = await readFile(path.join(process.cwd(), 'public', rel), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(t) } as Response;
    } catch {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
  });

  // 初級
  const beg = newStats();
  for (let i = 0; i < SESSIONS; i++) {
    try {
      const qs = await generatePreflopQuestions(20);
      beg.perSessionTotal.push(qs.length);
      for (const q of qs) {
        beg.totalQ += 1;
        if (isMixed(q.strategy as unknown as Strat | undefined)) beg.mixedQ += 1;
        (beg.scenario[q.scenario] = beg.scenario[q.scenario] ?? []).push(0);
      }
    } catch {
      beg.throws += 1;
    }
  }
  stats.beginner = beg;

  // 中級総合
  const inter = newStats();
  for (let i = 0; i < SESSIONS; i++) {
    try {
      const qs = await generateIntermediateQuestions();
      inter.perSessionTotal.push(qs.length);
      const sc: Record<string, number> = {};
      for (const q of qs) {
        inter.totalQ += 1;
        if (isMixed(q.strategy as unknown as Strat)) inter.mixedQ += 1;
        sc[q.scenarioType] = (sc[q.scenarioType] ?? 0) + 1;
      }
      for (const k of Object.keys(sc)) (inter.scenario[k] = inter.scenario[k] ?? []).push(sc[k]);
    } catch {
      inter.throws += 1;
    }
  }
  stats.intermediate = inter;

  // ポジショナル EP/LP/Blind
  for (const mode of ['ep', 'lp', 'blind'] as PositionalMode[]) {
    const m = newStats();
    for (let i = 0; i < SESSIONS; i++) {
      try {
        const qs = await generatePositionalQuestions(mode);
        m.perSessionTotal.push(qs.length);
        let slider = 0;
        let select = 0;
        let light = 0;
        const sc: Record<string, number> = {};
        for (const q of qs) {
          m.totalQ += 1;
          if (isMixed(q.strategy as unknown as Strat)) m.mixedQ += 1;
          sc[q.scenarioKey] = (sc[q.scenarioKey] ?? 0) + 1;
          if (q.format === 'slider') {
            slider += 1;
            m.format.slider += 1;
            if (q.sliderCorrectPct <= 0 || q.sliderCorrectPct >= 100) m.sliderEnds += 1;
            else m.sliderMid += 1;
          } else {
            select += 1;
            m.format.select += 1;
          }
          if (mode === 'blind' && (q.scenarioKey === 'bb_vs_open_other' || q.scenarioKey === 'bb_vs_open_sb')) {
            const f = positionalNodeFile(q.scenarioKey, { hero: q.myPosition, opener: q.opener, threeBettor: q.threeBettor });
            if (f && __testing__.lightThreeBetCandidates(__testing__.cache[f]).includes(q.hand)) light += 1;
          }
        }
        m.perSessionSlider.push(slider);
        m.perSessionSelect.push(select);
        if (mode === 'blind') m.blindLight.push(light);
        for (const k of Object.keys(sc)) (m.scenario[k] = m.scenario[k] ?? []).push(sc[k]);
      } catch {
        m.throws += 1;
      }
    }
    stats[mode] = m;
  }
}, 120000);

afterAll(() => vi.unstubAllGlobals());

const mixedPct = (s: Stats) => (100 * s.mixedQ) / s.totalQ;
const constEq = (arr: number[], v: number) => arr.length > 0 && Math.min(...arr) === v && Math.max(...arr) === v;

describe('難易度ガードレール', () => {
  it('項目1: 問題数・満点が定義どおり', () => {
    expect(constEq(stats.beginner.perSessionTotal, 20)).toBe(true);
    expect(constEq(stats.intermediate.perSessionTotal, 20)).toBe(true);
    expect(constEq(stats.ep.perSessionTotal, 20)).toBe(true);
    expect(constEq(stats.lp.perSessionTotal, 20)).toBe(true);
    expect(constEq(stats.blind.perSessionTotal, 30)).toBe(true);
    expect(maxScoreForMode('ep')).toBe(20);
    expect(maxScoreForMode('lp')).toBe(20);
    expect(maxScoreForMode('blind')).toBe(30);
  });

  it('項目2: 形式構成 (EP slider10/select10, LP slider8/select12, Blind slider3/select27)', () => {
    // EP: ep_vs_4bet 3→2 / ep_vs_3bet 9→10 振替で slider(ep_open8+ep_vs_4bet2)=10 / select(ep_vs_3bet10)=10。
    expect(constEq(stats.ep.perSessionSlider, 10)).toBe(true);
    expect(constEq(stats.ep.perSessionSelect, 10)).toBe(true);
    // LP: lp_vs_4bet 6→3 / lp_vs_3bet 6→9 振替で slider(lp_open3+lp_vs_open_co2+lp_vs_4bet3)=8 / select=12。
    expect(constEq(stats.lp.perSessionSlider, 8)).toBe(true);
    expect(constEq(stats.lp.perSessionSelect, 12)).toBe(true);
    expect(constEq(stats.blind.perSessionSlider, 3)).toBe(true);
    expect(constEq(stats.blind.perSessionSelect, 27)).toBe(true);
  });

  it('項目3: 混合戦略%の帯 (難易度の主指標)', () => {
    expect(mixedPct(stats.beginner)).toBeLessThan(25);
    expect(mixedPct(stats.ep)).toBeGreaterThanOrEqual(70);
    expect(mixedPct(stats.ep)).toBeLessThanOrEqual(88);
    expect(mixedPct(stats.lp)).toBeGreaterThanOrEqual(75);
    expect(mixedPct(stats.lp)).toBeLessThanOrEqual(90);
    expect(mixedPct(stats.intermediate)).toBeGreaterThan(95);
    expect(mixedPct(stats.blind)).toBeGreaterThan(93);
  });

  it('項目4: スライダー正解%分布 (端/中間に偏りすぎない)', () => {
    // EP/LP は端も中間も一定数出る。Blind のスライダーは中間主体。
    expect(stats.ep.sliderEnds).toBeGreaterThan(0);
    expect(stats.ep.sliderMid).toBeGreaterThan(0);
    expect(stats.lp.sliderEnds).toBeGreaterThan(0);
    expect(stats.lp.sliderMid).toBeGreaterThan(0);
    expect(stats.blind.sliderMid).toBeGreaterThan(0);
  });

  it('項目5: BB ライト3bet 下限 (毎セッション3題以上)', () => {
    expect(stats.blind.blindLight.length).toBe(SESSIONS);
    expect(Math.min(...stats.blind.blindLight)).toBeGreaterThanOrEqual(3);
  });

  it('項目6: 生成の堅牢性 (全モード throw 0件)', () => {
    for (const k of ['beginner', 'intermediate', 'ep', 'lp', 'blind']) {
      expect(stats[k].throws).toBe(0);
    }
  });

  it('項目7: シナリオ配分 (ポジショナル固定 / 総合はレンジ内・合計20)', () => {
    // ポジショナル: 各シナリオ題数は固定。
    expect(constEq(stats.blind.scenario.bb_vs_open_other, 6)).toBe(true);
    expect(constEq(stats.blind.scenario.bb_vs_open_sb, 3)).toBe(true);
    expect(constEq(stats.ep.scenario.ep_vs_4bet, 2)).toBe(true);
    expect(constEq(stats.ep.scenario.ep_open, 8)).toBe(true);
    expect(constEq(stats.ep.scenario.ep_vs_3bet, 10)).toBe(true);
    // 中級総合: 各シナリオ題数は定義レンジ内、合計20。
    const ranges: Record<string, [number, number]> = {
      bb_response: [3, 6], vs_3bet: [5, 7], vs_4bet: [1, 3], middle_vs_open: [4, 6], risky_open: [1, 3],
    };
    for (const [k, [lo, hi]] of Object.entries(ranges)) {
      const counts = stats.intermediate.scenario[k] ?? [];
      expect(counts.length).toBe(SESSIONS); // 毎セッション必ず出る
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(lo);
      expect(Math.max(...counts)).toBeLessThanOrEqual(hi);
    }
  });
});
