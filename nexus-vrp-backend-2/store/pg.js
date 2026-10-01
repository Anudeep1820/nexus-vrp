// PostgreSQL store — run db/schema.sql first, set USE_DATABASE=true + DATABASE_URL.
import pg from "pg";

export async function createPgStore() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  return {
    listDepots: async () => (await pool.query("SELECT * FROM depots ORDER BY id")).rows,
    listVehicles: async () => (await pool.query("SELECT * FROM vehicles ORDER BY id")).rows,
    listOrders: async () => (await pool.query("SELECT * FROM orders ORDER BY created_at DESC")).rows,
    listAssignments: async () => (await pool.query("SELECT * FROM assignments ORDER BY created_at DESC")).rows,
    listTraffic: async () => (await pool.query("SELECT * FROM traffic ORDER BY region")).rows,

    createOrder: async ({ customer_name, lat, lng, weight_kg }) => {
      const { rows } = await pool.query(
        `INSERT INTO orders (id, customer_name, lat, lng, weight_kg, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending') RETURNING *`,
        [customer_name || "Anonymous", lat, lng, Number(weight_kg) || 10]
      );
      return rows[0];
    },

    cancelOrder: async (id) => {
      const { rows } = await pool.query(
        `UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *`, [id]);
      if (rows[0]) await pool.query(`DELETE FROM assignments WHERE order_id = $1`, [id]);
      return rows[0] || null;
    },

    applyAssignments: async (assignments) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const a of assignments) {
          await client.query(
            `INSERT INTO assignments (id, vehicle_id, order_id, sequence, eta_minutes)
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [a.vehicle_id, a.order_id, a.sequence, a.eta_minutes]);
          await client.query(`UPDATE orders SET status = 'assigned' WHERE id = $1`, [a.order_id]);
        }
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
      return assignments;
    },

    resetAssignments: async () => {
      await pool.query(
        `UPDATE orders SET status = 'pending'
         WHERE id IN (SELECT order_id FROM assignments) AND status = 'assigned'`);
      await pool.query(`DELETE FROM assignments`);
    },

    updateTelemetry: async ({ vehicle_id, lat, lng, status }) => {
      const { rows } = await pool.query(
        `UPDATE vehicles
         SET lat = COALESCE($2, lat), lng = COALESCE($3, lng),
             status = COALESCE($4, status), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [vehicle_id, lat ?? null, lng ?? null, status ?? null]);
      return rows[0] || null;
    },

    upsertTraffic: async ({ region, level, speed_factor }) => {
      const { rows } = await pool.query(
        `INSERT INTO traffic (region, level, speed_factor, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (region) DO UPDATE
           SET level = EXCLUDED.level, speed_factor = EXCLUDED.speed_factor,
               updated_at = now()
         RETURNING *`,
        [region, level || "normal", speed_factor ?? 1.0]);
      return rows[0];
    },
  };
}
