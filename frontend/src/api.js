// Same-origin "/api" in dev (Vite proxy) — set VITE_API_URL for production.
const API = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function req(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  dashboard: () => req("/dashboard"),
  depots: () => req("/depots"),
  vehicles: () => req("/vehicles"),
  orders: () => req("/orders"),
  assignments: () => req("/assignments"),
  createOrder: (body) => req("/orders", { method: "POST", body: JSON.stringify(body) }),
  cancelOrder: (id) => req(`/orders/${id}/cancel`, { method: "PATCH" }),
  optimize: () => req("/optimize", { method: "POST", body: "{}" }),
  reassign: () => req("/reassign", { method: "POST", body: "{}" }),
  telemetry: (body) => req("/telemetry", { method: "POST", body: JSON.stringify(body) }),
  traffic: (body) => req("/traffic", { method: "POST", body: JSON.stringify(body) }),
};
