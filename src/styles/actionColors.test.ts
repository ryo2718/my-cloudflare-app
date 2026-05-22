// フェーズ1: アクション色が単一定義 (ACTION_COLOR) に集約され、各系統がそれを参照することの検証。

import { describe, it, expect } from 'vitest';
import { ACTION_COLOR } from './actionColors';
import { ACTION_COLORS } from '../data/training/actionHistory';
import { ACTION_BG } from '../components/training/HandRangeMatrix.helpers';
import { ACTION_BUTTON_COLORS } from '../components/training/actionButtonStyle';

describe('アクション色 単一トークン', () => {
  it('確定配色 (A系統) を正とする', () => {
    expect(ACTION_COLOR.allin).toBe('#534AB7');
    expect(ACTION_COLOR.raise).toBe('#D8443C');
    expect(ACTION_COLOR.call).toBe('#3B8A1E');
    expect(ACTION_COLOR.fold).toBe('#2F7BC4');
    expect(ACTION_COLOR.check).toBe(ACTION_COLOR.call); // check = call
    expect(ACTION_COLOR.limp).toBe(ACTION_COLOR.call); // limp = call(緑系)
  });

  it('グリッドのセル塗り (ACTION_BG) は単一定義を参照', () => {
    for (const a of ['allin', 'raise', 'call', 'check', 'fold'] as const) {
      expect(ACTION_BG[a]).toBe(ACTION_COLOR[a]);
    }
  });

  it('ポップアップ/即時FBバー (ACTION_COLORS) の bg/border は単一定義を参照', () => {
    for (const a of ['allin', 'raise', 'call', 'limp', 'fold'] as const) {
      expect(ACTION_COLORS[a].bg).toBe(ACTION_COLOR[a]);
      expect(ACTION_COLORS[a].border).toBe(ACTION_COLOR[a]);
    }
  });

  it('選択肢ボタン (ACTION_BUTTON_COLORS) の濃枠は単一定義を参照 (薄地+濃枠は維持)', () => {
    for (const a of ['allin', 'raise', 'call', 'check', 'fold'] as const) {
      expect(ACTION_BUTTON_COLORS[a].border).toBe(ACTION_COLOR[a]);
    }
    // 薄地 (bg) は装飾シェードのまま (= border とは別)。
    expect(ACTION_BUTTON_COLORS.call.bg).not.toBe(ACTION_COLOR.call);
  });
});
