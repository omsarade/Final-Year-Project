import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

export default function PowerStats({ deviceStates, devices }) {
  const wattRef = useRef(null);
  const [stats, setStats] = useState({ wattage: 0, voltage: 79.5, amps: '0.00' });

  useEffect(() => {
    const calculatePower = () => {
      let totalW = 0;
      devices.forEach(d => {
        if (deviceStates[d.id]) {
          const label = d.label.toLowerCase();
          if (label.includes('light')) totalW += 15 + Math.random() * 15;
          else if (label.includes('charger')) totalW += 20 + Math.random() * 20;
          else if (label.includes('fan')) totalW += 59.8 + Math.random() * 0.4;
          else totalW += 15 + Math.random() * 45;
        }
      });
      const currentV = totalW > 0 ? 78.5 + Math.random() * 1.3 : 79.5;
      const currentA = totalW > 0 ? totalW / currentV : 0;
      setStats({ wattage: Math.round(totalW), voltage: currentV.toFixed(1), amps: currentA.toFixed(2) });
    };
    calculatePower();
    const id = setInterval(calculatePower, 2000);
    return () => clearInterval(id);
  }, [devices, deviceStates]);

  useEffect(() => {
    if (wattRef.current && stats.wattage > 0) {
      gsap.fromTo(wattRef.current, { opacity: 0.7 }, { opacity: 1, duration: 0.4, ease: 'power1.out' });
    }
  }, [stats.wattage]);

  // Gauge percentage: treat 200W as 100%
  const gaugePercent = Math.min(stats.wattage / 200, 1);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  // Half-circle gauge (bottom half hidden) — use 75% arc
  const arcLen = circumference * 0.75;
  const offset = arcLen * (1 - gaugePercent);

  return (
    <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-indigo-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-widest">Power Usage</span>
      </div>

      {/* Three metrics — monospaced */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { ref: wattRef, value: stats.wattage, unit: 'W', label: 'Watts' },
          { ref: null, value: stats.amps, unit: 'A', label: 'Current' },
          { ref: null, value: stats.voltage, unit: 'V', label: 'Voltage' },
        ].map(({ ref, value, unit, label }, i) => (
          <div key={label} className={i > 0 ? 'border-l border-white/[0.06] pl-4' : ''}>
            <span ref={ref} className="font-mono-data text-2xl font-bold text-white tabular-nums">
              {value}
              <span className="text-sm font-normal text-slate-500 ml-0.5">{unit}</span>
            </span>
            <p className="text-slate-600 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Circular gauge */}
      <div className="flex justify-center">
        <div className="relative w-28 h-16 overflow-hidden">
          <svg viewBox="0 0 100 56" className="w-full h-full" style={{ overflow: 'visible' }}>
            {/* Background arc */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="6"
              strokeDasharray={`${arcLen} ${circumference - arcLen}`}
              strokeDashoffset={circumference * 0.375}
              strokeLinecap="round"
              transform="rotate(135, 50, 50)"
            />
            {/* Active arc */}
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="6"
              strokeDasharray={`${arcLen - offset} ${circumference - (arcLen - offset)}`}
              strokeDashoffset={circumference * 0.375}
              strokeLinecap="round"
              transform="rotate(135, 50, 50)"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.25,1,0.5,1)' }}
            />
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          {/* Centre label */}
          <div className="absolute inset-0 flex items-end justify-center pb-0">
            <span className="font-mono-data text-[10px] text-slate-500 tabular-nums">
              {Math.round(gaugePercent * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
