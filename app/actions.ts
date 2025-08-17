'use server';

const API_URL = "http://localhost:4002/control/reboot";
export const rebootDevice = async (
  deviceId: string, 
  idempotencyKey: string
): Promise<{ ok: boolean; reason?: string }> => {
  try {
    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
      return { ok: false, reason: "Invalid device ID" };
    }
    
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
      return { ok: false, reason: "Invalid idempotency key" };
    }


    const res = await fetch(API_URL, {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        deviceId: deviceId.trim(), 
        idemKey: idempotencyKey.trim() 
      })
    });

    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (typeof data.ok === "boolean") {
      console.log("🚀 ~ rebootDevice ~ data:", JSON.stringify(data, null, 2))
      return {
        ok: data.ok,
        reason: data.reason,
        ...(data.dedup && { dedup: data.dedup })
      };
    }
    
    return { ok: false, reason: "Malformed response" };
  } catch (e: any) {
    const errorMessage = e?.message || "Network error";
    console.error('Reboot device error:', {
      deviceId,
      idempotencyKey,
      error: errorMessage
    });
    
    return { ok: false, reason: errorMessage };
  }
}