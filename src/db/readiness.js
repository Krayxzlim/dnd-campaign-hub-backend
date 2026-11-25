// Read-only checks use the generated client and the columns needed by the app.
async function checkDatabase(db) {
  await db.user.findFirst({ select: { id: true, email: true, username: true } });
  await db.character.findFirst();
  await db.characterCommand.findFirst({ select: { id: true } });
  await db.noteSection.findFirst({ select: { id: true } });
  await db.note.findFirst({ select: { id: true } });
}
function databaseError(err) {
  if (["P2021", "P2022"].includes(err.code)) return {
    code: "DATABASE_SCHEMA_OUTDATED",
    error: "La base de datos necesita una actualización del servidor. No se pudo completar la operación.",
  };
  if (err.name === "PrismaClientValidationError") return {
    code: "DATABASE_CLIENT_MISMATCH",
    error: "El servidor necesita actualizar su cliente de base de datos.",
  };
  if (["P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1017", "P2024"].includes(err.code)) return {
    code: "DATABASE_UNAVAILABLE",
    error: "El servidor no puede acceder a la base de datos. Intentá nuevamente más tarde.",
  };
  return null;
}
module.exports = { checkDatabase, databaseError };
