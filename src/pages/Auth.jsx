import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  
  const formRef = useRef(null);

  const handleToggle = () => {
    gsap.fromTo(formRef.current, 
      { opacity: 0, y: 20 }, 
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
    );
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setName('');
    setErrorMsg('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Get database from localStorage
    const usersDB = JSON.parse(localStorage.getItem('smartHomeUsersDB')) || [];

    if (isLogin) {
      // Login flow
      const user = usersDB.find(u => u.email === email && u.password === password);
      if (user) {
        localStorage.setItem('smartHomeUser', JSON.stringify({ name: user.name, email: user.email }));
        navigate('/');
      } else {
        setErrorMsg('Invalid email or password. Please sign up or try again.');
      }
    } else {
      // Signup flow
      const existingUser = usersDB.find(u => u.email === email);
      if (existingUser) {
        setErrorMsg('Email is already registered. Please sign in.');
      } else if (name && email && password) {
        const newUser = { name, email, password };
        usersDB.push(newUser);
        localStorage.setItem('smartHomeUsersDB', JSON.stringify(usersDB));
        localStorage.setItem('smartHomeUser', JSON.stringify({ name, email }));
        navigate('/');
      }
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-[#0f172a]"
    >
      {/* Liquid fluid animated gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 flex items-center justify-center mix-blend-screen">
        <div className="absolute w-[800px] h-[800px] rounded-full opacity-30 animate-float-slow filter blur-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 60%)', top: '-10%', left: '-10%' }} />
        <div className="absolute w-[600px] h-[600px] rounded-full opacity-30 animate-float-fast filter blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.3), transparent 60%)', bottom: '-20%', right: '-10%' }} />
      </div>

      <div 
        ref={formRef}
        className="liquid-glass rounded-[24px] p-8 w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 mx-auto text-purple-400 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
          </svg>
          <h2 className="text-3xl font-bold font-sans text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-white/50 text-sm mt-2 font-medium">
            Smart Home Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm font-semibold mb-2">
              {errorMsg}
            </div>
          )}
          
          {!isLogin && (
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-widest mb-1.5 ml-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="liquid-input w-full rounded-xl px-4 py-3.5 text-white font-sans"
                placeholder="Enter your name"
              />
            </div>
          )}
          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-widest mb-1.5 ml-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="liquid-input w-full rounded-xl px-4 py-3.5 text-white font-sans"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-widest mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="liquid-input w-full rounded-xl px-4 py-3.5 text-white font-sans"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-white/90 hover:bg-white text-slate-900 font-bold py-3.5 mt-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-white/10"
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center mt-6 text-white/50 text-sm">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={handleToggle}
            className="text-purple-400 hover:text-purple-300 font-semibold underline decoration-transparent hover:decoration-purple-300 transition-all cursor-pointer"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
