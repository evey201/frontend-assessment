import { create } from "zustand";

export type Device = {
  id: string;
  status: "online" | "offline" | "error" | "rebooting";
  cpu?: number;
  ram?: number;
  ts?: number;
  lastSeq?: number;
};
type Telemetry = {
  deviceId: string;
  status?: Device["status"];
  metrics?: { cpu?: number; ram?: number };
  ts?: number;
  seq?: number;
  lastSeq?: number;
};
type State = {
  devices: Device[];
  filter: string;
  inFlight: Record<string, boolean>;
  setDevices: (arr: Device[]) => void;
  setFilter: (v: string) => void;
  setInFlight: (id: string, v: boolean) => void;
  upsertDevice: (t: Telemetry) => void;
};

export const useDeviceStore = create<State>((set, get) => ({
  devices: [],
  filter: "",
  inFlight: {},
  setDevices: (arr) => set({ devices: arr }),
  setFilter: (v) => set({ filter: v }),
  setInFlight: (id, v) => set((s) => ({ inFlight: { ...s.inFlight, [id]: v } })),
  upsertDevice: (t) =>
    set((state) => {
      if (!t.deviceId || typeof t.deviceId !== 'string' || t.deviceId.trim() === '') {
        console.warn('Store: Invalid deviceId in telemetry:', t);
        return state;
      }

      const idx = state.devices.findIndex((d) => d.id === t.deviceId);
      if (idx === -1) {
        const newDevice: Device = {
          id: t.deviceId,
          status: (t.status as any) ?? "online",
          cpu: t.metrics?.cpu,
          ram: t.metrics?.ram,
          ts: t.ts ?? Date.now(),
          lastSeq: t.seq,
        };
        // const d: Device = {
        //   id: t.deviceId,
        //   status: (t.status as any) ?? "online",
        //   cpu: t.metrics?.cpu,
        //   ram: t.metrics?.ram,
        //   ts: t.ts ?? Date.now(),
        // };
        console.log(`Store: Adding new device ${t.deviceId} with seq ${t.seq}`);
        return { devices: [newDevice, ...state.devices] };
      } else {
        const existingDevice = state.devices[idx];
        if (t.seq !== undefined && existingDevice.lastSeq !== undefined && t.seq === existingDevice.lastSeq) {
          // console.log(`Store: Ignoring duplicate event for ${t.deviceId}: seq ${t.seq}`);
          return state;
        }
        if (t.seq !== undefined && existingDevice.lastSeq !== undefined && t.seq < existingDevice.lastSeq) {
          // console.log(`Store: Ignoring out-of-order event for ${t.deviceId}: seq ${t.seq} < ${existingDevice.lastSeq}`);
          return state;
        }

        const updated: Device = {
          ...existingDevice,
          status: (t.status as any) ?? existingDevice.status,
          cpu: t.metrics?.cpu ?? existingDevice.cpu,
          ram: t.metrics?.ram ?? existingDevice.ram,
          ts: t.ts ?? existingDevice.ts,
          lastSeq: t.seq ?? existingDevice.lastSeq,
        };

        const copy = state.devices.slice();
        copy[idx] = updated;
        return { devices: copy };
      }
    }),
}));
