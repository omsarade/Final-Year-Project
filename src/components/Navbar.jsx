import LiveClock from './LiveClock';
import VoiceMicButton from './VoiceMicButton';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ user }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('smartHomeUser');
    navigate('/login');
  };

  return (
    <div className="glass-panel rounded-2xl mx-4 mt-4 lg:mx-6 lg:mt-5 px-6 py-4 flex items-center justify-between z-40 lg:sticky lg:top-4">
      {/* Left: Clock + Greeting */}
      <div className="flex-1">
        <LiveClock name={user.name} />
      </div>

      {/* Centre: Voice Mic Button */}
      <div className="flex items-center justify-center px-4">
        <VoiceMicButton />
      </div>

      {/* Right: Sign Out */}
      <div className="flex-shrink-0">
        <button
          onClick={handleLogout}
          className="
            group flex items-center gap-2.5 px-5 py-2.5 rounded-xl
            bg-white/[0.04] hover:bg-white/[0.08]
            border border-white/[0.08] hover:border-white/[0.16]
            text-slate-400 hover:text-white
            text-xs font-semibold tracking-[0.08em] uppercase
            transition-all duration-200
          "
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
