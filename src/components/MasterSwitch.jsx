import { useRef } from 'react';
import { gsap } from 'gsap';

export default function MasterSwitch({ anyDeviceOn, onMasterOff }) {
  const btnRef = useRef(null);

  const handleEnter = () => gsap.to(btnRef.current, { scale: 1.03, duration: 0.2, ease: 'power2.out' });
  const handleLeave = () => gsap.to(btnRef.current, { scale: 1, duration: 0.2, ease: 'power2.out' });
  const handleClick = () => {
    if (!anyDeviceOn) return;
    gsap.timeline()
      .to(btnRef.current, { scale: 0.95, duration: 0.1 })
      .to(btnRef.current, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    onMasterOff();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        ref={btnRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        disabled={!anyDeviceOn}
        className={`
          w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
          font-semibold text-sm tracking-wide transition-all duration-300 border-none outline-none
          ${anyDeviceOn
            ? 'bg-red-500/15 text-red-200 hover:bg-red-500/25 cursor-pointer'
            : 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
          }
        `}
        style={{ willChange: 'transform' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
        </svg>
        Master Off
      </button>
      <p className="text-slate-700 text-[10px] uppercase tracking-widest font-medium">
        {anyDeviceOn ? 'Powers off all devices' : 'All devices offline'}
      </p>
    </div>
  );
}
