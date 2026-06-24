/**
 * ScenesPanel — One-tap Smart Scene cards
 * ----------------------------------------
 * Displays 4 preset scenes. Tapping a scene fires all device commands at once.
 * The card glows when the current device states exactly match a scene.
 */

import { useState } from 'react';

// ── Scene definitions ────────────────────────────────────────────────────────
export const SCENES = [
  {
    id: 'good_morning',
    name: 'Good Morning',
    emoji: '☀️',
    description: 'Start the day bright',
    gradient: 'from-amber-500/20 to-orange-500/10',
    glowColor: 'rgba(251,191,36,0.25)',
    borderActive: 'rgba(251,191,36,0.4)',
    textColor: 'text-amber-300',
    dotColor: 'bg-amber-400',
    states: { light1: true, light2: true, fan: false, tv: false },
  },
  {
    id: 'movie_night',
    name: 'Movie Night',
    emoji: '🎬',
    description: 'Dim lights, cool air',
    gradient: 'from-violet-500/20 to-purple-500/10',
    glowColor: 'rgba(167,139,250,0.25)',
    borderActive: 'rgba(167,139,250,0.4)',
    textColor: 'text-violet-300',
    dotColor: 'bg-violet-400',
    states: { light1: false, light2: true, fan: true, tv: false },
  },
  {
    id: 'sleep_mode',
    name: 'Sleep Mode',
    emoji: '🌙',
    description: 'Everything off, rest well',
    gradient: 'from-blue-500/20 to-indigo-500/10',
    glowColor: 'rgba(99,102,241,0.25)',
    borderActive: 'rgba(99,102,241,0.4)',
    textColor: 'text-indigo-300',
    dotColor: 'bg-indigo-400',
    states: { light1: false, light2: false, fan: false, tv: false },
  },
  {
    id: 'away',
    name: 'Away',
    emoji: '🔒',
    description: 'Leaving home? All off',
    gradient: 'from-slate-500/20 to-slate-600/10',
    glowColor: 'rgba(100,116,139,0.25)',
    borderActive: 'rgba(100,116,139,0.4)',
    textColor: 'text-slate-300',
    dotColor: 'bg-slate-400',
    states: { light1: false, light2: false, fan: false, tv: false },
  },
];

// ── Device label map for the mini indicators inside each scene card ──────────
const DEVICE_LABELS = {
  light1: 'L1',
  light2: 'L2',
  fan: 'Fan',
  tv: 'TV',
};

// ── Helper: does current state match a scene? ────────────────────────────────
function isSceneActive(scene, deviceStates) {
  return Object.entries(scene.states).every(
    ([id, val]) => deviceStates[id] === val
  );
}

// ── Scene Card ───────────────────────────────────────────────────────────────
function SceneCard({ scene, deviceStates, onApply, isActivating }) {
  const active = isSceneActive(scene, deviceStates);

  return (
    <button
      onClick={() => onApply(scene)}
      disabled={isActivating}
      className={`
        relative group flex-1 min-w-[140px] rounded-2xl p-4 text-left
        border transition-all duration-300 select-none
        bg-gradient-to-br ${scene.gradient}
        ${active
          ? 'scale-[1.02]'
          : 'hover:scale-[1.02] hover:brightness-110'
        }
        ${isActivating ? 'opacity-60 cursor-wait' : 'cursor-pointer'}
      `}
      style={{
        border: `1px solid ${active ? scene.borderActive : 'rgba(255,255,255,0.08)'}`,
        boxShadow: active
          ? `0 0 28px ${scene.glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Active badge */}
      {active && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full ${scene.textColor} bg-white/[0.08]`}>
          ACTIVE
        </span>
      )}

      {/* Emoji + Name */}
      <div className="mb-3">
        <span className="text-2xl leading-none block mb-1.5">{scene.emoji}</span>
        <p className={`text-xs font-bold tracking-wide ${scene.textColor}`}>{scene.name}</p>
        <p className="text-slate-500 text-[10px] mt-0.5 leading-snug">{scene.description}</p>
      </div>

      {/* Device state dots */}
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(scene.states).map(([id, on]) => (
          <div key={id} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${on ? scene.dotColor : 'bg-slate-700'}`} />
            <span className="text-[9px] text-slate-600 font-mono">{DEVICE_LABELS[id]}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

// ── Scenes Panel ─────────────────────────────────────────────────────────────
export default function ScenesPanel({ deviceStates, onApplyScene }) {
  const [activatingId, setActivatingId] = useState(null);

  const handleApply = async (scene) => {
    setActivatingId(scene.id);
    await onApplyScene(scene.states);
    setTimeout(() => setActivatingId(null), 800);
  };

  return (
    <div className="glass-panel rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-indigo-400">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-widest">
          Smart Scenes
        </span>
        <span className="ml-auto text-slate-600 text-[10px] font-medium">tap to activate</span>
      </div>

      {/* Scene cards row */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-0.5">
        {SCENES.map(scene => (
          <SceneCard
            key={scene.id}
            scene={scene}
            deviceStates={deviceStates}
            onApply={handleApply}
            isActivating={activatingId === scene.id}
          />
        ))}
      </div>
    </div>
  );
}
