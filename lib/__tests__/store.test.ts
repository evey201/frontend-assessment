import { act } from '@testing-library/react'; import { useDeviceStore } from '@/lib/store';

describe('device store', () => {
  beforeEach(() => { useDeviceStore.setState({ devices: [], filter: '', inFlight: {} }); });
  it('upserts a new device', () => { act(() => { useDeviceStore.getState().upsertDevice({ deviceId: 'dev-000001', status: 'online', metrics: { cpu: 10, ram: 20 }, ts: 1 }); }); const s = useDeviceStore.getState(); expect(s.devices.length).toBe(1); expect(s.devices[0].id).toBe('dev-000001'); expect(s.devices[0].cpu).toBe(10); });
  it('updates existing device', () => { act(() => { useDeviceStore.getState().upsertDevice({ deviceId: 'dev-1', status: 'online', metrics: { cpu: 10 }, ts: 1 }); }); act(() => { useDeviceStore.getState().upsertDevice({ deviceId: 'dev-1', metrics: { cpu: 55 }, ts: 2 }); }); const s = useDeviceStore.getState(); expect(s.devices[0].cpu).toBe(55); expect(s.devices[0].status).toBe('online'); });
});
