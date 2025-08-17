'use client';
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { connectWebSocket, disconnectWebSocket } from "@/lib/ws";
type Pt = { ts: number; cpu: number };
const W = 600; const H = 160; const WINDOW_MS = 30_000;
export default function DeviceDetails() {
  const params = useParams<{ id: string }>(); const router = useRouter();
  const id = params?.id as string | undefined;
  const bufRef = useRef<Pt[]>([]);
  const [points, setPoints] = useState<Pt[]>([]);
  const lastPaintRef = useRef(0);
  const [latest, setLatest] = useState<{ cpu?: number; ram?: number; status?: string; ts?: number }>({});
  useEffect(() => {
    if (!id) return;
    const close = connectWebSocket({
      onSeed(_) {},
      onTelemetry(ev) {
        if (ev.deviceId !== id) return;
        const now = Date.now();
        const cpu = Math.max(0, Math.min(100, Math.round(ev.metrics?.cpu ?? (latest.cpu ?? 0))));
        bufRef.current.push({ ts: ev.ts ?? now, cpu });
        const cutoff = now - WINDOW_MS;
        while (bufRef.current.length && bufRef.current[0].ts < cutoff) { bufRef.current.shift(); }
        setLatest({ cpu, ram: ev.metrics?.ram, status: ev.status, ts: ev.ts ?? now });
        if (now - lastPaintRef.current > 180) { lastPaintRef.current = now; setPoints([...bufRef.current]); }
      }
    });
    return () => { disconnectWebSocket(); close?.(); };
  }, [id]);
  const pathD = useMemo(() => {
    const now = Date.now(); const minX = now - WINDOW_MS; const maxX = now; const rangeX = maxX - minX;
    if (points.length === 0) return "";
    const toXY = (p: Pt) => { const x = ((p.ts - minX) / rangeX) * W; const y = H - (p.cpu / 100) * H; return [Math.max(0, Math.min(W, x)), Math.max(0, Math.min(H, y))] as const; };
    const [x0, y0] = toXY(points[0]); let d = `M ${x0} ${y0}`;
    for (let i = 1; i < points.length; i++) { const [x, y] = toXY(points[i]); d += ` L ${x} ${y}`; }
    return d;
  }, [points]);
  if (!id) return <div>Invalid device id</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><button className="btn border-gray-300 focus-ring" onClick={() => router.push('/devices')}>← Back</button><h2 className="text-lg font-semibold">Device <span className="font-mono">{id}</span></h2></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-500">CPU (last 30s)</div>
          <div className="border rounded-md p-2">
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="CPU line chart">
              <g opacity="0.2"><line x1="0" y1="0" x2={W} y2="0" stroke="currentColor" /><line x1="0" y1={H/2} x2={W} y2={H/2} stroke="currentColor" /><line x1="0" y1={H} x2={W} y2={H} stroke="currentColor" /></g>
              <path d={pathD ? pathD + ` L ${W} ${H} L 0 ${H} Z` : ""} fill="currentColor" opacity="0.08" />
              <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Latest</div>
          <div className="border rounded-md p-3 text-sm">
            <div><span className="text-gray-500">CPU:</span> {latest.cpu ?? "-"}%</div>
            <div><span className="text-gray-500">RAM:</span> {latest.ram ?? "-"}%</div>
            <div><span className="text-gray-500">Status:</span> {latest.status ?? "-"}</div>
            <div><span className="text-gray-500">Last:</span> {latest.ts ? new Date(latest.ts).toLocaleTimeString() : "-"}</div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">Chart updates are throttled to ~5 fps. Window: 30 seconds.</p>
    </div>
  );
}
