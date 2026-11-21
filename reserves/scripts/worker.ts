// Treballador persistent: executa la cua de recordatoris i sincronització cada 30 s.
// Ús: npm run worker  (en producció, com a procés separat: systemd, Docker, Railway, Fly…)
import "dotenv/config";
import { tick } from "../src/lib/jobs/tick";
import { db } from "../src/lib/db";

const INTERVAL = Number(process.env.WORKER_INTERVAL_MS ?? 30_000);
let stopping = false;

async function loop() {
  while (!stopping) {
    const started = Date.now();
    try {
      const r = await tick();
      if (r.reminders.claimed || r.sync.done || r.sync.failed || r.hourly) console.log(new Date().toISOString(), JSON.stringify(r));
    } catch (e) {
      console.error("tick error", e);
    }
    await new Promise((r) => setTimeout(r, Math.max(1000, INTERVAL - (Date.now() - started))));
  }
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => (stopping = true));
console.log(`Worker en marxa (cada ${INTERVAL / 1000}s)`);
loop();
