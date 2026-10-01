// Constraint-aware greedy heuristic: assigns each pending order to the nearest
// vehicle with enough remaining capacity. Respects capacity + vehicle status;
// traffic slows speeds and inflates ETAs.
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const BASE_SPEED_KMH = 40;

export function optimize({ orders, vehicles, speedFactor = 1 }) {
  const pending = orders.filter((o) => o.status === "pending");
  const fleet = vehicles
    .filter((v) => v.status !== "offline")
    .map((v) => ({ ...v, remaining: Number(v.capacity_kg) || 100, route: [] }));

  const assignments = [];
  const unassigned = [];

  for (const order of pending) {
    let best = null;
    let bestDist = Infinity;
    for (const v of fleet) {
      if (Number(order.weight_kg) > v.remaining) continue; // capacity constraint
      const d = haversineKm({ lat: v.lat, lng: v.lng }, order);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    if (!best) {
      unassigned.push(order.id);
      continue;
    }
    best.remaining -= Number(order.weight_kg);
    const sequence = best.route.length + 1;
    best.route.push(order.id);
    const eta = Math.ceil(bestDist / (BASE_SPEED_KMH * speedFactor) * 60);
    assignments.push({
      vehicle_id: best.id,
      order_id: order.id,
      sequence,
      eta_minutes: eta,
      distance_km: Math.round(bestDist * 100) / 100,
    });
  }

  return { assignments, unassigned };
}
