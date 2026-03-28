import { useState, useEffect } from 'react';

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

export default function LiveClock({ name = 'Om' }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = String(hours % 12 || 12);

  const greeting = getGreeting(hours);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayStr = `${dayNames[time.getDay()]}, ${monthNames[time.getMonth()]} ${time.getDate()}, ${time.getFullYear()}`;

  return (
    <div>
      {/* Greeting — premium serif */}
      <p className="text-slate-400 text-xs font-medium uppercase tracking-[0.3em] mb-0.5">
        {greeting},
      </p>
      <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-white leading-tight mb-3">
        Welcome Home, <span className="italic text-slate-300">{name}</span>
      </h1>

      {/* Time — crisp Inter */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-4xl sm:text-5xl font-bold text-white tracking-tight tabular-nums" style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>
          {displayHour}:{minutes}
        </span>
        <div className="flex flex-col items-start gap-0.5 pb-1">
          <span className="text-white/60 text-sm font-semibold">{ampm}</span>
          <span className="text-white/30 font-mono-data text-xs tabular-nums">{seconds}s</span>
        </div>
      </div>

      {/* Date */}
      <p className="text-slate-500 text-xs tracking-wide">{dayStr}</p>
    </div>
  );
}
