// @vitest-environment jsdom
// フェーズ3: タイマー (Countdown) のカウントダウンと時間切れ発火 (fake timers で決定的に検証)。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '../../test/ui';
import { Countdown } from './Countdown';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Countdown', () => {
  it('初期は「残り N s」を表示する', () => {
    const { container } = render(<Countdown seconds={20} onTimeUp={() => {}} />);
    expect(container.textContent).toContain('残り');
    expect(container.textContent).toContain('20');
  });

  it('時間切れで onTimeUp を1回だけ呼ぶ', () => {
    const onTimeUp = vi.fn();
    render(<Countdown seconds={20} onTimeUp={onTimeUp} />);
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(onTimeUp).toHaveBeenCalledTimes(1);
  });

  it('途中ではまだ呼ばれない', () => {
    const onTimeUp = vi.fn();
    render(<Countdown seconds={20} onTimeUp={onTimeUp} />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onTimeUp).not.toHaveBeenCalled();
  });
});
