const { fail } = require("../lib/http");
// Supabase validates the token remotely. Never trust client-supplied roles or decoded-only JWTs.
function createAuthMiddleware(db, supabase) {
  return (req, res, next) =>
    Promise.resolve()
      .then(async () => {
        const match = /^Bearer ([^\s]+)$/i.exec(req.get("authorization") || "");
        if (!match) fail(401, "Token Bearer requerido");
        const { data, error } = await supabase.auth.getUser(match[1]);
        if (error || !data?.user || data.user.is_anonymous || !data.user.email)
          fail(401, "Sesión inválida o expirada");
        const identity = data.user;
        const rawName = identity.user_metadata?.username;
        const username =
          typeof rawName === "string" && rawName.trim()
            ? rawName.trim().slice(0, 80)
            : identity.email.split("@")[0];
        req.user = await db.user.upsert({
          where: { id: identity.id },
          create: { id: identity.id, email: identity.email, username },
          update: { email: identity.email },
        });
        next();
      })
      .catch(next);
}
module.exports = { authMiddleware: createAuthMiddleware };
