import { describe, it, expect } from 'vitest';
import {
  scoreSlider,
  isExtremeFreq,
  SLIDER_SKIP_POINTS,
  SLIDER_TIMEOUT_POINTS,
} from './sliderScoring';

describe('isExtremeFreq', () => {
  it('0% / 100% は端', () => {
    expect(isExtremeFreq(0)).toBe(true);
    expect(isExtremeFreq(100)).toBe(true);
  });
  it('中間 (13/50/96) は端でない', () => {
    expect(isExtremeFreq(13)).toBe(false);
    expect(isExtremeFreq(50)).toBe(false);
    expect(isExtremeFreq(96)).toBe(false);
  });
});

describe('scoreSlider: 正解が端 (0% / 100%)', () => {
  it('100%: ピッタリ=2 / ±10=1 / それ以外=-1', () => {
    expect(scoreSlider(100, 100)).toBe(2);
    expect(scoreSlider(100, 90)).toBe(1);
    expect(scoreSlider(100, 80)).toBe(-1);
  });
  it('0%: ピッタリ=2 / ±10=1 / それ以外=-1', () => {
    expect(scoreSlider(0, 0)).toBe(2);
    expect(scoreSlider(0, 10)).toBe(1);
    expect(scoreSlider(0, 20)).toBe(-1);
  });
});

describe('scoreSlider: 正解が中間 (10–90%)', () => {
  it('50%: ±10=2 / ±20=1 / それ以外=-1', () => {
    expect(scoreSlider(50, 50)).toBe(2);
    expect(scoreSlider(50, 40)).toBe(2);
    expect(scoreSlider(50, 60)).toBe(2);
    expect(scoreSlider(50, 30)).toBe(1);
    expect(scoreSlider(50, 70)).toBe(1);
    expect(scoreSlider(50, 20)).toBe(-1);
    expect(scoreSlider(50, 80)).toBe(-1);
  });
  it('13% (端数): ±10=2 / ±20=1 / それ以外=-1', () => {
    expect(scoreSlider(13, 10)).toBe(2);  // diff 3
    expect(scoreSlider(13, 20)).toBe(2);  // diff 7
    expect(scoreSlider(13, 0)).toBe(1);   // diff 13
    expect(scoreSlider(13, 30)).toBe(1);  // diff 17
    expect(scoreSlider(13, 40)).toBe(-1); // diff 27
  });
});

describe('飛ばし / 時間切れ', () => {
  it('飛ばし=0pt, 時間切れ=-1pt', () => {
    expect(SLIDER_SKIP_POINTS).toBe(0);
    expect(SLIDER_TIMEOUT_POINTS).toBe(-1);
  });
});
