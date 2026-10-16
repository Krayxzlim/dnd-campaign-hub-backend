const { Router } = require("express");
const { z } = require("zod");
const { route } = require("../lib/http");
const creation = require("../game/creation-rules");
const cache = new Map();
const entry = z.object({
  key: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  document: z.object({ key: z.literal("srd-2024"), name: z.string() }),
  desc: z.string(),
  higher_level: z.string().nullable().optional(),
  casting_time: z.string(),
  range_text: z.string(),
  concentration: z.boolean(),
  ritual: z.boolean(),
  classes: z.array(z.object({ key: z.string() })),
  duration: z.string(),
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.boolean(),
  material_specified: z.string().nullable().optional(),
});
function normalize(value) {
  const s = entry.parse(value);
  const components = [
    s.verbal ? "V" : "",
    s.somatic ? "S" : "",
    s.material ? `M (${s.material_specified || "ver descripción"})` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    key: s.key,
    name: s.name,
    level: s.level,
    source: `Open5e · ${s.document.name} · ${s.key}`,
    origins: s.classes.map((c) => c.key.replace("srd-2024_", "")),
    origin: s.classes[0]?.key.replace("srd-2024_", "") || "wizard",
    castingTime: s.casting_time,
    range: s.range_text,
    concentration: s.concentration,
    ritual: s.ritual,
    prepared: false,
    description: `${s.desc}\n\n${s.higher_level || ""}\n\nComponents: ${components}\nDuration: ${s.duration}`,
  };
}
module.exports = ({ auth }) => {
  const r = Router();
  r.use(auth);
  r.get(
    "/creation",
    route(async (req, res) =>
      res.json({
        ...creation.catalog(),
        backgroundDecisionsVersion: 1,
        backgroundSkillsVersion: 1,
        backgroundLoadoutVersion: 1,
        originFeatsVersion: 1,
        classSkillsVersion: 1,
        classBasicsVersion: 1,
        rogueExpertiseVersion: 1,
        skills: require("../game/rules").SKILLS.map(([key, name]) => ({
          key,
          name,
        })),
        originSpells: require("../game/origin-feats").catalog(),
        backgrounds: require("../game/backgrounds").catalog(),
      }),
    ),
  );
  r.post(
    "/creation/preview",
    route(async (req, res) => res.json(creation.preview(req.body))),
  );
  r.post(
    "/creation/background-preview",
    route(async (req, res) =>
      res.json(require("../game/backgrounds").preview(req.body)),
    ),
  );
  r.get(
    "/species",
    route(async (req, res) =>
      res.json({
        document: "srd-2024",
        results: require("../game/data/species-2024.json")
          .results.filter((s) => !s.is_subspecies)
          .map((s) => ({
            key: s.key,
            name: s.name,
            description: s.traits
              .map((t) => `${t.name}: ${t.desc}`)
              .join("\n\n"),
            traits: s.traits.map((t) => ({
              name: t.name,
              description: t.desc,
              type: t.type,
            })),
            size: s.traits.find((t) => t.type === "SIZE")?.desc || "",
            speed: s.traits.find((t) => t.type === "SPEED")?.desc || "",
            source: "Open5e · SRD 2024",
          })),
      }),
    ),
  );
  r.get(
    "/spells",
    route(async (req, res) => {
      const q = z
          .string()
          .trim()
          .max(100)
          .parse(req.query.q || ""),
        page = z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .parse(req.query.page || 1);
      const params = new URLSearchParams({
        document__key: "srd-2024",
        limit: "20",
        page: String(page),
        name__icontains: q,
      });
      const key = params.toString(),
        prior = cache.get(key);
      if (prior && Date.now() - prior.at < 3600000) return res.json(prior.data);
      try {
        const response = await fetch(
          `https://api.open5e.com/v2/spells/?${params}`,
          { signal: AbortSignal.timeout(12000) },
        );
        if (!response.ok) throw new Error("upstream");
        const data = await response.json();
        const output = {
          source: "https://open5e.com",
          document: "srd-2024",
          hasNext: !!data.next,
          results: z.array(entry).parse(data.results).map(normalize),
        };
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(key, { at: Date.now(), data: output });
        res.json(output);
      } catch {
        res.status(502).json({
          error:
            "El catálogo Open5e no está disponible. Podés consultar los conjuros ya guardados.",
        });
      }
    }),
  );
  return r;
};
module.exports.normalize = normalize;
