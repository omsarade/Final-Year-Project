import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const DEVICE_CONFIG = {
  light1: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.07-.707.707M6.343 17.657l-.707.707m12.728 0-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
      </svg>
    ),
    onClass: 'device-on-amber',
    toggleOn: 'bg-amber-400',
    iconOn: 'text-amber-300',
    accentColor: 'rgba(251,191,36,0.7)',
  },
  light2: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    onClass: 'device-on-amber',
    toggleOn: 'bg-amber-400',
    iconOn: 'text-amber-300',
    accentColor: 'rgba(251,191,36,0.7)',
  },
  fan: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5c-1.5 0-3 1.5-3 3s1.5 2 3 2 3-1.5 3-3-1.5-2-3-2zm0 0C12 3 10.5 1.5 9 3S7.5 6 9 7.5M12 4.5C12 3 13.5 1.5 15 3s1.5 3 0 4.5M12 12m-4.5 4.5c0 1.5 1.5 3 3 3s2-1.5 2-3-1.5-3-3-3-2 1.5-2 3zm0 0c-1.5 0-3-1.5-3-3S6 9 7.5 9M7.5 16.5C6 16.5 4.5 15 4.5 13.5S6 12 7.5 12M16.5 16.5c0-1.5-1.5-3-3-3s-2 1.5-2 3 1.5 3 3 3 2-1.5 2-3zm0 0c1.5 0 3-1.5 3-3s-1.5-3-3-3" />
      </svg>
    ),
    onClass: 'device-on-cyan',
    toggleOn: 'bg-cyan-400',
    iconOn: 'text-cyan-300',
    accentColor: 'rgba(34,211,238,0.7)',
  },
  ac: {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18M7.5 3v18M12 3v18M16.5 3v18" />
      </svg>
    ),
    onClass: 'device-on-blue',
    toggleOn: 'bg-blue-400',
    iconOn: 'text-blue-300',
    accentColor: 'rgba(96,165,250,0.7)',
  },
};

const getFallbackConfig = () => ({
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  onClass: 'device-on-cyan',
  toggleOn: 'bg-cyan-400',
  iconOn: 'text-cyan-300',
  accentColor: 'rgba(34,211,238,0.7)',
});

