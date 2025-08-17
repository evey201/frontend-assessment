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
  const tableRef = useRef<HTMLDivElement>(null);
  const activeIdempotencyKeys = useRef<Record<string, string>>({});
  const rebootTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  const batcher = useMemo(() => makeBatcher((items: any[]) => {
    items.forEach(item => upsertDevice(item));
  }, 500), [upsertDevice]);

  const getOrCreateIdempotencyKey = useCallback((deviceId: string): string => {
    if (!activeIdempotencyKeys.current[deviceId]) {
      activeIdempotencyKeys.current[deviceId] = 
        globalThis.crypto?.randomUUID?.() || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return activeIdempotencyKeys.current[deviceId];
  }, []);

  const clearDeviceRebootState = useCallback((deviceId: string) => {
    delete activeIdempotencyKeys.current[deviceId];
    if (rebootTimeouts.current[deviceId]) {
      clearTimeout(rebootTimeouts.current[deviceId]);
      delete rebootTimeouts.current[deviceId];
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(rebootTimeouts.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);


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
  useEffect(() => {
    const timeOut = setTimeout(() => {
      setFilter(localFilter);
    }, 150);
    return () => clearTimeout(timeOut);
  }, [localFilter, setFilter]);

  const list = useMemo(() => {
    // First, ensure we have valid devices
    const validDevices = (devices ?? []).filter(device =>
      device && device.id && typeof device.id === 'string' && device.id.trim() !== ''
    );

    const cleanedFilter = (filter ?? '').toString().trim().toLowerCase();
    if (!cleanedFilter) return validDevices;

    const filteredDevices = validDevices.filter(device => {
      const id = (device?.id ?? '').toString().toLowerCase();
      const status = (device?.status ?? '').toString().toLowerCase();
      return id.includes(cleanedFilter) || status.includes(cleanedFilter);
    });


    return filteredDevices;
  }, [devices, filter]);

  const handleReboot = useCallback(async (id: string, prevStatus: string) => {
    // console.log("🚀 ~ handleReboot ~ id:", id, prevStatus)
    if (inFlight[id]) return;

    // console.log(`Starting reboot for device ${id}`);

    // guarding against duplicate requests
    const idempotencyKey = getOrCreateIdempotencyKey(id);
    console.log(`Using idempotency key: ${idempotencyKey.substring(0, 8)}...`);

    // Setting the in-flight state and optimistic update
    setInFlight(id, true);
    upsertDevice({ deviceId: id, status: "rebooting", ts: Date.now() });

    const timeoutDuration = 30000;
    rebootTimeouts.current[id] = setTimeout(() => {
      console.log(`Reboot timeout for device ${id}`);
      setInFlight(id, false);
      upsertDevice({ deviceId: id, status: prevStatus === "rebooting" ? "rebooting" : prevStatus === "online" ? "online" : "offline", ts: Date.now() });
    }, timeoutDuration);

    startTransition(async () => {
      try {
        console.log(`Calling rebootDevice for ${id} with key ${idempotencyKey.substring(0, 8)}...`);
        const res = await rebootDevice(id, idempotencyKey);
        
        if (rebootTimeouts.current[id]) {
          clearTimeout(rebootTimeouts.current[id]);
          delete rebootTimeouts.current[id];
        }

        if (res.ok) {
          console.log(`Reboot successful for device ${id}`, res ? '(deduplicated)' : '');
          clearDeviceRebootState(id);
        } else {
          console.log(`Reboot failed for device ${id}:`, res.reason);
          // rollback if there is a failure
          upsertDevice({ deviceId: id, status: prevStatus === "rebooting" ? "rebooting" : prevStatus === "online" ? "online" : "offline", ts: Date.now() });
          
          if (res.reason === 'not_found' || res.reason === 'invalid_id') {
            clearDeviceRebootState(id);
          }
        }
      } catch (error) {
        console.error(`Reboot error for device ${id}:`, error);
        upsertDevice({ deviceId: id, status: prevStatus === "rebooting" ? "rebooting" : prevStatus === "online" ? "online" : "offline", ts: Date.now() });
        
        if (rebootTimeouts.current[id]) {
          clearTimeout(rebootTimeouts.current[id]);
          delete rebootTimeouts.current[id];
        }
      }
      setInFlight(id, false);
    });
  }, [inFlight, upsertDevice, setInFlight, startTransition, getOrCreateIdempotencyKey, clearDeviceRebootState]);


  return (
    <div className="space-y-3">

      <a href="#devices-table" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50" aria-label="Skip to devices table">
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
        <div id="filer-help" className="text-xs text-gray-500" aria-live="polite">
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
            className="!h-[80vh]"
            components={{
              Table: (props) => <table {...props} 
              className="min-w-full divide-y divide-gray-200" 
              role="table" 
              aria-label="Devices table"
              />,
              TableHead: (props) => <thead {...props} className="bg-gray-50" role="rowgroup" />,
              TableRow: (props) => 
              <tr 
                {...props} 
                role="row"
                className="focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('keydown', e.key);
                    const firstButton = e.currentTarget.querySelector('button, a');
                    if (firstButton) {
                      (firstButton as HTMLElement).focus();
                    }
                  }
                }}
              />,
              TableBody: (props) => <tbody {...props} className="divide-y divide-gray-200" role="rowgroup" />,
            }}
            fixedHeaderContent={() => (
              <tr>
                <th scope="col" className="th" role="columnheader">ID</th>
                <th scope="col" className="th" role="columnheader">Status</th>
                <th scope="col" className="th" role="columnheader">CPU%</th>
                <th scope="col" className="th" role="columnheader">RAM%</th>
                <th scope="col" className="th" role="columnheader">Last seen</th>
                <th scope="col" className="th" role="columnheader">Action</th>
              </tr>
            )}
            itemContent={(_, device) => (
              <>
                <td className="px-4 py-2 font-mono" role="cell">
                  <Link href={`/devices/${device.id}`} className="underline focus-ring hover:text-blue-600">
                    {device.id}
                  </Link>
                </td>
                <td className="px-4 py-2" role="cell">
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
                    aria-label={`Device status: ${device.id}`}
                  >
                    {device.status}
                  </span>
                </td>
                <td className="px-4 py-2" role="cell">
                  <span aria-label={`CPU usage: ${device.cpu ?? "-"}`}>
                    {device.cpu ?? "-"}
                  </span>
                  </td>
                <td className="px-4 py-2" role="cell">
                  <span aria-label={`RAM usage: ${device.ram ?? "-"}`}>
                    {device.ram ?? "-"}
                  </span>
                </td>
                <td className="px-4 py-2" role="cell">
                  <span aria-label={`Last seen: ${device.ts ? new Date(device.ts).toLocaleTimeString() : "-"}`}>
                    {device.ts ? new Date(device.ts).toLocaleTimeString() : "-"}
                  </span>
                </td>
                <td className="px-4 py-2" role="cell">
                <button
                      className="btn border-gray-300 focus-ring hover:bg-gray-50/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!!inFlight[device.id] || device.status === "rebooting"}
                      onClick={() => handleReboot(device.id, device.status)}
                      aria-label={`Reboot device ${device.id}`}
                      aria-describedby={`reboot-status-${device.id}`}
                    >
                      {inFlight[device.id] ? "Rebooting..." : "Reboot"}
                    </button>
                </td>
              </>
            )}
          />
        )}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {list.length} devices loaded
      </div>
    </div>
  );
}

export default DevicesPage;