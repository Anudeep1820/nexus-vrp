# NEXUS-VRP Backend

Express 5 API for the NEXUS-VRP hackathon dashboard. Runs in **demo mode**
(in-memory, zero setup) by default; flip `USE_DATABASE=true` for PostgreSQL.

## Run locally

```bash
npm install
cp .env.example .env   # optional; demo mode needs nothing
npm run dev            # http://localhost:4000
```

Check `GET /api/health` → `{ "status": "ok", "mode": "demo" }`

## Deploy

### Backend → Render (recommended for the demo)

In-memory demo data only survives while the process is alive, so use a
long-running web service rather than serverless.

1. Push this folder to GitHub.
2. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → connect the repo.
3. Root directory: `nexus-vrp-backend` · Build: `npm install` · Start: `npm start`.
4. Copy the URL, e.g. `https://nexus-vrp-backend.onrender.com`.

### Backend → Vercel (only with a real database)

Serverless functions restart between calls, wiping demo memory.

1. Import the repo at [vercel.com/new](https://vercel.com/new), root dir `nexus-vrp-backend`.
2. `vercel.json` is already included.
3. Provision a Postgres DB (Vercel Postgres / Neon), run `db/schema.sql`,
   then set env vars `USE_DATABASE=true` and `DATABASE_URL`.

### PostgreSQL setup

```bash
createdb nexus_vrp
psql -d nexus_vrp -f db/schema.sql
# then in .env: USE_DATABASE=true, DATABASE_URL=postgresql://user:pass@host:5432/nexus_vrp
```

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Health + mode |
| GET | /api/dashboard | KPIs + traffic + recent assignments |
| GET | /api/depots | All depots |
| GET | /api/vehicles | Fleet state |
| GET | /api/orders | Orders |
| GET | /api/assignments | Current assignments |
| POST | /api/orders | Create order `{customer_name, lat, lng, weight_kg}` |
| PATCH | /api/orders/:id/cancel | Cancel order |
| POST | /api/optimize | Assign pending orders (greedy, capacity-aware) |
| POST | /api/reassign | Re-optimize after disruption |
| POST | /api/telemetry | `{vehicle_id, lat?, lng?, status?}` |
| POST | /api/traffic | `{region, level?, speed_factor?}` |
