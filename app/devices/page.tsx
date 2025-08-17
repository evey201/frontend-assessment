'use client';
import Link from "next/link";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";
import { useEffect, useMemo, useState, useTransition, useRef, useCallback } from "react";
import { useDeviceStore } from "@/lib/store";
import { connectWebSocket, disconnectWebSocket, makeBatcher } from "@/lib/ws";
import { rebootDevice } from "@/app/actions";

const DevicesPage = () => {
  const devices = useDeviceStore(s => s.devices);
  // console.log("🚀 ~ DevicesPage ~ devices:", devices)
  const filter = useDeviceStore(s => s.filter);
  const setFilter = useDeviceStore(s => s.setFilter);
  const upsertDevice = useDeviceStore(s => s.upsertDevice);
  const setInFlight = useDeviceStore(s => s.setInFlight);
  const inFlight = useDeviceStore(s => s.inFlight);

  const [isPending, startTransition] = useTransition();
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [debugInfo, setDebugInfo] = useState<string>('');
  const batcher = useMemo(() => makeBatcher(upsertDevice, 50), [upsertDevice]);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('DevicesPage: Setting up WebSocket connection...');
    setWsStatus('connecting');

    const close = connectWebSocket({
      onSeed(devs) {
        setDebugInfo(`Seed received: ${devs?.length} devices`);
        useDeviceStore.getState().setDevices(devs);
        setWsStatus('connected');
      },
      onTelemetry(ev) {
        batcher(ev);
      }
    });

    return () => {
      disconnectWebSocket();
      close?.();
    };
  }, [batcher]);


  const [localFilter, setLocalFilter] = useState(filter);
  useEffect(() => setLocalFilter(filter), [filter]);
  useEffect(() => { const t = setTimeout(() => setFilter(localFilter), 150); return () => clearTimeout(t); }, [localFilter, setFilter]);

  const list = useMemo(() => {
    // First, ensure we have valid devices
    const validDevices = (devices ?? []).filter(d =>
      d && d.id && typeof d.id === 'string' && d.id.trim() !== ''
    );

    const cleanedFilter = (filter ?? '').toString().trim().toLowerCase();
    if (!cleanedFilter) return validDevices;

    const filteredDevices = validDevices.filter(d => {
      const id = (d?.id ?? '').toString().toLowerCase();
      const status = (d?.status ?? '').toString().toLowerCase();
      return id.includes(cleanedFilter) || status.includes(cleanedFilter);
    });


    return filteredDevices;
  }, [devices, filter]);

  const handleReboot = useCallback(async (id: string, prevStatus: string) => {
    if (inFlight[id]) return;
    setInFlight(id, true);
    upsertDevice({ deviceId: id, status: "rebooting", ts: Date.now() });
    startTransition(async () => {
      const res = await rebootDevice(id);
      if (!res.ok) { upsertDevice({ deviceId: id, status: prevStatus, ts: Date.now() }); }
      setInFlight(id, false);
    });
  }, [inFlight, upsertDevice, setInFlight, startTransition]);


  return (
    <div className="space-y-3">

      <a href="#devices-table" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50">
        Skip to devices table
      </a>

      <div className="flex items-center gap-2">
        <label htmlFor="device-filter" className="sr-only">Filter devices</label>
        <input
          id="device-filter"
          aria-label="Filter by ID or status"
          className="input focus-ring max-w-sm"
          placeholder="Filter by ID or status..."
          value={localFilter}
          onChange={e => setLocalFilter(e.target.value)}
        />
        <div className="text-xs text-gray-500" aria-live="polite">
          {list.length} device{list.length !== 1 ? 's' : ''} found
        </div>
      </div>
      <div
        id="devices-table"
        role="region"
        aria-label="Devices table"
        className="border rounded-md"
        ref={tableRef}
      >
        {list.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No devices to display</p>
            <p className="text-sm mt-2">
              {list.length === 0 ? 'No devices loaded from WebSocket' : 'Filter returned no results'}
            </p>
          </div>
        ) : (
          <TableVirtuoso
            data={list}
            totalCount={list.length}
            className="!h-[100vh]"
            components={{
              Table: (props) => <table {...props} className="min-w-full divide-y divide-gray-200" />,
              TableHead: (props) => <thead {...props} className="bg-gray-50" />,
              TableRow: (props) => <tr {...props} />,
              TableBody: (props) => <tbody {...props} className="divide-y divide-gray-200" />,
            }}
            fixedHeaderContent={() => (
              <tr>
                <th scope="col" className="th">ID</th>
                <th scope="col" className="th">Status</th>
                <th scope="col" className="th">CPU%</th>
                <th scope="col" className="th">RAM%</th>
                <th scope="col" className="th">Last seen</th>
                <th scope="col" className="th">Action</th>
              </tr>
            )}
            itemContent={(_, device) => (
              <>
                <td className="px-4 py-2 font-mono">
                  <Link href={`/devices/${device.id}`} className="underline focus-ring">
                    {device.id}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      device.status === "online"
                        ? "text-green-600"
                        : device.status === "rebooting"
                          ? "text-amber-600"
                          : device.status === "offline"
                            ? "text-gray-500"
                            : "text-red-600"
                    }
                  >
                    {device.status}
                  </span>
                </td>
                <td className="px-4 py-2">{device.cpu ?? "-"}</td>
                <td className="px-4 py-2">{device.ram ?? "-"}</td>
                <td className="px-4 py-2">
                  {device.ts ? new Date(device.ts).toLocaleTimeString() : "-"}
                </td>
                <td className="px-4 py-2">
                  <button
                    className="btn border-gray-300 focus-ring"
                    disabled={!!inFlight[device.id] || device.status === "rebooting"}
                    onClick={() => handleReboot(device.id, device.status)}
                  >
                    {inFlight[device.id] ? "Rebooting..." : "Reboot"}
                  </button>
                </td>
              </>
            )}
          />
        )}
      </div>

      {/* Live region for status changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {list.length} devices loaded
      </div>
    </div>
  );
}

export default DevicesPage;