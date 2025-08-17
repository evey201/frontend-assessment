type SeedEvent = { 
  type: "seed"; 
  devices: Array<{ id: string; status: string; cpu?: number; ram?: number; ts?: number }> 
};

type TelemetryEvent = { 
  type: "telemetry"; 
  seq?: number; 
  deviceId: string; 
  status?: string; 
  metrics?: { cpu?: number; ram?: number }; 
  ts?: number; 
};

type Message = SeedEvent | TelemetryEvent;

let socket: WebSocket | null = null; 
let reconnectTimer: any = null; 
let shouldReconnect = true;

type Handlers = { 
  onSeed: (devices: any[]) => void; 
  onTelemetry: (t: { deviceId: string; status?: string; metrics?: { cpu?: number; ram?: number }; ts?: number; seq?: number }) => void; 
};

export function connectWebSocket(handlers: Handlers) {
  shouldReconnect = true; 
  const url = `ws://localhost:4001`;
  
  function open() {
    if (!shouldReconnect) return; 
    socket = new WebSocket(url);
    
    socket.onmessage = (ev) => { 
      try { 
        const msg: Message = JSON.parse(ev.data);
        if (msg.type === "seed") {
          // Clean and validate seed data
          const cleanDevices = msg.devices
            .filter(d => d && d.id && typeof d.id === 'string' && d.id.trim() !== '')
            .map(d => ({ 
              id: d.id, 
              status: (d.status as any) ?? "online", 
              cpu: typeof d.cpu === 'number' ? d.cpu : undefined, 
              ram: typeof d.ram === 'number' ? d.ram : undefined, 
              ts: d.ts ?? Date.now() 
            }));
          
          console.log('WebSocket: Seed data cleaned, original:', msg.devices.length, 'clean:', cleanDevices.length);
          handlers.onSeed(cleanDevices);
        }
        else if (msg.type === "telemetry") {
          // Validate telemetry data
          if (msg.deviceId && typeof msg.deviceId === 'string' && msg.deviceId.trim() !== '') {
            handlers.onTelemetry({ 
              deviceId: msg.deviceId, 
              status: msg.status as any, 
              metrics: msg.metrics, 
              ts: msg.ts, 
              seq: msg.seq 
            });
          } else {
            console.warn('WebSocket: Invalid telemetry deviceId:', msg);
          }
        }
      } catch (e) {
        console.error('WebSocket: Error parsing message:', e);
      } 
    };
    
    socket.onclose = () => { 
      if (!shouldReconnect) return; 
      const delay = Math.min(10000, 1000 + Math.random() * 2000); 
      reconnectTimer = setTimeout(open, delay); 
    };
    
    socket.onerror = () => { 
      try { socket?.close(); } catch {} 
    };
  }
  
  open(); 
  return () => { disconnectWebSocket(); };
}

export function disconnectWebSocket(){
  shouldReconnect = false; 
  if (reconnectTimer) clearTimeout(reconnectTimer); 
  if (socket && socket.readyState === WebSocket.OPEN) try{ socket.close(); } catch {} 
  socket = null; 
}

export function makeBatcher<T>(flush: (items: T[]) => void, windowMs = 50){
  let buf: T[] = []; 
  let timer: any = null; 
  return (item: T) => { 
    buf.push(item); 
    if (!timer) { 
      timer = setTimeout(() => { 
        const copy = buf; 
        buf = []; 
        timer = null; 
        flush(copy); 
      }, windowMs); 
    } 
  }; 
}