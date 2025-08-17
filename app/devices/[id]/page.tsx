'use client';
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectWebSocket, disconnectWebSocket } from "@/lib/ws";
import { useDeviceStore } from "@/lib/store";

type Pt = { ts: number; cpu: number };
const W = 600; 
const H = 160; 
const WINDOW_MS = 30_000;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const DeviceDetails = () => {
  const params = useParams<{ id: string }>(); 
  const router = useRouter();
  const id = params?.id as string | undefined;
  const bufferRef = useRef<Pt[]>([]);
  const [points, setPoints] = useState<Pt[]>([]);
  const lastPaintRef = useRef(0);
  const [latest, setLatest] = useState<{ cpu?: number; ram?: number; status?: string; ts?: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deviceExists, setDeviceExists] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');

  const devices = useDeviceStore(state => state.devices);
  console.log("🚀 ~ DeviceDetails ~ devices:", devices)
  const initialDevice = useMemo(() => {
    return devices.find(device => device.id === id);
  }, [devices, id]);

  
  useEffect(() => {
    // console.log("🚀 ~ DeviceDetails ~ initialDevice:", initialDevice)
    if (initialDevice) {
      setLatest({
        cpu: initialDevice.cpu,
        ram: initialDevice.ram,
        status: initialDevice.status,
        ts: initialDevice.ts
      });
      setIsLoading(false);
      setDeviceExists(true);
      
      if (initialDevice.cpu !== undefined) {
        const now = Date.now();
        bufferRef.current.push({ ts: initialDevice.ts || now, cpu: initialDevice.cpu });
        setPoints([...bufferRef.current]);
      }
    } else if (devices.length > 0) {
      // If we have devices loaded but this ID doesn't exist
      setDeviceExists(false);
      setIsLoading(false);
    }
  }, [initialDevice, devices.length]);
  
  useEffect(() => {
    if (!id) return;
    
    setConnectionStatus('connecting');
    
    const Socket = connectWebSocket({
      onSeed(devs) {
        setConnectionStatus('connected');
        // console.log("🚀 ~ onSeed ~ devs:", devs)
        // Check if device exists in seed data
        const seedDevice = devs.find(d => d.id === id);
        if (seedDevice) {
          setLatest({
            cpu: seedDevice.cpu,
            ram: seedDevice.ram,
            status: seedDevice.status,
            ts: seedDevice.ts
          });
          setDeviceExists(true);
          
          // Add to chart if we have CPU data
          if (seedDevice.cpu !== undefined) {
            const now = Date.now();
            bufferRef.current.push({ ts: seedDevice.ts || now, cpu: seedDevice.cpu });
            setPoints([...bufferRef.current]);
          }
        } else {
          setDeviceExists(false);
        }
        setIsLoading(false);
      },
      onTelemetry(ev) { 
        if (ev.deviceId !== id) return;
        
        setConnectionStatus('connected');
        const now = Date.now();
        
        const cpu = ev.metrics?.cpu !== undefined ? 
          Math.max(0, Math.min(100, Math.round(ev.metrics.cpu))) : 
          latest.cpu;
        
        if (cpu !== undefined) {
          bufferRef.current.push({ ts: ev.ts ?? now, cpu });
          
          const cutoff = now - WINDOW_MS;
          while (bufferRef.current.length && bufferRef.current[0].ts < cutoff) { 
            bufferRef.current.shift(); 
          }
        }
        
        setLatest({ 
          cpu: ev.metrics?.cpu, 
          ram: ev.metrics?.ram, 
          status: ev.status, 
          ts: ev.ts ?? now 
        });
        
        if (now - lastPaintRef.current > 180) { 
          lastPaintRef.current = now; 
          setPoints([...bufferRef.current]); 
        }
        
        setIsLoading(false);
        setDeviceExists(true);
      }
    });
    

    return () => { 
      disconnectWebSocket(); 
      Socket?.(); 
    };
  }, [id, latest.cpu]);

  const pathD = useMemo(() => {
    const now = Date.now(); 
    const minX = now - WINDOW_MS; 
    const maxX = now; 
    const rangeX = maxX - minX;
    if (points.length === 0) return "";
    
    const toXY = (p: Pt) => { 
      const x = ((p.ts - minX) / rangeX) * W; 
      const y = H - (p.cpu / 100) * H; 
      return [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))] as const; 
    };
    
    const [x0, y0] = toXY(points[0]); 
    let d = `M ${x0} ${y0}`;
    for (let i = 1; i < points.length; i++) { 
      const [x, y] = toXY(points[i]); 
      d += ` L ${x} ${y}`; 
    }
    return d;
  }, [points]);

  // Error cases
  if (!id) return (
    <div role="alert" aria-live="assertive" className="p-8 text-center">
      <h1 className="text-lg font-semibold text-red-600">Invalid Device ID - {id}</h1>
      <p className="text-gray-600 mt-2">The device ID is missing or invalid.</p>
      <button 
        onClick={() => router.push('/devices')}
        className="btn border-gray-300 focus-ring mt-4"
      >
        ← Back to Devices
      </button>
    </div>
  );

  if (!deviceExists && !isLoading) {
    return (
      <div role="alert" aria-live="assertive" className="p-8 text-center">
        <h1 className="text-lg font-semibold text-red-600">Device Not Found</h1>
        <p className="text-gray-600 mt-2">Device <span className="font-mono">{id}</span> does not exist.</p>
        <button 
          onClick={() => router.push('/devices')}
          className="btn border-gray-300 focus-ring mt-4"
        >
          ← Back to Devices
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <a href="#device-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50">
        Skip to device content
      </a>
      
      <div className="flex md:flex-row justify-between md:justify-start md:items-center gap-4">
        <button 
          className="btn border-gray-300 focus-ring" 
          onClick={() => router.push('/devices')}
          aria-label="Go back to devices list"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold">
          Device <span className="font-mono">{id}</span>
        </h1>
        
        <div className="md:flex hidden items-center gap-1 text-xs">
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          <span className="text-gray-500 capitalize">{connectionStatus}</span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading device data...</p>
          </div>
        </div>
      ) : (
        <div id="device-content" className="flex flex-col md:grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h2 className="text-sm text-gray-500">CPU (last 30s)</h2>
            <div className="border rounded-md p-2">
              <svg 
                width="100%" 
                height={H} 
                viewBox={`0 0 ${W} ${H}`} 
                preserveAspectRatio="none" 
                role="img" 
                aria-label={`CPU usage chart for device ${id} over the last 30 seconds`}
                aria-describedby="chart-description"
              >
                {/* added grid lines */}
                <g opacity="0.2" aria-hidden="true">
                  <line x1="0" y1="0" x2={W} y2="0" stroke="currentColor" />
                  <line x1="0" y1={H/2} x2={W} y2={H/2} stroke="currentColor" />
                  <line x1="0" y1={H} x2={W} y2={H} stroke="currentColor" />
                </g>
                
                {/* added y-axis labels */}
                <g className="text-xs fill-current opacity-50" aria-hidden="true">
                  <text x="5" y="12">100%</text>
                  <text x="5" y={H/2 + 4}>50%</text>
                  <text x="5" y={H - 5}>0%</text>
                </g>
                
                {/* added chart area path */}
                <path 
                  d={pathD ? pathD + ` L ${W} ${H} L 0 ${H} Z` : ""} 
                  fill="currentColor" 
                  opacity="0.08" 
                  aria-hidden="true"
                />
                
                {/* added chart line path */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  aria-hidden="true"
                />
                
                {/* added empty state incase no data is available */}
                {points.length === 0 && (
                  <text 
                    x={W/2} 
                    y={H/2} 
                    textAnchor="middle" 
                    className="text-sm fill-current opacity-50"
                    aria-hidden="true"
                  >
                    Waiting for data...
                  </text>
                )}
              </svg>
              <div id="chart-description" className="sr-only">
                CPU usage chart showing {points.length} data points over the last 30 seconds. 
                Current CPU usage is {latest.cpu ?? 'unknown'}%.
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-sm text-gray-500">Latest Metrics</h2>
            <div className="border rounded-md p-3 text-sm" role="region" aria-label="Latest device metrics">
              <dl className="space-y-1">
                <div>
                  <dt className="text-gray-500 inline">CPU:</dt>
                  <dd className="inline ml-1">
                    {latest.cpu !== undefined ? `${latest.cpu}%` : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 inline">RAM:</dt>
                  <dd className="inline ml-1">
                    {latest.ram !== undefined ? `${latest.ram}%` : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 inline">Status:</dt>
                  <dd className="inline ml-1">
                    <span className={
                      latest.status === "online" ? "text-green-600" :
                      latest.status === "rebooting" ? "text-amber-600" :
                      latest.status === "offline" ? "text-gray-500" :
                      "text-red-600"
                    }>
                      {latest.status ?? "-"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 inline">Last Update:</dt>
                  <dd className="inline ml-1">
                    {latest.ts ? new Date(latest.ts).toLocaleTimeString() : "-"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
      
      <div className="py-4 flex justify-center items-center mt-2 w-full   p-2">
        <p className="text-sm text-gray-500" aria-live="polite">
          Chart updates are throttled to ~5 fps. Window: 30 seconds. 
          {points.length > 0 && ` Currently showing ${points.length} data points.`}
        </p>
      </div>
      
      {/* Live region for real-time updates */}
      <div aria-live="polite" aria-atomic="false" className="sr-only">
        {latest.cpu !== undefined && `CPU updated to ${latest.cpu}%`}
      </div>
    </div>
  );
}

export default DeviceDetails;