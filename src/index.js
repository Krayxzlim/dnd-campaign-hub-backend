const { loadConfig } = require("./config");
const { createClient } = require("@supabase/supabase-js");
const { createApp } = require("./app");
async function start() {
  loadConfig();
  const { prisma } = require("./db/database");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  await prisma.$connect();
  const app = createApp({
    db: prisma,
    supabase,
    origins: (process.env.CORS_ORIGINS || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim()),
  });
  const server = app.listen(Number(process.env.PORT || 3001), () =>
    console.log("D&D API lista"),
  );
  const stop = () =>
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
if (require.main === module)
  start().catch((error) => {
    console.error("No se pudo iniciar:", error.message);
    process.exit(1);
  });
module.exports = { start };
