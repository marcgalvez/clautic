// Crea (o promociona) el superadministrador de la plataforma.
// Ús: npm run superadmin -- correu@domini.com "Nom" 'contrasenya-llarga'
import "dotenv/config";
import { db } from "../src/lib/db";
import { hashPassword, PASSWORD_MIN } from "../src/lib/auth/password";

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < PASSWORD_MIN) {
    console.error(`Ús: npm run superadmin -- <correu> <nom> <contrasenya (≥${PASSWORD_MIN})>`);
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  const u = await db.user.upsert({ where: { email: email.toLowerCase() }, create: { email: email.toLowerCase(), name, passwordHash, isSuperAdmin: true }, update: { isSuperAdmin: true, passwordHash } });
  console.log(`Superadministrador llest: ${u.email}`);
}
main().finally(() => db.$disconnect());
