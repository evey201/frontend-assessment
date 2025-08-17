'use server';
export async function rebootDevice(deviceId: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const idemKey = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
    const res = await fetch("http://localhost:4002/control/reboot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, idemKey })
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    if (typeof data.ok === "boolean") return data;
    return { ok: false, reason: "Malformed response" };
  } catch (e: any) { return { ok: false, reason: e?.message || "Network error" }; }
}
