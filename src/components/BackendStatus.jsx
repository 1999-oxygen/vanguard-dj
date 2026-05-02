import React, { useState, useEffect } from 'react';
import { Server, Wifi, WifiOff } from 'lucide-react';
import { isBackendOnline } from '../services/vanguardApi.js';

/**
 * BackendStatus Component
 * Shows a small indicator in the header showing whether the
 * Vanguard Neural Core backend is reachable.
 */
const BackendStatus = () => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const check = async () => {
      const start = Date.now();
      const online = await isBackendOnline();
      const ms = Date.now() - start;
      setStatus(online ? 'online' : 'offline');
      setLatency(online ? ms : null);
    };

    check();
    const interval = setInterval(check, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
        <Server size={10} className="animate-pulse" />
        ...
      </span>
    );
  }

  if (status === 'online') {
    return (
      <span className="flex items-center gap-1 text-[10px] font-mono text-neon/green-400" title={`Backend latency: ${latency}ms`}>
        <Wifi size={10} />
        CORE
        {latency !== null && <span className="text-slate-500">{latency}ms</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500" title="Backend unreachable — using client-side analysis">
      <WifiOff size={10} />
      LOCAL
    </span>
  );
};

export default BackendStatus;

