/**
 * VoiceMicButton — Mic button with pulse animation + transcript toast
 */

import { useEffect, useRef, useState } from 'react';
import useVoiceCommand from '../hooks/useVoiceCommand';

export default function VoiceMicButton() {
  const { isListening, startListening, stopListening, supported } = useVoiceCommand();
  const [toast, setToast]           = useState(null); // { text, success }
  const [showToast, setShowToast]   = useState(false);
  const toastTimerRef               = useRef(null);

  const showFeedback = (text, success) => {
    clearTimeout(toastTimerRef.current);
    setToast({ text, success });
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 3500);
  };

  const handleClick = () => {
    if (!supported) {
      showFeedback('Voice commands not supported in this browser', false);
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }

    startListening((command, raw) => {
      if (!window.__smarthomeVoiceHandler) {
        showFeedback(`Heard: "${raw}" — not ready yet`, false);
        return;
      }
      const result = window.__smarthomeVoiceHandler(command);
      if (command.type === 'unknown') {
        showFeedback(`Didn't understand: "${raw}"`, false);
      } else {
        showFeedback(raw, true);
      }
    });
  };

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  return (
    <div className="lg:relative flex items-center fixed bottom-6 right-6 z-50 lg:bottom-auto lg:right-auto lg:z-auto">
      {/* Mic Button */}
      <button
        onClick={handleClick}
        title={supported ? 'Voice Command' : 'Not supported in this browser'}
        className={`
          flex items-center justify-center rounded-full
          border transition-all duration-300
          w-14 h-14 shadow-xl lg:w-9 lg:h-9 lg:shadow-none
          ${isListening
            ? 'bg-indigo-500 border-indigo-400 text-white lg:bg-indigo-500/20 lg:border-indigo-400/60 lg:text-indigo-300'
            : 'bg-[#1e293b] lg:bg-white/[0.04] border-white/[0.15] lg:border-white/[0.08] text-slate-300 lg:text-slate-400 hover:text-white hover:border-white/[0.18] hover:bg-white/[0.08]'
          }
        `}
      >
        {/* Pulse rings when listening */}
        {isListening && (
          <>
            <span className="absolute inset-0 rounded-full border border-indigo-400/40 animate-mic-ring" />
            <span className="absolute inset-0 rounded-full border border-indigo-400/20 animate-mic-ring-delay" />
          </>
        )}

        {/* Mic icon */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-6 h-6 lg:w-4 lg:h-4 relative z-10">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
          />
        </svg>
      </button>

      {/* Listening label */}
      {isListening && (
        <span className="absolute -top-6 lg:-bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-indigo-400 font-semibold tracking-widest whitespace-nowrap animate-pulse">
          LISTENING
        </span>
      )}

      {/* Toast feedback */}
      <div
        className={`
          absolute max-w-[220px] whitespace-nowrap
          glass-panel rounded-xl px-3 py-2.5
          transition-all duration-300 pointer-events-none
          right-0 bottom-20 lg:bottom-auto lg:top-12 lg:right-0
          ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 lg:-translate-y-1'}
        `}
      >
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 text-xs ${toast?.success ? 'text-green-400' : 'text-red-400'}`}>
            {toast?.success ? '✓' : '✗'}
          </span>
          <p className="text-slate-300 text-[11px] leading-snug font-medium">
            {toast?.text}
          </p>
        </div>
      </div>
    </div>
  );
}
