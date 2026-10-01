// Picks the storage backend: in-memory demo (default) or PostgreSQL.
export async function createStore() {
  if (process.env.USE_DATABASE === "true") {
    const { createPgStore } = await import("./store/pg.js");
    return createPgStore();
  }
  const { createMemoryStore } = await import("./store/memory.js");
  return createMemoryStore();
}
