import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";
import { createStore } from "./store.js";
import { optimize } from "./optimizer.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const store = await createStore();

function trafficFactor(traffic) {
  if (!traffic.length) return 1;
  // Congested regions slow the whole network; use the average speed factor.
  return traffic.reduce((s, t) => s + Number(t.speed_factor), 0) / traffic.length;
}

// ---------- routes ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: process.env.USE_DATABASE === "true" ? "postgres" : "demo" });
});

app.get("/api/dashboard", async (req, res) => {
  const [vehicles, orders, assignments, traffic] = await Promise.all([
    store.listVehicles(), store.listOrders(), store.listAssignments(), store.listTraffic(),
  ]);
  const pending = orders.filter((o) => o.status === "pending");
  const assigned = orders.filter((o) => o.status === "assigned");
  const active = vehicles.filter((v) => v.status !== "offline");
  res.json({
    kpis: {
      total_orders: orders.length,
      pending_orders: pending.length,
      assigned_orders: assigned.length,
      delivered_orders: orders.filter((o) => o.status === "delivered").length,
      fleet_size: vehicles.length,
      active_vehicles: active.length,
      capacity_utilization: active.length
        ? Math.round((active.filter((v) => v.status === "busy").length / active.length) * 100)
        : 0,
      avg_eta_minutes: assignments.length
        ? Math.round(assignments.reduce((s, a) => s + (a.eta_minutes || 0), 0) / assignments.length)
        : 0,
    },
    traffic,
    recent_assignments: assignments.slice(0, 10),
  });
});

app.get("/api/depots", async (req, res) => res.json(await store.listDepots()));
app.get("/api/vehicles", async (req, res) => res.json(await store.listVehicles()));
app.get("/api/orders", async (req, res) => res.json(await store.listOrders()));
app.get("/api/assignments", async (req, res) => res.json(await store.listAssignments()));

app.post("/api/orders", async (req, res) => {
  const { customer_name, lat, lng, weight_kg } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({ error: "lat and lng (numbers) are required" });
  }
  const order = await store.createOrder({ customer_name, lat, lng, weight_kg });
  res.status(201).json(order);
});

app.patch("/api/orders/:id/cancel", async (req, res) => {
  const order = await store.cancelOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

app.post("/api/telemetry", async (req, res) => {
  const { vehicle_id } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: "vehicle_id is required" });
  const vehicle = await store.updateTelemetry(req.body);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  res.json(vehicle);
});

app.post("/api/traffic", async (req, res) => {
  const { region } = req.body;
  if (!region) return res.status(400).json({ error: "region is required" });
  res.json(await store.upsertTraffic(req.body));
});

app.post("/api/optimize", async (req, res) => {
  const [orders, vehicles, traffic] = await Promise.all([
    store.listOrders(), store.listVehicles(), store.listTraffic(),
  ]);
  const { assignments, unassigned } = optimize({
    orders, vehicles, speedFactor: trafficFactor(traffic),
  });
  await store.applyAssignments(assignments);
  res.json({ assigned: assignments.length, unassigned, assignments });
});

app.post("/api/reassign", async (req, res) => {
  await store.resetAssignments();
  const [orders, vehicles, traffic] = await Promise.all([
    store.listOrders(), store.listVehicles(), store.listTraffic(),
  ]);
  const { assignments, unassigned } = optimize({
    orders, vehicles, speedFactor: trafficFactor(traffic),
  });
  await store.applyAssignments(assignments);
  res.json({ reassigned: assignments.length, unassigned, assignments });
});

// Start the server normally; on Vercel the platform invokes the exported app.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => console.log(`NEXUS-VRP backend running at http://localhost:${PORT}`));
}

export default app;
