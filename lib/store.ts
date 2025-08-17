import { create } from "zustand";
export type Device = { id: string; status: "online"|"offline"|"error"|"rebooting"; cpu?: number; ram?: number; ts?: number; };
type Telemetry = { deviceId: string; status?: Device["status"]; metrics?: { cpu?: number; ram?: number }; ts?: number; seq?: number; };
type State = { devices: Device[]; filter: string; inFlight: Record<string, boolean>;
  setDevices: (arr: Device[]) => void; setFilter: (v: string) => void; setInFlight: (id: string, v: boolean) => void; upsertDevice: (t: Telemetry) => void; };
export const useDeviceStore = create<State>((set, get) => ({
  devices: [], filter: "", inFlight: {},
  setDevices: (arr) => set({ devices: arr }),
  setFilter: (v) => set({ filter: v }),
  setInFlight: (id, v) => set(s => ({ inFlight: { ...s.inFlight, [id]: v } })),
  upsertDevice: (t) => set((state) => {
    const idx = state.devices.findIndex(d => d.id === t.deviceId);
    if (idx === -1) {
      const d: Device = { id: t.deviceId, status: (t.status as any) ?? "online", cpu: t.metrics?.cpu, ram: t.metrics?.ram, ts: t.ts ?? Date.now() };
      return { devices: [d, ...state.devices] };
    } else {
      const d = state.devices[idx];
      const updated: Device = { ...d, status: (t.status as any) ?? d.status, cpu: t.metrics?.cpu ?? d.cpu, ram: t.metrics?.ram ?? d.ram, ts: t.ts ?? d.ts };
      const copy = state.devices.slice(); copy[idx] = updated; return { devices: copy };
    }
  })
}));
