import React, { useState, useEffect, useMemo } from 'react';

// ========================================
// ハンドマトリクス定義
// ========================================
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// 13×13マトリクスのハンド名生成
// 対角線=ペア、上三角=suited、下三角=offsuit
function getHandName(row, col) {
  const r1 = RANKS[row];
  const r2 = RANKS[col];
  if (row === col) return r1 + r2; // ペア (例: AA)
  if (row < col) return r1 + r2 + 's'; // suited (例: AKs)
  return r2 + r1 + 'o'; // offsuit (例: AKo)
}

// ハンドの組み合わせ数 (頻度計算用)
function getCombos(hand) {
  if (hand.length === 2) return 6; // ペア
  if (hand.endsWith('s')) return 4; // suited
  return 12; // offsuit
}

// ========================================
// サンプルデータ (rfi_utg.json と同じ)
// ========================================
const SAMPLE_DATA = {
  schema_version: "1.0.0",
  metadata: {
    scenario_id: "rfi_utg",
    scenario_name: "UTG Open (RFI)",
    table_size: "6max",
    stack_bb: 100,
    hero_position: "UTG",
    villain_position: null,
    scenario_type: "rfi",
    pot_bb: 1.5,
    to_call_bb: 1.0,
    description: "UTGからのオープンレンジ"
  },
  actions: [
    { id: "fold", label: "Fold", size_bb: 0, color: "#475569" },
    { id: "raise_2.5", label: "Raise 2.5bb", size_bb: 2.5, color: "#dc2626" }
  ],
  strategy: {
    "AA":[0.00,1.00],"KK":[0.00,1.00],"QQ":[0.00,1.00],"JJ":[0.00,1.00],"TT":[0.00,1.00],
    "99":[0.00,1.00],"88":[0.00,1.00],"77":[0.00,1.00],"66":[0.10,0.90],"55":[0.30,0.70],
    "44":[0.50,0.50],"33":[0.70,0.30],"22":[0.80,0.20],
    "AKs":[0.00,1.00],"AQs":[0.00,1.00],"AJs":[0.00,1.00],"ATs":[0.00,1.00],"A9s":[0.20,0.80],
    "A8s":[0.30,0.70],"A7s":[0.40,0.60],"A6s":[0.60,0.40],"A5s":[0.10,0.90],"A4s":[0.20,0.80],
    "A3s":[0.40,0.60],"A2s":[0.60,0.40],
    "AKo":[0.00,1.00],"AQo":[0.00,1.00],"AJo":[0.10,0.90],"ATo":[0.40,0.60],"A9o":[0.90,0.10],
    "A8o":[1.00,0.00],"A7o":[1.00,0.00],"A6o":[1.00,0.00],"A5o":[1.00,0.00],"A4o":[1.00,0.00],
    "A3o":[1.00,0.00],"A2o":[1.00,0.00],
    "KQs":[0.00,1.00],"KJs":[0.00,1.00],"KTs":[0.00,1.00],"K9s":[0.30,0.70],"K8s":[0.70,0.30],
    "K7s":[0.90,0.10],"K6s":[1.00,0.00],"K5s":[1.00,0.00],"K4s":[1.00,0.00],"K3s":[1.00,0.00],
    "K2s":[1.00,0.00],
    "KQo":[0.00,1.00],"KJo":[0.20,0.80],"KTo":[0.50,0.50],"K9o":[1.00,0.00],"K8o":[1.00,0.00],
    "K7o":[1.00,0.00],"K6o":[1.00,0.00],"K5o":[1.00,0.00],"K4o":[1.00,0.00],"K3o":[1.00,0.00],
    "K2o":[1.00,0.00],
    "QJs":[0.00,1.00],"QTs":[0.00,1.00],"Q9s":[0.40,0.60],"Q8s":[0.80,0.20],"Q7s":[1.00,0.00],
    "Q6s":[1.00,0.00],"Q5s":[1.00,0.00],"Q4s":[1.00,0.00],"Q3s":[1.00,0.00],"Q2s":[1.00,0.00],
    "QJo":[0.30,0.70],"QTo":[0.70,0.30],"Q9o":[1.00,0.00],"Q8o":[1.00,0.00],"Q7o":[1.00,0.00],
    "Q6o":[1.00,0.00],"Q5o":[1.00,0.00],"Q4o":[1.00,0.00],"Q3o":[1.00,0.00],"Q2o":[1.00,0.00],
    "JTs":[0.00,1.00],"J9s":[0.20,0.80],"J8s":[0.70,0.30],"J7s":[1.00,0.00],"J6s":[1.00,0.00],
    "J5s":[1.00,0.00],"J4s":[1.00,0.00],"J3s":[1.00,0.00],"J2s":[1.00,0.00],
    "JTo":[0.60,0.40],"J9o":[1.00,0.00],"J8o":[1.00,0.00],"J7o":[1.00,0.00],"J6o":[1.00,0.00],
    "J5o":[1.00,0.00],"J4o":[1.00,0.00],"J3o":[1.00,0.00],"J2o":[1.00,0.00],
    "T9s":[0.00,1.00],"T8s":[0.40,0.60],"T7s":[0.90,0.10],"T6s":[1.00,0.00],"T5s":[1.00,0.00],
    "T4s":[1.00,0.00],"T3s":[1.00,0.00],"T2s":[1.00,0.00],
    "T9o":[0.90,0.10],"T8o":[1.00,0.00],"T7o":[1.00,0.00],"T6o":[1.00,0.00],"T5o":[1.00,0.00],
    "T4o":[1.00,0.00],"T3o":[1.00,0.00],"T2o":[1.00,0.00],
    "98s":[0.20,0.80],"97s":[0.70,0.30],"96s":[1.00,0.00],"95s":[1.00,0.00],"94s":[1.00,0.00],
    "93s":[1.00,0.00],"92s":[1.00,0.00],
    "98o":[1.00,0.00],"97o":[1.00,0.00],"96o":[1.00,0.00],"95o":[1.00,0.00],"94o":[1.00,0.00],
    "93o":[1.00,0.00],"92o":[1.00,0.00],
    "87s":[0.40,0.60],"86s":[0.90,0.10],"85s":[1.00,0.00],"84s":[1.00,0.00],"83s":[1.00,0.00],
    "82s":[1.00,0.00],
    "87o":[1.00,0.00],"86o":[1.00,0.00],"85o":[1.00,0.00],"84o":[1.00,0.00],"83o":[1.00,0.00],
    "82o":[1.00,0.00],
    "76s":[0.50,0.50],"75s":[0.95,0.05],"74s":[1.00,0.00],"73s":[1.00,0.00],"72s":[1.00,0.00],
    "76o":[1.00,0.00],"75o":[1.00,0.00],"74o":[1.00,0.00],"73o":[1.00,0.00],"72o":[1.00,0.00],
    "65s":[0.60,0.40],"64s":[1.00,0.00],"63s":[1.00,0.00],"62s":[1.00,0.00],
    "65o":[1.00,0.00],"64o":[1.00,0.00],"63o":[1.00,0.00],"62o":[1.00,0.00],
    "54s":[0.70,0.30],"53s":[1.00,0.00],"52s":[1.00,0.00],
    "54o":[1.00,0.00],"53o":[1.00,0.00],"52o":[1.00,0.00],
    "43s":[1.00,0.00],"42s":[1.00,0.00],"43o":[1.00,0.00],"42o":[1.00,0.00],
    "32s":[1.00,0.00],"32o":[1.00,0.00]
  }
};

