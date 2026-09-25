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
        assert.equal(rls.rows.length, 7);
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
