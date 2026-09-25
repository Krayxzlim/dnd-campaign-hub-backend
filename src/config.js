const path = require("node:path");
const project = require("../config/supabase.public.json");

function loadConfig(env = process.env) {
  require("dotenv").config({ path: path.join(__dirname, "../.env"), processEnv: env });
  const override = env.SUPABASE_URL || env.SUPABASE_PUBLISHABLE_KEY;
  if (override && (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error("Configurá SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY juntas para cambiar de proyecto.");
  }
  env.SUPABASE_URL ||= project.url;
  env.SUPABASE_PUBLISHABLE_KEY ||= project.publishableKey;
  if (!env.DATABASE_URL || /YOUR_PROJECT|ENCODED_PASSWORD|YOUR_POOLER_HOST|\[YOUR-PASSWORD\]/i.test(env.DATABASE_URL)) {
    throw new Error("Falta configurar la conexión PostgreSQL. Ejecutá npm run setup y pegá la Session pooler URI de Supabase > Connect. La contraseña es privada del backend.");
  }
  env.DIRECT_URL ||= env.DATABASE_URL;
  return env;
}

module.exports = { loadConfig };
