'use client';
import Link from "next/link";
import { TableVirtuoso } from "react-virtuoso";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useDeviceStore } from "@/lib/store";
import { connectWebSocket, disconnectWebSocket, makeBatcher } from "@/lib/ws";
import { rebootDevice } from "@/app/actions";

export default function DevicesPage() {
  const devices = useDeviceStore(s => s.devices);
  const filter = useDeviceStore(s => s.filter);
  const setFilter = useDeviceStore(s => s.setFilter);
  const upsertDevice = useDeviceStore(s => s.upsertDevice);
  const setInFlight = useDeviceStore(s => s.setInFlight);
  const inFlight = useDeviceStore(s => s.inFlight);

  const [isPending, startTransition] = useTransition();
  const batcher = useMemo(() => makeBatcher(upsertDevice, 50), [upsertDevice]);

  useEffect(() => {
    const close = connectWebSocket({ onSeed(devs){ useDeviceStore.getState().setDevices(devs); }, onTelemetry(ev){ batcher(ev); } });
    return () => { disconnectWebSocket(); close?.(); };
  }, [batcher]);

  const [localFilter, setLocalFilter] = useState(filter);
  useEffect(() => setLocalFilter(filter), [filter]);
  useEffect(() => { const t = setTimeout(() => setFilter(localFilter), 150); return () => clearTimeout(t); }, [localFilter, setFilter]);

  const list = useMemo(() => {
    const f = (filter ?? '').toString().trim().toLowerCase();
    if (!f) return devices;
    return (devices ?? []).filter(Boolean).filter(d => {
      const id = (d?.id ?? '').toString().toLowerCase();
      const status = (d?.status ?? '').toString().toLowerCase();
      return id.includes(f) || status.includes(f);
    });
  }, [devices, filter]);

  async function handleReboot(id: string, prevStatus: string) {
    if (inFlight[id]) return;
    setInFlight(id, true);
    upsertDevice({ deviceId: id, status: "rebooting", ts: Date.now() });
    startTransition(async () => {
      const res = await rebootDevice(id);
      if (!res.ok) { upsertDevice({ deviceId: id, status: prevStatus, ts: Date.now() }); }
      setInFlight(id, false);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input aria-label="Filter by ID or status" className="input focus-ring max-w-sm" placeholder="Filter by ID or status..." value={localFilter} onChange={e => setLocalFilter(e.target.value)} />
        <div className="text-xs text-gray-500">{list.length} rows</div>
      </div>
      <div role="region" aria-label="Devices table" className="border rounded-md">
        <TableVirtuoso
          data={list}
          className="max-h-[70vh]"
          fixedHeaderContent={() => (<tr className="bg-gray-50"><th className="th">ID</th><th className="th">Status</th><th className="th">CPU%</th><th className="th">RAM%</th><th className="th">Last seen</th><th className="th">Action</th></tr>)}
          itemContent={(_, d) => (
            <tr tabIndex={0} className="focus-ring">
              <td className="td font-mono"><Link className="underline focus-ring" href={`/devices/${d.id}`}>{d.id}</Link></td>
              <td className="td"><span className={ d.status === "online" ? "text-green-600" : d.status === "rebooting" ? "text-amber-600" : d.status === "offline" ? "text-gray-500" : "text-red-600" }>{d.status}</span></td>
              <td className="td">{d.cpu ?? "-"}</td><td className="td">{d.ram ?? "-"}</td>
              <td className="td">{d.ts ? new Date(d.ts).toLocaleTimeString() : "-"}</td>
              <td className="td"><button className="btn border-gray-300 focus-ring" disabled={!!inFlight[d.id] || d.status === "rebooting"} onClick={() => handleReboot(d.id, d.status)}>{inFlight[d.id] ? "Rebooting..." : "Reboot"}</button></td>
            </tr>
          )}
          components={{ Table: (p) => <table {...p} className="table" />, TableRow: (p) => <tr {...p} />, TableBody: (p) => <tbody {...p} />, TableHead: (p) => <thead {...p} /> }}
        />
      </div>
    </div>
  );
}
