const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConnection } = require("../scripts/setup-env");

test("prepara una conexión de sesión sin cambiar una contraseña codificada", () => {
  const url = new URL(normalizeConnection("postgresql://postgres.test:a%40b%23c@pooler.example.com:5432/postgres"));
  assert.equal(url.password, "a%40b%23c");
  assert.equal(url.searchParams.get("schema"), "app");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("rechaza conexiones incompletas y el pooler de transacciones para migraciones", () => {
  for (const value of ["", "https://example.com", "postgresql://postgres@host:5432/postgres", "postgresql://postgres:secret@host:6543/postgres", "postgresql://postgres:[YOUR-PASSWORD]@host:5432/postgres"]) {
    assert.throws(() => normalizeConnection(value));
  }
});
