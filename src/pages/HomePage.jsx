import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import DeviceCard from '../components/DeviceCard';
import MasterSwitch from '../components/MasterSwitch';
import PowerStats from '../components/PowerStats';
import ScenesPanel from '../components/ScenesPanel';
import { controlDevice, getNodeMCUStatus, sendScheduleToFirebase, getFirebaseDeviceStates } from '../services/deviceApi';

const DEFAULT_DEVICES = [
  { id: 'light1', label: 'Light 1' },
  { id: 'light2', label: 'Light 2' },
  { id: 'fan',    label: 'Fan' },
  { id: 'ac',     label: 'AC' },
];

const INITIAL_STATES = DEFAULT_DEVICES.reduce((acc, d) => ({ ...acc, [d.id]: false }), {});

export default function HomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // Check authentication
  useEffect(() => {
    const savedUser = localStorage.getItem('smartHomeUser');
    if (!savedUser) {
      navigate('/login');
    } else {
      setUser(JSON.parse(savedUser));
    }
  }, [navigate]);

  const [deviceStates, setDeviceStates] = useState(INITIAL_STATES);
  const [devices, setDevices] = useState(() => {
    const saved = localStorage.getItem('smartHomeDevices');
    return saved ? JSON.parse(saved) : DEFAULT_DEVICES;
  });

  useEffect(() => {
    localStorage.setItem('smartHomeDevices', JSON.stringify(devices));
  }, [devices]);

  const bgRef = useRef(null);
  const headerRef = useRef(null);
  const gridRef = useRef(null);
  const footerRef = useRef(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newSwitchName, setNewSwitchName] = useState('');
  const [isNodeMCUConnected, setIsNodeMCUConnected] = useState(false);
  
  const lastHeartbeat = useRef(-1);
  const missedBeats = useRef(0);
  const lastManualToggle = useRef(0); // Used to prevent UI flicker when fetching right after a user click

  // Poll NodeMCU physical connection status via Cloud Heartbeat AND sync live states
  useEffect(() => {
    const checkConnection = async () => {
      // 1. Sync Heartbeat
      const currentUptime = await getNodeMCUStatus();
      if (currentUptime !== null && currentUptime !== lastHeartbeat.current) {
        lastHeartbeat.current = currentUptime;
        missedBeats.current = 0;
        setIsNodeMCUConnected(true);
      } else {
        missedBeats.current += 1;
        if (missedBeats.current >= 2) {
          setIsNodeMCUConnected(false); // 9 seconds passed with no update
        }
      }

      // 2. Sync Live States from Firebase
      // Only sync if the user hasn't manually clicked a button in the last 2 seconds
      // to avoid optimistic UI reverting before Firebase saves.
      if (Date.now() - lastManualToggle.current > 2000) {
        const liveStates = await getFirebaseDeviceStates();
        if (liveStates) {
          setDeviceStates(prev => {
            let next = { ...prev };
            let updated = false;
            Object.keys(liveStates).forEach(deviceId => {
              const isOn = liveStates[deviceId].state === "ON";
              if (next[deviceId] !== isOn) {
                next[deviceId] = isOn;
                updated = true;
              }
            });
            return updated ? next : prev;
          });
        }
      }
    };
    
    checkConnection(); 
    const intervalId = setInterval(checkConnection, 4500); // Poll every 4.5s
    return () => clearInterval(intervalId);
  }, []);

  // GSAP: entry animation on mount
  useEffect(() => {
    if (!user) return; // Wait until authenticated
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(headerRef.current,
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: 1 }
    )
    .fromTo(
      gridRef.current?.querySelectorAll('.stagger-item') ?? [],
      { y: 50, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12 },
      '-=0.5'
    )
    .fromTo(footerRef.current,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6 },
      '-=0.3'
    );
  }, [user]);

  // Handler: toggle a single device
  const handleToggle = async (deviceId) => {
    lastManualToggle.current = Date.now(); // Prevent UI flicker
    
    // Optimistic UI update
    setDeviceStates(prev => ({ ...prev, [deviceId]: !prev[deviceId] }));
    const isOn = !deviceStates[deviceId];
    
    // Call the unified dispatcher
    await controlDevice(deviceId, isOn);
  };

  // Handler: rename a device
  const handleRename = (deviceId, newLabel) => {
    setDevices(prev => 
      prev.map(d => d.id === deviceId ? { ...d, label: newLabel } : d)
    );
  };

  // Handler: update device schedule
  const handleScheduleChange = async (deviceId, schedule) => {
    // 1. Update UI locally
    setDevices(prev => 
      prev.map(d => d.id === deviceId ? { ...d, schedule } : d)
    );
    // 2. Push to NodeMCU via Firebase for autonomous 24/7 offline running
    await sendScheduleToFirebase(deviceId, schedule);
  };

  // Handler: remove a device
  const handleRemoveDevice = (deviceId) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    setDeviceStates(prev => {
      const newStates = { ...prev };
      delete newStates[deviceId];
      return newStates;
    });
  };

  // Handler: add a new device with provided name
  const handleAddSubmit = (e) => {
    e?.preventDefault();
    if (newSwitchName.trim() === '') {
      setIsAdding(false);
      return;
    }
    const newId = 'device-' + Date.now();
    const newDevice = { id: newId, label: newSwitchName.trim() };
    setDevices(prev => [...prev, newDevice]);
    setDeviceStates(prev => ({ ...prev, [newId]: false }));
    setNewSwitchName('');
    setIsAdding(false);
  };

  // (Local browser timer loop removed: NodeMCU now handles scheduling autonomously via Firebase)

  // Handler: master switch – turn everything off
  const handleMasterOff = async () => {
    lastManualToggle.current = Date.now();
    const allOff = devices.reduce((acc, d) => ({ ...acc, [d.id]: false }), {});
    setDeviceStates(allOff);
    await Promise.all(devices.map(d => controlDevice(d.id, false)));
  };

  // Handler: master switch – turn everything on
  const handleMasterOn = async () => {
    lastManualToggle.current = Date.now();
    const allOn = devices.reduce((acc, d) => ({ ...acc, [d.id]: true }), {});
    setDeviceStates(allOn);
    await Promise.all(devices.map(d => controlDevice(d.id, true)));
  };

  // Handler: apply a full scene (map of deviceId → boolean)
  const handleApplyScene = async (sceneStates) => {
    lastManualToggle.current = Date.now();
    // Build next state by merging scene states over existing ones
    setDeviceStates(prev => ({ ...prev, ...sceneStates }));
    // Fire all device commands in parallel
    await Promise.all(
      Object.entries(sceneStates).map(([id, on]) => controlDevice(id, on))
    );
  };

  // Register global voice command handler so Navbar's mic can reach us
  useEffect(() => {
    window.__smarthomeVoiceHandler = (command) => {
      if (command.type === 'device') {
        lastManualToggle.current = Date.now();
        setDeviceStates(prev => ({ ...prev, [command.deviceId]: command.state }));
        controlDevice(command.deviceId, command.state);
      } else if (command.type === 'master_off') {
        handleMasterOff();
      } else if (command.type === 'master_on') {
        handleMasterOn();
      } else if (command.type === 'scene') {
        // Dynamically import SCENES to avoid circular deps
        import('../components/ScenesPanel').then(mod => {
          const scene = mod.SCENES.find(s => s.id === command.sceneId);
          if (scene) handleApplyScene(scene.states);
        });
      }
    };
    return () => { delete window.__smarthomeVoiceHandler; };
  }, [devices, deviceStates]);

  const handleLogout = () => {
    localStorage.removeItem('smartHomeUser');
    navigate('/login');
  };

  if (!user) return null; // Or a loading spinner

  const anyDeviceOn = Object.values(deviceStates).some(Boolean);
  const activeCount = Object.values(deviceStates).filter(Boolean).length;

  return (
    <main ref={gridRef} className="px-4 lg:px-6 max-w-6xl mx-auto w-full flex-1 flex flex-col pt-4 pb-8 gap-5">

      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-white/[0.07] rounded-lg px-3 py-1.5">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${anyDeviceOn ? 'bg-green-400' : 'bg-slate-700'}`}
            style={anyDeviceOn ? { boxShadow: '0 0 6px rgba(74,222,128,0.9)' } : {}} />
          <span className="text-slate-500 text-[11px] font-medium tracking-wide">
            {activeCount} {activeCount === 1 ? 'device' : 'devices'} active
          </span>
        </div>
        <div className={`flex items-center gap-2 border border-white/[0.07] rounded-lg px-3 py-1.5 transition-colors duration-300 ${isNodeMCUConnected ? 'bg-transparent' : 'bg-red-500/10'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 transition-colors duration-300 ${isNodeMCUConnected ? 'text-cyan-600' : 'text-red-500'}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d={isNodeMCUConnected 
              ? "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"}
            />
          </svg>
          <span className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${isNodeMCUConnected ? 'text-slate-400' : 'text-red-400'}`}>
            {isNodeMCUConnected ? 'NodeMCU Connected' : 'NodeMCU Offline'}
          </span>
        </div>
      </div>

      {/* Smart Scenes */}
      <ScenesPanel deviceStates={deviceStates} onApplyScene={handleApplyScene} />

      {/* Main two-column layout with Flex order switching */}
      <div className="flex flex-col lg:flex-row gap-5 items-start flex-1">

        {/* ── POWER & MASTER CONTROL (Top on mobile, Right on desktop) ── */}
        <div className="order-1 lg:order-2 flex flex-col gap-4 w-full lg:w-[300px] flex-shrink-0">
          <PowerStats deviceStates={deviceStates} devices={devices} />

          <div ref={footerRef} className="glass-panel rounded-2xl p-5">
            <div className="flex justify-between items-center mb-4">
              <p className="text-slate-600 text-[10px] uppercase tracking-widest font-semibold">Master Control</p>
            </div>
            <MasterSwitch anyDeviceOn={anyDeviceOn} onMasterOff={handleMasterOff} />
          </div>
        </div>

        {/* ── LEFT: 2x2 Devices (Bottom on mobile, Left on desktop) ── */}
        <div className="order-2 lg:order-1 grid grid-cols-2 gap-4 w-full flex-1 h-fit">
          {devices
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
            .map(device => (
            <DeviceCard
              key={device.id}
              id={device.id}
              label={device.label}
              isOn={deviceStates[device.id]}
              schedule={device.schedule}
              onToggle={handleToggle}
              onRename={handleRename}
              onScheduleChange={handleScheduleChange}
              onRemove={handleRemoveDevice}
            />
          ))}

          {/* Add Switch button */}
          {isAdding ? (
            <div
              className="glass-card rounded-2xl p-5 flex flex-col items-center justify-center border border-white/[0.07]"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-slate-400 text-xs uppercase tracking-widest mb-3 font-semibold">Name your switch</p>
              <form onSubmit={handleAddSubmit} className="w-full flex flex-col gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newSwitchName}
                  onChange={e => setNewSwitchName(e.target.value)}
                  placeholder="e.g. Heater, TV…"
                  className="glass-input text-white text-sm rounded-lg px-3 py-2 w-full text-center placeholder:text-slate-700"
                  onKeyDown={e => { if (e.key === 'Escape') { setIsAdding(false); setNewSwitchName(''); } }}
                />
                <div className="flex gap-2 mt-1">
                  <button type="submit" className="flex-1 bg-white/10 hover:bg-white/15 text-white text-xs py-2 rounded-lg font-semibold transition-all">Add</button>
                  <button type="button" onClick={() => { setIsAdding(false); setNewSwitchName(''); }} className="flex-1 border border-white/[0.08] text-slate-500 hover:text-slate-300 text-xs py-2 rounded-lg transition-all">Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div
              onClick={() => setIsAdding(true)}
              className="glass-card rounded-2xl p-5 cursor-pointer select-none flex flex-col items-center justify-center group border border-dashed border-white/[0.07] hover:border-white/15 min-h-[140px] transition-all"
            >
              <div className="w-9 h-9 rounded-full border border-white/[0.08] flex items-center justify-center mb-3 group-hover:border-white/20 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="text-slate-600 text-[10px] uppercase tracking-widest font-semibold group-hover:text-slate-400 transition-colors">Add Switch</span>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

