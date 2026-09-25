const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const dotenv = require("dotenv");
const project = require("../config/supabase.public.json");

function normalizeConnection(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error("Pegá una URI PostgreSQL válida desde Supabase > Connect."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw new Error("La URI debe incluir servidor, usuario y contraseña PostgreSQL.");
  }
  if (/YOUR_PROJECT|YOUR_POOLER_HOST|YOUR.PASSWORD|REPLACE_ME|ENCODED_PASSWORD|\[|\]/i.test(decodeURIComponent(url.href))) {
    throw new Error("Reemplazá los marcadores de ejemplo por la contraseña real, codificada para URL.");
  }
  if (url.port && url.port !== "5432") {
    throw new Error("Usá la conexión Session pooler (5432), no Transaction pooler (6543), para migraciones.");
  }
  url.searchParams.set("schema", "app");
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("connection_limit", "5");
  return url.toString();
}

async function main() {
  const target = path.join(__dirname, "../.env");
  const existing = fs.existsSync(target) ? dotenv.parse(fs.readFileSync(target)) : {};
  let input = process.env.DATABASE_URL || existing.DATABASE_URL;
  try { input = normalizeConnection(input || ""); } catch {
    if (!process.stdin.isTTY) throw new Error("Ejecutá npm run setup en una terminal o definí DATABASE_URL en el entorno.");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try { input = normalizeConnection(await rl.question("Pegá la Session pooler URI con tu contraseña (se guarda solo en .env): ")); }
    finally { rl.close(); }
  }
  let direct = process.env.DIRECT_URL || existing.DIRECT_URL || input;
  if (!process.env.DIRECT_URL && /YOUR_PROJECT|YOUR_POOLER_HOST|YOUR.PASSWORD|REPLACE_ME|ENCODED_PASSWORD/i.test(direct)) direct = input;
  const publicOverrides = process.env.SUPABASE_URL || process.env.SUPABASE_PUBLISHABLE_KEY ? process.env : existing;
  if (!!publicOverrides.SUPABASE_URL !== !!publicOverrides.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Configurá SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY juntas para cambiar de proyecto.");
  }
  const settings = {
    ...existing,
    DATABASE_URL: input,
    DIRECT_URL: normalizeConnection(direct),
    SUPABASE_URL: publicOverrides.SUPABASE_URL || project.url,
    SUPABASE_PUBLISHABLE_KEY: publicOverrides.SUPABASE_PUBLISHABLE_KEY || project.publishableKey,
    CORS_ORIGINS: existing.CORS_ORIGINS || "http://localhost:5173",
    PORT: existing.PORT || "3001",
  };
  fs.writeFileSync(target, Object.entries(settings).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join("\n") + "\n", { mode: 0o600 });
  console.log("Configuración guardada en .env. No compartas ni publiques este archivo.");
  console.log("Base ya preparada: npm run db:baseline, luego npm run db:deploy y npm run dev. Base nueva: npm run db:deploy.");
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { normalizeConnection };
