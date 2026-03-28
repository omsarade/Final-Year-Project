import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

export default function MainLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Cross-route authentication check
  useEffect(() => {
    const savedUser = localStorage.getItem('smartHomeUser');
    if (!savedUser) {
      navigate('/login');
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  // Prevent flash of protected content
  if (!user) return null;

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-[#0f172a] relative font-sans">
      {/* Liquid fluid animated gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 flex items-center justify-center mix-blend-screen">
        <div className="absolute w-[800px] h-[800px] rounded-full opacity-30 animate-float-slow filter blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 60%)', top: '-10%', left: '-10%' }} />
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-30 animate-float-fast filter blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.3), transparent 60%)', bottom: '-20%', right: '-10%' }} />
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-20 animate-float-slow filter blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.3), transparent 60%)', top: '40%', left: '50%' }} />
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto no-scrollbar relative z-10 transition-all pb-8">
        {/* Global Floating Navbar */}
        <Navbar user={user} />
        
        {/* Dynamic Nested Route Rendering */}
        <div className="flex-1 flex flex-col">
          <Outlet context={{ user }} />
        </div>
      </div>
    </div>
  );
}