export default function DeviceCard({ id, label, isOn, schedule, onToggle, onRename, onScheduleChange, onRemove }) {
  const cardRef = useRef(null);
  const iconRef = useRef(null);
  const toggleRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(schedule?.on || '');
  const [scheduleOff, setScheduleOff] = useState(schedule?.off || '');

  useEffect(() => {
    setScheduleOn(schedule?.on || '');
    setScheduleOff(schedule?.off || '');
  }, [schedule]);

  const cfg = DEVICE_CONFIG[id] || getFallbackConfig();

  const handleEditSubmit = () => {
    if (editValue.trim() !== '') onRename?.(id, editValue.trim());
    else setEditValue(label);
    setIsEditing(false);
  };

  const handleScheduleSubmit = () => {
    onScheduleChange?.(id, { on: scheduleOn, off: scheduleOff });
    setIsScheduling(false);
  };

  useEffect(() => {
    if (!iconRef.current) return;
    if (isOn) {
      gsap.to(iconRef.current, { scale: 1.15, duration: 0.4, ease: 'back.out(1.7)' });
    } else {
      gsap.to(iconRef.current, { scale: 1, duration: 0.3, ease: 'power2.inOut' });
    }
  }, [isOn]);

  const handleMouseEnter = () => gsap.to(cardRef.current, { scale: 1.02, duration: 0.25, ease: 'power2.out' });
  const handleMouseLeave = () => gsap.to(cardRef.current, { scale: 1, duration: 0.25, ease: 'power2.out' });

  const handleToggle = () => {
    gsap.timeline()
      .to(toggleRef.current, { scale: 0.88, duration: 0.1, ease: 'power2.in' })
      .to(toggleRef.current, { scale: 1.1, duration: 0.15, ease: 'back.out(2.5)' })
      .to(toggleRef.current, { scale: 1, duration: 0.1, ease: 'power2.out' });
    onToggle(id);
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`glass-card rounded-2xl p-5 select-none relative group ${isOn ? cfg.onClass : ''} ${isScheduling ? '' : 'cursor-pointer'}`}
      style={{ willChange: 'transform' }}
      onClick={isScheduling ? undefined : handleToggle}
    >
      {/* Top row: icon + action buttons */}
      <div className="flex items-start justify-between mb-4">
        <div
          ref={iconRef}
          className={`transition-colors duration-400 ${isOn ? cfg.iconOn : 'text-slate-600 group-hover:text-slate-400'}`}
        >
          {cfg.icon}
        </div>

        {/* Action buttons — only visible on hover */}
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="text-slate-600 hover:text-slate-300 p-1 rounded"
            title="Schedule"
            onClick={e => { 
              e.stopPropagation(); 
              if (!isScheduling) {
                const now = new Date();
                const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                setScheduleOn(nowStr);
                setScheduleOff(nowStr);
              }
              setIsScheduling(s => !s); 
              setIsEditing(false); 
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            className="text-slate-600 hover:text-slate-300 p-1 rounded"
            title="Rename"
            onClick={e => { e.stopPropagation(); setEditValue(label); setIsEditing(true); setIsScheduling(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
            </svg>
          </button>
          <button
            className="text-slate-700 hover:text-red-400 p-1 rounded"
            title="Remove"
            onClick={e => { e.stopPropagation(); onRemove?.(id); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Label */}
      {isEditing ? (
        <input
          autoFocus
          type="text"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleEditSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') handleEditSubmit();
            if (e.key === 'Escape') { setEditValue(label); setIsEditing(false); }
          }}
          className="glass-input text-white text-xs font-medium tracking-widest px-2 py-1 rounded w-full mb-3"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-widest mb-3">
          {label}
        </p>
      )}

      {/* Schedule panel */}
      {isScheduling && (
        <div
          className="mt-3 mb-1 bg-black/20 rounded-xl p-3 border border-white/[0.06]"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-3 mb-3">
            {[['Turn ON', scheduleOn, setScheduleOn], ['Turn OFF', scheduleOff, setScheduleOff]].map(([lbl, val, setter]) => (
              <div key={lbl} className="flex-1">
                <label className="text-slate-500 text-[10px] uppercase tracking-wider block mb-1">{lbl}</label>
                <input type="time" value={val} onChange={e => setter(e.target.value)}
                  className="glass-input font-mono-data text-white text-xs rounded-lg px-2 py-1.5 w-full" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleScheduleSubmit}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white text-xs py-1.5 rounded-lg font-semibold transition-all">
              Save
            </button>
            <button onClick={() => { setScheduleOn(schedule?.on || ''); setScheduleOff(schedule?.off || ''); setIsScheduling(false); }}
              className="flex-1 border border-white/10 hover:border-white/20 text-slate-400 text-xs py-1.5 rounded-lg transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status + LED */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${isOn ? `shadow-[0_0_6px_${cfg.accentColor}]` : 'bg-slate-700'}`}
          style={isOn ? { backgroundColor: cfg.accentColor } : {}} />
        <span className={`text-sm font-semibold transition-colors duration-300 ${isOn ? 'text-white' : 'text-slate-600'}`}>
          {isOn ? 'Active' : 'Offline'}
        </span>
      </div>

      {/* Toggle Switch */}
      <div className="flex items-center justify-between">
        <div
          ref={toggleRef}
          className={`relative w-11 h-6 rounded-full cursor-pointer border border-white/[0.08] transition-colors duration-300 ${isOn ? cfg.toggleOn : 'bg-slate-800'}`}
          style={{ willChange: 'transform' }}
        >
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isOn ? 'left-5' : 'left-0.5'}`} />
        </div>
        <span className={`text-[10px] font-mono-data font-bold tracking-[0.2em] ${isOn ? 'text-white' : 'text-slate-700'}`}>
          {isOn ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
}