// ========================================
// ハンドセル: アクション比率を縦の帯グラデーションで表示
// ========================================
function HandCell({ hand, frequencies, actions, hovered, onHover }) {
  // 帯のグラデーションを構築
  let cumulative = 0;
  const stops = [];
  frequencies.forEach((freq, i) => {
    if (freq <= 0) return;
    const start = cumulative * 100;
    cumulative += freq;
    const end = cumulative * 100;
    stops.push(`${actions[i].color} ${start}%, ${actions[i].color} ${end}%`);
  });
  
  const background = stops.length > 0
    ? `linear-gradient(to top, ${stops.join(', ')})`
    : '#1e293b';
  
  // 主要アクション (最大頻度) を判定
  const maxIdx = frequencies.indexOf(Math.max(...frequencies));
  const isPlayed = maxIdx > 0; // fold以外がメイン
  
  return (
    <div
      onMouseEnter={() => onHover(hand)}
      onMouseLeave={() => onHover(null)}
      style={{
        background,
        position: 'relative',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.65rem',
        fontWeight: 600,
        color: isPlayed ? '#fff' : '#94a3b8',
        border: hovered ? '2px solid #fbbf24' : '1px solid rgba(0,0,0,0.3)',
        cursor: 'pointer',
        transition: 'transform 0.1s, border 0.1s',
        transform: hovered ? 'scale(1.15)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
        userSelect: 'none',
      }}
    >
      {hand}
    </div>
  );
}

