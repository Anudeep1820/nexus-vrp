// In-memory demo store — zero setup, resets on restart.
const seed = {
  depots: [
    { id: "depot-1", name: "Central Depot", lat: 28.6139, lng: 77.209 },
    { id: "depot-2", name: "South Depot", lat: 28.4595, lng: 77.0266 },
  ],
  vehicles: [
    { id: "veh-1", depot_id: "depot-1", capacity_kg: 200, status: "available", lat: 28.62, lng: 77.21 },
    { id: "veh-2", depot_id: "depot-1", capacity_kg: 150, status: "available", lat: 28.61, lng: 77.2 },
    { id: "veh-3", depot_id: "depot-1", capacity_kg: 300, status: "busy", lat: 28.63, lng: 77.22 },
    { id: "veh-4", depot_id: "depot-2", capacity_kg: 250, status: "available", lat: 28.46, lng: 77.03 },
    { id: "veh-5", depot_id: "depot-2", capacity_kg: 100, status: "available", lat: 28.45, lng: 77.02 },
    { id: "veh-6", depot_id: "depot-2", capacity_kg: 400, status: "offline", lat: 28.47, lng: 77.04 },
  ],
  orders: [
    { id: "ord-1", customer_name: "Anand", lat: 28.6448, lng: 77.2167, weight_kg: 40, status: "assigned", created_at: new Date(Date.now() - 3600e3).toISOString() },
    { id: "ord-2", customer_name: "Priya", lat: 28.5355, lng: 77.391, weight_kg: 25, status: "pending", created_at: new Date(Date.now() - 1800e3).toISOString() },
    { id: "ord-3", customer_name: "Rohan", lat: 28.7041, lng: 77.1125, weight_kg: 60, status: "pending", created_at: new Date(Date.now() - 900e3).toISOString() },
    { id: "ord-4", customer_name: "Meera", lat: 28.4595, lng: 77.0266, weight_kg: 15, status: "pending", created_at: new Date(Date.now() - 600e3).toISOString() },
    { id: "ord-5", customer_name: "Kabir", lat: 28.6692, lng: 77.4538, weight_kg: 90, status: "pending", created_at: new Date(Date.now() - 300e3).toISOString() },
    { id: "ord-6", customer_name: "Sana", lat: 28.4089, lng: 77.3178, weight_kg: 35, status: "delivered", created_at: new Date(Date.now() - 7200e3).toISOString() },
    { id: "ord-7", customer_name: "Dev", lat: 28.627, lng: 77.2191, weight_kg: 20, status: "pending", created_at: new Date(Date.now() - 120e3).toISOString() },
    { id: "ord-8", customer_name: "Isha", lat: 28.4744, lng: 77.503, weight_kg: 55, status: "pending", created_at: new Date(Date.now() - 60e3).toISOString() },
  ],
  assignments: [
    { id: "asg-1", vehicle_id: "veh-3", order_id: "ord-1", sequence: 1, eta_minutes: 18, created_at: new Date(Date.now() - 3500e3).toISOString() },
  ],
  traffic: [
    { region: "north", level: "normal", speed_factor: 1.0 },
    { region: "ring-road", level: "heavy", speed_factor: 0.6 },
  ],
};

const data = structuredClone(seed);

const now = () => new Date().toISOString();

export function createMemoryStore() {
  return {
    listDepots: async () => data.depots,
    listVehicles: async () => data.vehicles,
    listOrders: async () => data.orders,
    listAssignments: async () => data.assignments,
    listTraffic: async () => data.traffic,

    createOrder: async ({ customer_name, lat, lng, weight_kg }) => {
      const order = {
        id: crypto.randomUUID(),
        customer_name: customer_name || "Anonymous",
        lat, lng,
        weight_kg: Number(weight_kg) || 10,
        status: "pending",
        created_at: now(),
      };
      data.orders.push(order);
      return order;
    },

    cancelOrder: async (id) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) return null;
      order.status = "cancelled";
      data.assignments = data.assignments.filter((a) => a.order_id !== id);
      return order;
    },

    applyAssignments: async (assignments) => {
      for (const a of assignments) {
        const order = data.orders.find((o) => o.id === a.order_id);
        if (order) order.status = "assigned";
        data.assignments.push({ id: crypto.randomUUID(), ...a, created_at: now() });
      }
      return assignments;
    },

    // Re-optimization after a disruption: unlock assigned orders and wipe routes.
    resetAssignments: async () => {
      const assignedIds = new Set(data.assignments.map((a) => a.order_id));
      data.orders.forEach((o) => {
        if (assignedIds.has(o.id) && o.status === "assigned") o.status = "pending";
      });
      data.assignments = [];
    },

    updateTelemetry: async ({ vehicle_id, lat, lng, status }) => {
      const v = data.vehicles.find((x) => x.id === vehicle_id);
      if (!v) return null;
      if (typeof lat === "number") v.lat = lat;
      if (typeof lng === "number") v.lng = lng;
      if (status) v.status = status;
      return v;
    },

    upsertTraffic: async ({ region, level, speed_factor }) => {
      const row = data.traffic.find((t) => t.region === region);
      if (row) {
        if (level) row.level = level;
        if (typeof speed_factor === "number") row.speed_factor = speed_factor;
        return row;
      }
      const created = { region, level: level || "normal", speed_factor: speed_factor ?? 1.0 };
      data.traffic.push(created);
      return created;
    },
  };
}
