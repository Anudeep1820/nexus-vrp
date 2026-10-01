import { useCallback, useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "./api";

const CENTER = [28.6139, 77.209];
const VEHICLE_COLOR = { available: "#22c55e", busy: "#3b82f6", offline: "#64748b" };
const ORDER_COLOR = { pending: "#f97316", assigned: "#a78bfa", delivered: "#10b981", cancelled: "#ef4444" };

const NAMES = ["Aarav", "Zara", "Vikram", "Nina", "Arjun", "Tara", "Ravi", "Lena"];

export default function App() {
  const [dash, setDash] = useState(null);
  const [depots, setDepots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [status, setStatus] = useState("Loading…");

  const refresh = useCallback(async () => {
    try {
      const [d, dp, v, o, a] = await Promise.all([
        api.dashboard(), api.depots(), api.vehicles(), api.orders(), api.assignments(),
      ]);
      setDash(d); setDepots(dp); setVehicles(v); setOrders(o); setAssignments(a);
      setStatus(`Updated ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      setStatus(`Backend unreachable — is it running on :4000? (${e.message})`);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const act = async (fn, label) => {
    setStatus(`${label}…`);
    try {
      await fn();
      await refresh();
      setStatus(`${label} done ✔`);
    } catch (e) {
      setStatus(`${label} failed: ${e.message}`);
    }
  };

  const simulateOrder = () => {
    const jitter = () => (Math.random() - 0.5) * 0.35;
    act(() => api.createOrder({
      customer_name: NAMES[Math.floor(Math.random() * NAMES.length)],
      lat: CENTER[0] + jitter(),
      lng: CENTER[1] + jitter(),
      weight_kg: 5 + Math.floor(Math.random() * 90),
    }), "Creating order");
  };

  const kpis = dash?.kpis ?? {};

  return (
    <div className="app">
      <header>
        <h1>NEXUS-VRP</h1>
        <div className="actions">
          <button onClick={simulateOrder}>＋ Simulate order</button>
          <button className="primary" onClick={() => act(api.optimize, "Optimizing")}>⚡ Optimize</button>
          <button onClick={() => act(api.reassign, "Reassigning")}>↻ Reassign</button>
          <button onClick={refresh}>Refresh</button>
        </div>
      </header>
      <p className="status">{status}</p>

      <div className="kpis">
        <Card label="Pending orders" value={kpis.pending_orders} />
        <Card label="Assigned" value={kpis.assigned_orders} />
        <Card label="Active vehicles" value={`${kpis.active_vehicles ?? "–"}/${kpis.fleet_size ?? "–"}`} />
        <Card label="Fleet utilization" value={kpis.capacity_utilization != null ? `${kpis.capacity_utilization}%` : "–"} />
        <Card label="Avg ETA" value={kpis.avg_eta_minutes != null ? `${kpis.avg_eta_minutes} min` : "–"} />
      </div>

      <div className="main">
        <div className="map-wrap">
          <MapContainer center={CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors" />
            {depots.map((d) => (
              <CircleMarker key={d.id} center={[d.lat, d.lng]} radius={10}
                pathOptions={{ color: "#0f172a", fillColor: "#e2e8f0", fillOpacity: 0.9 }}>
                <Tooltip permanent direction="top" className="label">{d.name}</Tooltip>
              </CircleMarker>
            ))}
            {vehicles.map((v) => (
              <CircleMarker key={v.id} center={[v.lat, v.lng]} radius={8}
                pathOptions={{ color: "#fff", weight: 1, fillColor: VEHICLE_COLOR[v.status] ?? "#22c55e", fillOpacity: 1 }}>
                <Popup>🚚 {v.id} · {v.status} · capacity {v.capacity_kg} kg</Popup>
              </CircleMarker>
            ))}
            {orders.map((o) => (
              <CircleMarker key={o.id} center={[o.lat, o.lng]} radius={6}
                pathOptions={{ color: "#fff", weight: 1, fillColor: ORDER_COLOR[o.status] ?? "#f97316", fillOpacity: 0.95 }}>
                <Popup>📦 {o.customer_name} · {o.weight_kg} kg · <b>{o.status}</b></Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <Legend />
        </div>

        <div className="side">
          <h2>Orders</h2>
          <table>
            <thead><tr><th>Customer</th><th>kg</th><th>Status</th><th /></tr></thead>
            <tbody>
              {orders.slice(0, 12).map((o) => (
                <tr key={o.id}>
                  <td>{o.customer_name}</td>
                  <td>{o.weight_kg}</td>
                  <td><span className={`pill ${o.status}`}>{o.status}</span></td>
                  <td>{o.status === "pending" && (
                    <button className="mini" onClick={() => act(() => api.cancelOrder(o.id), "Cancelling")}>✕</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Assignments ({assignments.length})</h2>
          <table>
            <thead><tr><th>Vehicle</th><th>Order</th><th>Seq</th><th>ETA</th></tr></thead>
            <tbody>
              {assignments.slice(0, 8).map((a) => (
                <tr key={a.id}>
                  <td>{a.vehicle_id}</td><td>{a.order_id}</td>
                  <td>{a.sequence}</td><td>{a.eta_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Traffic</h2>
          <ul className="traffic">
            {(dash?.traffic ?? []).map((t) => (
              <li key={t.region}>{t.region}: <b>{t.level}</b> (×{t.speed_factor})</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return <div className="card"><span>{label}</span><strong>{value ?? "–"}</strong></div>;
}

function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: "#22c55e" }} /> available</span>
      <span><i style={{ background: "#3b82f6" }} /> busy</span>
      <span><i style={{ background: "#64748b" }} /> offline</span>
      <span><i style={{ background: "#f97316" }} /> pending</span>
      <span><i style={{ background: "#a78bfa" }} /> assigned</span>
      <span><i style={{ background: "#10b981" }} /> delivered</span>
      <span><i style={{ background: "#ef4444" }} /> cancelled</span>
    </div>
  );
}
