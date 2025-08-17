import { act } from '@testing-library/react';
import { useDeviceStore } from '@/lib/store';

describe('device store', () => {
  beforeEach(() => { 
    useDeviceStore.setState({ devices: [], filter: '', inFlight: {} }); 
  });

  it('upserts a new device', () => { 
    act(() => { 
      useDeviceStore.getState().upsertDevice({ 
        deviceId: 'dev-000001', 
        status: 'online', 
        metrics: { cpu: 10, ram: 20 }, 
        ts: 1,
        lastSeq: 0
      }); 
    }); 
    const s = useDeviceStore.getState(); 
    expect(s.devices.length).toBe(1); 
    expect(s.devices[0].id).toBe('dev-000001'); 
    expect(s.devices[0].cpu).toBe(10); 
  });

  it('updates existing device', () => { 
    act(() => { 
      useDeviceStore.getState().upsertDevice({ 
        deviceId: 'dev-1', 
        status: 'online', 
        metrics: { cpu: 10 }, 
        ts: 1,
        lastSeq: 0
      }); 
    }); 
    act(() => { 
      useDeviceStore.getState().upsertDevice({ 
        deviceId: 'dev-1', 
        metrics: { cpu: 55 }, 
        ts: 2,
        lastSeq: 1
      }); 
    }); 
    const s = useDeviceStore.getState(); 
    expect(s.devices[0].cpu).toBe(55); 
    expect(s.devices[0].status).toBe('online'); 
  });

  
  it('filters devices correctly', () => {
    act(() => {
      useDeviceStore.getState().setDevices([
        { id: 'dev-001', status: 'online', cpu: 50, ts: 1000 },
        { id: 'dev-002', status: 'offline', cpu: 0, ts: 2000 },
        { id: 'dev-003', status: 'online', cpu: 80, ts: 3000 }
      ]);
    });

    act(() => {
      useDeviceStore.getState().setFilter('online');
    });
    expect(useDeviceStore.getState().filter).toBe('online');

    // Test filter by ID
    act(() => {
      useDeviceStore.getState().setFilter('dev-001');
    });
    expect(useDeviceStore.getState().filter).toBe('dev-001');
  });

  it('handles optimistic updates for reboot', () => {
    act(() => {
      useDeviceStore.getState().setDevices([
        { id: 'dev-reboot', status: 'online', cpu: 50, ts: 1000 }
      ]);
    });

    act(() => {
      useDeviceStore.getState().setInFlight('dev-reboot', true);
    });
    expect(useDeviceStore.getState().inFlight['dev-reboot']).toBe(true);

    act(() => {
      useDeviceStore.getState().upsertDevice({
        deviceId: 'dev-reboot',
        status: 'rebooting',
        ts: 2000
      });
    });
    
    const device = useDeviceStore.getState().devices.find(d => d.id === 'dev-reboot');
    expect(device?.status).toBe('rebooting');
  });

  it('ignores duplicate sequence numbers', () => {
    act(() => {
      useDeviceStore.getState().setDevices([
        { id: 'dev-seq', status: 'online', cpu: 50, ts: 1000, lastSeq: 100 }
      ]);
    });

    act(() => {
      useDeviceStore.getState().upsertDevice({
        deviceId: 'dev-seq',
        seq: 100,
        metrics: { cpu: 75 },
        ts: 2000,
        lastSeq: 100
      });
    });
    
    const device = useDeviceStore.getState().devices.find(d => d.id === 'dev-seq');
    expect(device?.cpu).toBe(50);
    expect(device?.ts).toBe(1000);
  });
});