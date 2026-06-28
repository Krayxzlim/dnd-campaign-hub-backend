const express = require("express");
const router = express.Router();
const https = require("https");
const { authMiddleware } = require("../middleware/auth");

const OPEN5E_BASE = "https://api.open5e.com/v1";

// XP por Challenge Rating según la tabla oficial de D&D 5e
const XP_POR_CR = {
  0: 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

function fetchOpen5e(path) {
  return new Promise((resolve, reject) => {
    const url = `${OPEN5E_BASE}${path}`;
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Respuesta inválida de Open5e"));
          }
        });
      })
      .on("error", reject);
  });
}

function normalizar(m) {
  const crStr = String(m.challenge_rating ?? "?");
  const xp = XP_POR_CR[crStr] ?? 0;
  const accion = (m.actions || [])[0] || {};
  return {
    id: m.slug,
    slug: m.slug,
    name: m.name,
    hp: m.hit_points || 10,
    ac: m.armor_class || 10,
    cr: crStr,
    xp,
    attack: accion.attack_bonus != null ? `+${accion.attack_bonus}` : "+0",
    damage: accion.damage_dice || "1d6",
    type: m.type || "",
    size: m.size || "",
    alignment: m.alignment || "",
    speed: m.speed || "",
    str: m.strength,
    dex: m.dexterity,
    con: m.constitution,
    int: m.intelligence,
    wis: m.wisdom,
    cha: m.charisma,
    // Habilidades especiales resumidas
    special_abilities: (m.special_abilities || []).map((s) => s.name),
    actions: (m.actions || []).map((a) => ({ name: a.name, desc: a.desc })),
    legendary_actions: (m.legendary_actions || []).map((a) => a.name),
  };
}

// GET /api/monsters?search=&cr=&type=&page=1
router.get("/", authMiddleware, async (req, res) => {
  const { search = "", cr, type, page = 1 } = req.query;

  let qs = `?limit=50&page=${page}&document__slug=wotc-srd`;
  if (search) qs += `&name__icontains=${encodeURIComponent(search)}`;
  if (cr) qs += `&challenge_rating=${encodeURIComponent(cr)}`;
  if (type) qs += `&type__iexact=${encodeURIComponent(type)}`;

  try {
    const data = await fetchOpen5e(`/monsters/${qs}`);
    res.json({
      count: data.count,
      next: !!data.next,
      previous: !!data.previous,
      page: +page,
      results: (data.results || []).map(normalizar),
    });
  } catch (e) {
    res
      .status(502)
      .json({ error: "No se pudo conectar con Open5e", detail: e.message });
  }
});

// GET /api/monsters/:slug — detalle completo
router.get("/:slug", authMiddleware, async (req, res) => {
  try {
    const data = await fetchOpen5e(`/monsters/${req.params.slug}/`);
    res.json(normalizar(data));
  } catch (e) {
    res.status(404).json({ error: "Monstruo no encontrado en Open5e" });
  }
});

// POST /api/monsters/xp — calcula XP total y dificultad estimada para una lista de monstruos
// Body: { monstruos: [{cr, cantidad}] }
router.post("/xp", authMiddleware, (req, res) => {
  const { monstruos = [] } = req.body;

  let xpTotal = 0;
  monstruos.forEach(({ cr, cantidad = 1, xp_unidad }) => {
    const xpUnit = xp_unidad ?? XP_POR_CR[String(cr)] ?? 0;
    xpTotal += xpUnit * cantidad;
  });

  let dificultad = "Trivial";
  if (xpTotal >= 1100) dificultad = "Fácil";
  if (xpTotal >= 2250) dificultad = "Media";
  if (xpTotal >= 3600) dificultad = "Difícil";
  if (xpTotal >= 5100) dificultad = "Mortal";

  res.json({ xp_total: xpTotal, dificultad });
});

module.exports = router;
