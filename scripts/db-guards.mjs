// Tamper-evidence guards (MySQL / MariaDB): the audit trail and signatures are
// append-only and executed document text is frozen. Idempotent — safe to run
// on every deploy. Usage: `node scripts/db-guards.mjs` (uses DATABASE_URL).
//
// The hash-chained audit trail detects tampering even without these triggers;
// the triggers stop it from happening through the database in the first place.
import { pathToFileURL } from "node:url";

export const GUARDS = [
  ["AuditEvent_no_update", "BEFORE UPDATE ON `AuditEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only'"],
  ["AuditEvent_no_delete", "BEFORE DELETE ON `AuditEvent` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AuditEvent is append-only'"],
  ["Signature_no_update", "BEFORE UPDATE ON `Signature` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Signature is append-only'"],
  ["Signature_no_delete", "BEFORE DELETE ON `Signature` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Signature is append-only'"],
  [
    "Document_freeze_content",
    "BEFORE UPDATE ON `Document` FOR EACH ROW BEGIN IF NOT (NEW.`content` <=> OLD.`content`) OR NOT (NEW.`contentHash` <=> OLD.`contentHash`) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Document content is immutable'; END IF; END",
  ],
];

/** Creates (or re-creates) every guard trigger. Returns the names applied. */
export async function applyGuards(db) {
  const applied = [];
  for (const [name, body] of GUARDS) {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS \`${name}\``);
    await db.$executeRawUnsafe(`CREATE TRIGGER \`${name}\` ${body}`);
    applied.push(name);
  }
  return applied;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const applied = await applyGuards(db);
    console.log(`Tamper-evidence triggers applied: ${applied.join(", ")}`);
  } finally {
    await db.$disconnect();
  }
}
