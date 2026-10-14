const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");

test(
  "Prisma + Express integration against PostgreSQL WASM",
  { timeout: 60000 },
  async (t) => {
    const pg = await PGlite.create();
    // Minimal fixture for the external Supabase Auth schema; no real accounts/emails are created.
    await pg.exec(
      "CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE ROLE anon; CREATE ROLE authenticated;",
    );
    for (const dir of readdirSync("prisma/migrations")
      .filter((d) => !d.endsWith(".toml"))
      .sort())
      await pg.exec(
        readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"),
      );
    const socket = new PGLiteSocketServer({
      db: pg,
      port: 0,
      host: "127.0.0.1",
    });
    await socket.start();
    const db = new PrismaClient({
      datasources: {
        db: {
          url: `postgresql://postgres:postgres@${socket.getServerConn()}/template1?schema=app&connection_limit=1`,
        },
      },
    });
    let server;
    t.after(async () => {
      if (server) {
        server.closeAllConnections();
        await new Promise((r) => server.close(r));
      }
      await db.$disconnect();
      await socket.stop();
      await pg.close();
    });
    await db.$connect();
    const identities = {};
    for (const name of ["dm", "player", "outsider", "otherDm"]) {
      identities[name] = {
        id: randomUUID(),
        email: `${name.toLowerCase()}@example.com`,
        user_metadata: { username: name, role: "dm" },
      };
      await pg.query("INSERT INTO auth.users(id) VALUES ($1)", [
        identities[name].id,
      ]);
    }
    const supabase = {
      auth: {
        getUser: async (token) => ({
          data: { user: identities[token] || null },
          error: identities[token] ? null : new Error("invalid"),
        }),
      },
    };
    server = createApp({ db, supabase }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function request(who, method, path, body, status = 200) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(who ? { Authorization: `Bearer ${who}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json();
      assert.equal(
        response.status,
        status,
        `${method} ${path}: ${JSON.stringify(data)}`,
      );
      return data;
    }
    await t.test(
      "Creation catalog and base preview are authenticated, strict and read-only",
      async () => {
        const input = {
          classKey: "wizard",
          method: "standard",
          baseScores: {
            strength: 8,
            dexterity: 13,
            constitution: 14,
            intelligence: 15,
            wisdom: 12,
            charisma: 10,
          },
        };
        await request(null, "GET", "/catalog/creation", undefined, 401);
        await request("invalid", "GET", "/catalog/creation", undefined, 401);
        await request(null, "POST", "/catalog/creation/preview", input, 401);
        const data = await request("player", "GET", "/catalog/creation");
        assert.equal(data.classes.length, 12);
        assert.equal(data.ruleset, "srd-2024");
        const before = await db.character.count();
        const result = await request(
          "player",
          "POST",
          "/catalog/creation/preview",
          input,
        );
        assert.deepEqual(result.baseScores, input.baseScores);
        assert.equal(result.recommendedScores.intelligence, 15);
        assert.equal(result.scope, "base-abilities");
        await request(
          "player",
          "POST",
          "/catalog/creation/preview",
          { ...input, method: "manual" },
          400,
        );
        await request(
          "player",
          "POST",
          "/catalog/creation/preview",
          { ...input, level: 2 },
          400,
        );
        await request(
          "player",
          "POST",
          "/catalog/creation/preview",
          { ...input, baseScores: { ...input.baseScores, intelligence: 14 } },
          422,
        );
        await request(
          "player",
          "POST",
          "/catalog/creation/preview",
          { ...input, method: "rolled" },
          422,
        );
        assert.equal(await db.character.count(), before);
        const species = await request("player", "GET", "/catalog/species");
        for (const item of species.results) {
          assert.equal(
            item.description,
            item.traits.map((t) => `${t.name}: ${t.description}`).join("\n\n"),
          );
          assert.ok(item.size);
          assert.ok(item.speed);
        }
      },
    );
    let campaign, mission, encounter, character;
    await t.test(
      "Reject missing/invalid tokens; metadata cannot grant global DM permissions",
      async () => {
        await request(null, "GET", "/campaigns", undefined, 401);
        await request("invalid", "GET", "/campaigns", undefined, 401);
        for (const who of Object.keys(identities)) {
          const me = await request(who, "GET", "/auth/me");
          assert.equal(me.id, identities[who].id);
          assert.equal(me.role, "player");
          assert.equal(me.password, undefined);
        }
        await request("dm", "POST", "/auth/login", {}, 404);
      },
    );
    await t.test(
      "Create campaign, add participant, deny other owners and unrelated users",
      async () => {
        campaign = await request(
          "dm",
          "POST",
          "/campaigns",
          { name: "Barovia" },
          201,
        );
        await request(
          "otherDm",
          "POST",
          "/campaigns",
          { name: "Another campaign" },
          201,
        );
        await request(
          "dm",
          "POST",
          `/campaigns/${campaign.id}/players`,
          { playerId: identities.player.id },
          201,
        );
        await request(
          "dm",
          "POST",
          `/campaigns/${campaign.id}/players`,
          { playerId: identities.player.id },
          409,
        );
        assert.equal((await request("player", "GET", "/campaigns")).length, 1);
        assert.equal(
          (await request("outsider", "GET", "/campaigns")).length,
          0,
        );
        await request(
          "otherDm",
          "GET",
          `/campaigns/${campaign.id}`,
          undefined,
          404,
        );
        await request(
          "otherDm",
          "PUT",
          `/campaigns/${campaign.id}`,
          { name: "stolen" },
          404,
        );
        await request(
          "otherDm",
          "POST",
          `/campaigns/${campaign.id}/players`,
          { playerId: identities.outsider.id },
          404,
        );
        await request(
          "player",
          "DELETE",
          `/campaigns/${campaign.id}`,
          undefined,
          404,
        );
        await request("dm", "GET", "/campaigns/not-a-uuid", undefined, 400);
      },
    );
    await t.test(
      "Mission DTO consistency, assignment, persisted acceptance, completion",
      async () => {
        mission = await request(
          "dm",
          "POST",
          "/missions",
          {
            campaignId: campaign.id,
            title: "Find the tome",
            rewardXp: 200,
            rewardGold: 50,
          },
          201,
        );
        assert.equal(mission.title, "Find the tome");
        assert.equal(mission.titulo, undefined);
        await request("dm", "PUT", `/missions/${mission.id}`, {
          title: "Find the lost tome",
        });
        const loaded = await request(
          "player",
          "GET",
          `/missions/${mission.id}`,
        );
        assert.equal(loaded.title, "Find the lost tome");
        assert.equal(loaded.rewardXp, 200);
        assert.deepEqual(await request("outsider", "GET", "/missions"), []);
        await request(
          "outsider",
          "GET",
          `/missions/${mission.id}`,
          undefined,
          404,
        );
        await request(
          "otherDm",
          "POST",
          `/missions/${mission.id}/complete`,
          undefined,
          404,
        );
        await request(
          "otherDm",
          "PUT",
          `/missions/${mission.id}`,
          { title: "stolen" },
          404,
        );
        await request(
          "dm",
          "POST",
          `/missions/${mission.id}/assign`,
          { playerId: identities.outsider.id },
          400,
        );
        await request(
          "player",
          "POST",
          `/missions/${mission.id}/accept`,
          undefined,
          403,
        );
        await request("dm", "POST", `/missions/${mission.id}/assign`, {
          playerId: identities.player.id,
        });
        const accepted = await request(
          "player",
          "POST",
          `/missions/${mission.id}/accept`,
        );
        assert.deepEqual(accepted.acceptedBy, [identities.player.id]);
        assert.equal(accepted.status, "active");
        await request("player", "POST", `/missions/${mission.id}/accept`);
        assert.equal(await db.missionAssignment.count(), 1);
        await request(
          "player",
          "POST",
          `/missions/${mission.id}/complete`,
          undefined,
          404,
        );
        assert.equal(
          (await request("dm", "POST", `/missions/${mission.id}/complete`))
            .status,
          "completed",
        );
        await request(
          "player",
          "POST",
          `/missions/${mission.id}/accept`,
          undefined,
          409,
        );
        await request(
          "dm",
          "POST",
          "/missions",
          { campaignId: campaign.id, title: "bad", rewardXp: -1 },
          400,
        );
      },
    );
    await t.test("Encounter lifecycle and campaign ownership", async () => {
      encounter = await request(
        "dm",
        "POST",
        "/encounters",
        {
          campaignId: campaign.id,
          name: "Goblins",
          monsters: [
            {
              slug: "goblin",
              nombre: "Goblin",
              cantidad: 1,
              hp_max: 7,
              hp_actual: [7],
              ca: 15,
              cr: "1/4",
              xp_unidad: 50,
            },
          ],
        },
        201,
      );
      for (const who of ["player", "otherDm", "outsider"])
        await request(
          who,
          "POST",
          `/encounters/${encounter.id}/start`,
          undefined,
          404,
        );
      assert.deepEqual(await request("outsider", "GET", "/encounters"), []);
      const started = await request(
        "dm",
        "POST",
        `/encounters/${encounter.id}/start`,
      );
      assert.equal(started.round, 1);
      assert.equal(started.initiativeOrder.length, 1);
      await request(
        "dm",
        "POST",
        `/encounters/${encounter.id}/start`,
        undefined,
        409,
      );
      assert.equal(
        (await request("dm", "POST", `/encounters/${encounter.id}/nextround`))
          .round,
        2,
      );
      assert.equal(
        (await request("dm", "POST", `/encounters/${encounter.id}/end`)).status,
        "completed",
      );
    });
    await t.test(
      "Characters persist by owner; directory is scoped and account deletion disabled",
      async () => {
        character = await request(
          "player",
          "POST",
          "/characters",
          {
            name: "Arannis",
            race: "Elf",
            characterClass: "Wizard",
            campaignId: campaign.id,
          },
          201,
        );
        assert.equal(
          (await request("player", "GET", "/characters"))[0].id,
          character.id,
        );
        assert.deepEqual(await request("outsider", "GET", "/characters"), []);
        await request(
          "dm",
          "PUT",
          `/characters/${character.id}`,
          { name: "stolen" },
          404,
        );
        await request(
          "outsider",
          "POST",
          "/characters",
          {
            name: "X",
            race: "Elf",
            characterClass: "Wizard",
            campaignId: campaign.id,
          },
          404,
        );
        const directory = await request("dm", "GET", "/users");
        assert.equal(directory.length, 2);
        assert.ok(directory.every((u) => !u.email));
        const found = await request(
          "dm",
          "GET",
          "/users/players?email=player%40example.com",
        );
        assert.equal(found[0].id, identities.player.id);
        await request(
          "dm",
          "DELETE",
          `/users/${identities.player.id}`,
          undefined,
          404,
        );
      },
    );
    await t.test(
      "Android catalog -> create -> list -> sheet for all twelve Spanish class labels",
      async () => {
        await request(null, "GET", "/ready");
        const catalog = await request("player", "GET", "/catalog/species");
        assert.equal(catalog.document, "srd-2024");
        assert.ok(catalog.results.length > 0);
        const labels = [
          "Bárbaro",
          "Bardo",
          "Clérigo",
          "Druida",
          "Guerrero",
          "Mago",
          "Monje",
          "Paladín",
          "Explorador",
          "Pícaro",
          "Hechicero",
          "Brujo",
        ];
        for (const label of labels) {
          const created = await request(
            "player",
            "POST",
            "/characters",
            {
              name: "Prueba " + label,
              race: catalog.results[0].name,
              characterClass: label,
              level: 5,
              alignment: "Caótico Neutral",
              strength: 9,
              dexterity: 10,
              constitution: 12,
              intelligence: 15,
              wisdom: 10,
              charisma: 14,
            },
            201,
          );
          const sheet = await request(
            "player",
            "GET",
            `/characters/${created.id}/sheet`,
          );
          assert.equal(sheet.characterId, created.id);
          assert.equal(sheet.state.classes.length, 1);
          assert.equal(sheet.state.configured, false);
          assert.ok(
            (await request("player", "GET", "/characters")).some(
              (c) => c.id === created.id,
            ),
          );
          await request("player", "DELETE", `/characters/${created.id}`);
        }
        const invalid = await request(
          "player",
          "POST",
          "/characters",
          {
            name: "",
            race: catalog.results[0].name,
            characterClass: "Mago",
          },
          400,
        );
        assert.ok(invalid.details.some((d) => d.path === "name"));
      },
    );
    await t.test(
      "Pending gameplay migration reports a schema error for readiness, list and create",
      async () => {
        await pg.exec(
          "ALTER TABLE app.personajes RENAME COLUMN version_estado TO version_estado_test_missing",
        );
        try {
          for (const [method, path, body] of [
            ["GET", "/ready"],
            ["GET", "/characters"],
            [
              "POST",
              "/characters",
              { name: "Blocked", race: "Elf", characterClass: "Mago" },
            ],
          ]) {
            await db.$disconnect();
            const error = await request("player", method, path, body, 503);
            assert.equal(error.code, "DATABASE_SCHEMA_OUTDATED");
          }
        } finally {
          await db.$disconnect();
          await pg.exec(
            "ALTER TABLE app.personajes RENAME COLUMN version_estado_test_missing TO version_estado",
          );
        }
        await request(null, "GET", "/ready");
      },
    );
    await t.test(
      "Character commands: ownership, idempotency, stale revision and preserved inventory",
      async () => {
        const fresh = await request(
          "player",
          "GET",
          `/characters/${character.id}/sheet`,
        );
        assert.equal(fresh.state.configured, false);
        await request(
          "outsider",
          "GET",
          `/characters/${character.id}/sheet`,
          undefined,
          404,
        );
        await request("dm", "GET", `/characters/${character.id}/sheet`);
        const config = {
          classes: [{ key: "wizard", level: character.level }],
          hp: { current: 12, max: 12, temp: 0 },
          xp: 0,
          speed: 30,
          armor: { base: 10, dexterity: true, dexCap: 99, shield: 0, bonus: 0 },
          skills: { arcana: 1 },
          saveProficiencies: ["intelligence", "wisdom"],
          resources: [],
          features: [],
        };
        const envelope = {
          commandId: randomUUID(),
          expectedVersion: fresh.stateVersion,
          type: "configure",
          data: config,
        };
        const first = await request(
          "player",
          "POST",
          `/characters/${character.id}/commands`,
          envelope,
        );
        assert.deepEqual(
          await request(
            "player",
            "POST",
            `/characters/${character.id}/commands`,
            envelope,
          ),
          first,
        );
        assert.equal(await db.characterCommand.count(), 1);
        await request(
          "player",
          "POST",
          `/characters/${character.id}/commands`,
          { ...envelope, data: { ...config, xp: 50 } },
          409,
        );
        await request(
          "player",
          "POST",
          `/characters/${character.id}/commands`,
          { ...envelope, commandId: randomUUID() },
          409,
        );
        await request(
          "dm",
          "POST",
          `/characters/${character.id}/commands`,
          envelope,
          404,
        );
        const concurrent = await Promise.all(
          [1, 2].map(() =>
            fetch(base + `/characters/${character.id}/commands`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer player",
              },
              body: JSON.stringify({
                commandId: randomUUID(),
                expectedVersion: first.sheet.stateVersion,
                type: "hp",
                data: { mode: "damage", amount: 1 },
              }),
            }),
          ),
        );
        assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
        first.sheet = await request(
          "player",
          "GET",
          `/characters/${character.id}/sheet`,
        );
        assert.equal(first.sheet.state.hp.current, 11);
        const item = {
          id: randomUUID(),
          name: "Rope",
          type: "gear",
          quantity: 1,
          equipped: false,
        };
        const inventory = await request(
          "player",
          "POST",
          `/characters/${character.id}/commands`,
          {
            commandId: randomUUID(),
            expectedVersion: first.sheet.stateVersion,
            type: "inventory",
            data: { operation: "upsert", item },
          },
        );
        await request("player", "PUT", `/characters/${character.id}`, {
          intelligence: 16,
        });
        const revised = await request(
          "player",
          "GET",
          `/characters/${character.id}/sheet`,
        );
        assert.equal(revised.state.inventory[0].name, "Rope");
        assert.equal(revised.state.configured, false);
        assert.equal(revised.stateVersion, inventory.sheet.stateVersion + 1);
        const history = await request(
          "player",
          "GET",
          `/characters/${character.id}/commands`,
        );
        assert.equal(history.length, 3);
        assert.equal(history[0].result.sheet, undefined);
      },
    );
    await t.test(
      "Notes preserve strokes, isolate owners and reject stale edits",
      async () => {
        const sectionId = randomUUID(),
          noteId = randomUUID();
        await request("player", "PUT", `/notebooks/sections/${sectionId}`, {
          name: "Barovia",
          order: 0,
        });
        const note = {
          title: "Mapa",
          sectionId,
          text: "Entrada norte",
          strokes: [
            {
              color: "#DBB56B",
              width: 3,
              points: [
                { x: 0.2, y: 0.3 },
                { x: 0.8, y: 0.9 },
              ],
            },
          ],
        };
        const n = await request("player", "PUT", `/notebooks/notes/${noteId}`, {
          expectedVersion: -1,
          note,
        });
        assert.equal(n.version, 0);
        assert.deepEqual(n.strokes, note.strokes);
        assert.deepEqual(
          await request("player", "PUT", `/notebooks/notes/${noteId}`, {
            expectedVersion: -1,
            note,
          }),
          n,
        );
        await request(
          "outsider",
          "PUT",
          `/notebooks/sections/${sectionId}`,
          { name: "Stolen", order: 0 },
          404,
        );
        await request(
          "outsider",
          "PUT",
          `/notebooks/notes/${noteId}`,
          { expectedVersion: 0, note },
          404,
        );
        assert.equal(
          (await request("outsider", "GET", "/notebooks")).notes.length,
          0,
        );
        const update = {
          expectedVersion: 0,
          note: { ...note, text: "Entrada sur" },
        };
        const next = await request(
          "player",
          "PUT",
          `/notebooks/notes/${noteId}`,
          update,
        );
        assert.equal(next.version, 1);
        await request(
          "player",
          "PUT",
          `/notebooks/notes/${noteId}`,
          { expectedVersion: 0, note },
          409,
        );
        await request(
          "player",
          "DELETE",
          `/notebooks/notes/${noteId}?version=0`,
          undefined,
          409,
        );
        await request(
          "player",
          "DELETE",
          `/notebooks/sections/${sectionId}`,
          undefined,
          409,
        );
        await request(
          "player",
          "DELETE",
          `/notebooks/notes/${noteId}?version=1`,
        );
        await request("player", "DELETE", `/notebooks/sections/${sectionId}`);
      },
    );
    await t.test(
      "Removing a participant revokes access and cleans assignments atomically",
      async () => {
        await request(
          "dm",
          "DELETE",
          `/campaigns/${campaign.id}/players/${identities.player.id}`,
        );
        assert.deepEqual(await request("player", "GET", "/missions"), []);
        assert.equal(await db.missionAssignment.count(), 0);
        assert.equal(
          (await db.character.findUnique({ where: { id: character.id } }))
            .campaignId,
          null,
        );
      },
    );
    await t.test(
      "Database FK/check constraints and Data API denial",
      async () => {
        await assert.rejects(
          db.user.create({
            data: {
              id: randomUUID(),
              email: "invalid@example.com",
              username: "invalid",
            },
          }),
        );
        await assert.rejects(
          db.mission.update({
            where: { id: mission.id },
            data: { rewardXp: -1 },
          }),
        );
        const rls = await pg.query(
          "SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'",
        );
        assert.equal(rls.rows.length, 10);
        assert.ok(rls.rows.every((r) => r.relrowsecurity));
        const privileges = await pg.query(
          "SELECT has_schema_privilege('anon','app','USAGE') a, has_schema_privilege('authenticated','app','USAGE') b",
        );
        assert.equal(privileges.rows[0].a, false);
        assert.equal(privileges.rows[0].b, false);
      },
    );
  },
);
