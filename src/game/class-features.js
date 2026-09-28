const data = require("./data/classes-2024.json").results;
const byKey = new Map(data.map((c) => [c.key, c]));
function subclassOptions(key) {
  return data
    .filter((c) => c.subclass_of?.key === `srd-2024_${key}`)
    .map((c) => ({ key: c.key, name: c.name }));
}
function features(classes) {
  return classes.flatMap((c) =>
    [byKey.get(`srd-2024_${c.key}`), byKey.get(c.subclass)]
      .filter(Boolean)
      .flatMap((source) =>
        source.features
          .filter(
            (f) =>
              f.feature_type === "CLASS_LEVEL_FEATURE" &&
              f.gained_at.some((g) => g.level <= c.level),
          )
          .map((f) => ({
            key: f.key,
            name: f.name,
            description: f.desc,
            origin: c.key,
            source: source.document?.name || "Open5e · SRD 2024",
          })),
      ),
  );
}
module.exports = { features, subclassOptions };
