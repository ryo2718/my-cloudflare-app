// プリセットレンジ選択 (吹き出し)。プリフロップ GTO ソリューションから
// ポジション × シナリオ (open / vs open / vs 3bet / vs 4bet) のレンジを読み込み、
// 13×13 マトリクスに反映する (頻度付き)。
//   - ソリューションは1種のみなので固定表示
//   - 存在しない (ポジション, シナリオ, 相手) はグレーアウト・選択不可
//   - シナリオは排他 (1つ選択)。選ぶと該当 GTO レンジを onApply で反映

import { useState, type CSSProperties } from 'react';
import type { Position } from '../../types/strategy';
import { THEME } from '../../styles/theme';
import {
  PRESET_POSITIONS,
  SCENARIOS,
  SOLUTION_LABEL,
  type PresetInfo,
  type Scenario,
  availableOpponents,
  fetchPresetRange,
  nodePathFor,
  scenarioAvailable,
} from '../../utils/presetRange';

export interface PresetRangePickerProps {
  /** プリセット読み込み完了時に頻度付きレンジと識別情報を渡す (マトリクスへ反映)。 */
  onApply: (range: Map<string, number>, info: PresetInfo) => void;
}

export function PresetRangePicker({ onApply }: PresetRangePickerProps) {
  const [hero, setHero] = useState<Position>('UTG');
  const [scenario, setScenario] = useState<Scenario>('open');
  const [opp, setOpp] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const apply = async (h: Position, sc: Scenario, o: Position | null) => {
    const path = nodePathFor(h, sc, o);
    if (!path) return;
    setLoading(true);
    setErr(null);
    try {
      const range = await fetchPresetRange(path);
      onApply(range, { position: h, scenario: sc, vsPosition: o });
    } catch {
      setErr('レンジの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const onHeroChange = (h: Position) => {
    setHero(h);
    setScenario('open');
    setOpp(null);
    void apply(h, 'open', null);
  };

  const onScenarioClick = (sc: Scenario) => {
    if (!scenarioAvailable(hero, sc)) return;
    const o = sc === 'open' ? null : (availableOpponents(hero, sc)[0] ?? null);
    setScenario(sc);
    setOpp(o);
    if (sc === 'open' || o) void apply(hero, sc, o);
  };

  const onOppChange = (o: Position) => {
    setOpp(o);
    void apply(hero, scenario, o);
  };

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <label style={labelStyle}>
          ポジション
          <select
            style={selectStyle}
            value={hero}
            onChange={(e) => onHeroChange(e.target.value as Position)}
          >
            {PRESET_POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <span style={solutionStyle}>{SOLUTION_LABEL}</span>
        {loading && <span style={statusStyle}>読み込み中…</span>}
        {err && <span style={errStyle}>{err}</span>}
      </div>

      <div style={scenariosStyle}>
        {SCENARIOS.map(({ key, label }) => {
          const avail = scenarioAvailable(hero, key);
          const selectedSc = scenario === key;
          const opps = key === 'open' ? [] : availableOpponents(hero, key);
          return (
            <div key={key} style={scenarioRowStyle}>
              <button
                type="button"
                disabled={!avail}
                aria-pressed={selectedSc}
                onClick={() => onScenarioClick(key)}
                style={selectedSc ? scenarioBtnActiveStyle : avail ? scenarioBtnStyle : scenarioBtnDisabledStyle}
              >
                {label}
              </button>
              {key !== 'open' && (
                <select
                  style={avail ? selectStyle : selectDisabledStyle}
                  disabled={!avail}
                  value={opp ?? ''}
                  onChange={(e) => onOppChange(e.target.value as Position)}
                >
                  {opps.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.6rem',
  background: THEME.cardElevated,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.5rem',
  marginBottom: '0.6rem',
};
const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' };
const labelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: THEME.textPrimary,
};
const solutionStyle: CSSProperties = { fontSize: '0.78rem', color: THEME.textSecondary };
const statusStyle: CSSProperties = { fontSize: '0.78rem', color: THEME.textSecondary };
const errStyle: CSSProperties = { fontSize: '0.78rem', color: THEME.errorText };
const selectStyle: CSSProperties = {
  padding: '0.25rem 0.4rem',
  background: '#fff',
  color: THEME.textPrimary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
const selectDisabledStyle: CSSProperties = { ...selectStyle, opacity: 0.4, cursor: 'not-allowed' };
const scenariosStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem' };
const scenarioRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.4rem' };
const scenarioBtnStyle: CSSProperties = {
  minWidth: 88,
  padding: '0.3rem 0.6rem',
  background: '#fff',
  color: THEME.textSecondary,
  border: `1px solid ${THEME.border}`,
  borderRadius: '0.35rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'center',
};
const scenarioBtnActiveStyle: CSSProperties = {
  ...scenarioBtnStyle,
  background: THEME.accent,
  color: '#fff',
  borderColor: THEME.accent,
  fontWeight: 700,
};
const scenarioBtnDisabledStyle: CSSProperties = { ...scenarioBtnStyle, opacity: 0.4, cursor: 'not-allowed' };