// ========================================
// 集約レポート: 各アクションの全体頻度
// ========================================
function AggregateReport({ strategy, actions }) {
  const aggregates = useMemo(() => {
    const totalCombos = Object.keys(strategy).reduce((sum, hand) => sum + getCombos(hand), 0);
    const actionTotals = actions.map(() => 0);
    
    Object.entries(strategy).forEach(([hand, freqs]) => {
      const combos = getCombos(hand);
      freqs.forEach((freq, i) => {
        actionTotals[i] += combos * freq;
      });
    });
    
    return actionTotals.map(t => (t / totalCombos) * 100);
  }, [strategy, actions]);

  return (
    <div style={{ 
      background: '#0f172a',
      borderRadius: '0.5rem',
      padding: '1rem',
      border: '1px solid #1e293b',
    }}>
      <h3 style={{ 
        fontSize: '0.875rem', 
        color: '#94a3b8', 
        marginBottom: '0.75rem',
        fontWeight: 500,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Aggregate Frequencies
      </h3>
      
      {/* 横棒グラフ */}
      <div style={{
        display: 'flex',
        height: '2.5rem',
        borderRadius: '0.25rem',
        overflow: 'hidden',
        marginBottom: '0.75rem',
      }}>
        {aggregates.map((pct, i) => (
          pct > 0 && (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: actions[i].color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              {pct >= 8 && `${pct.toFixed(1)}%`}
            </div>
          )
        ))}
      </div>
      
      {/* 凡例 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        {actions.map((action, i) => (
          <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '0.875rem',
              height: '0.875rem',
              background: action.color,
              borderRadius: '0.125rem',
            }} />
            <span style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
              {action.label}: <strong style={{ color: '#fff' }}>{aggregates[i].toFixed(1)}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========================================
// ハンド詳細パネル
// ========================================
function HandDetail({ hand, strategy, actions }) {
  if (!hand || !strategy[hand]) {
    return (
      <div style={{
        background: '#0f172a',
        borderRadius: '0.5rem',
        padding: '1rem',
        border: '1px solid #1e293b',
        minHeight: '8rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        ハンドにマウスを乗せて詳細表示
      </div>
    );
  }
  
  const freqs = strategy[hand];
  const combos = getCombos(hand);
  
  return (
    <div style={{
      background: '#0f172a',
      borderRadius: '0.5rem',
      padding: '1rem',
      border: '1px solid #1e293b',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <h3 style={{ 
          fontSize: '1.5rem', 
          color: '#fff', 
          fontWeight: 700,
          fontFamily: 'monospace',
        }}>
          {hand}
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {combos} combos
        </span>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {actions.map((action, i) => (
          freqs[i] > 0 && (
            <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                background: action.color,
                borderRadius: '0.125rem',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '0.875rem', color: '#cbd5e1', minWidth: '6rem' }}>
                {action.label}
              </span>
              <div style={{ flex: 1, height: '0.5rem', background: '#1e293b', borderRadius: '0.25rem', overflow: 'hidden' }}>
                <div style={{
                  width: `${freqs[i] * 100}%`,
                  height: '100%',
                  background: action.color,
                }} />
              </div>
              <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600, minWidth: '3rem', textAlign: 'right' }}>
                {(freqs[i] * 100).toFixed(1)}%
              </span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

// ========================================
// メインアプリ
// ========================================
export default function App() {
  const [data] = useState(SAMPLE_DATA);
  const [hoveredHand, setHoveredHand] = useState(null);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      color: '#e2e8f0',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      padding: '1.5rem',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ヘッダー */}
        <header style={{ marginBottom: '1.5rem' }}>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#64748b', 
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '0.25rem',
          }}>
            Preflop Strategy Viewer
          </div>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: 700,
            color: '#fff',
            marginBottom: '0.25rem',
          }}>
            {data.metadata.scenario_name}
          </h1>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {data.metadata.table_size} · {data.metadata.stack_bb}bb · {data.metadata.description}
          </div>
        </header>

        {/* メインレイアウト: マトリクス + サイドパネル */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          
          {/* ハンドマトリクス */}
          <div style={{
            background: '#0f172a',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            border: '1px solid #1e293b',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(13, 1fr)',
              gap: '2px',
            }}>
              {RANKS.map((_, row) =>
                RANKS.map((_, col) => {
                  const hand = getHandName(row, col);
                  const freqs = data.strategy[hand];
                  if (!freqs) return <div key={`${row}-${col}`} />;
                  return (
                    <HandCell
                      key={`${row}-${col}`}
                      hand={hand}
                      frequencies={freqs}
                      actions={data.actions}
                      hovered={hoveredHand === hand}
                      onHover={setHoveredHand}
                    />
                  );
                })
              )}
            </div>
          </div>
          
          {/* サイドパネル */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <HandDetail hand={hoveredHand} strategy={data.strategy} actions={data.actions} />
          </div>
        </div>

        {/* 集約レポート */}
        <AggregateReport strategy={data.strategy} actions={data.actions} />
        
        <footer style={{ 
          marginTop: '2rem', 
          fontSize: '0.75rem', 
          color: '#475569',
          textAlign: 'center',
        }}>
          Schema v{data.schema_version} · Strategy data is sample / placeholder
        </footer>
      </div>
    </div>
  );
}
