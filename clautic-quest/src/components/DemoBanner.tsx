import { useEffect, useState } from 'react';

/** Avís del mode demostració: pantalla de càrrega inicial i botó per reiniciar les dades. */
export function DemoBanner() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    import('@/lib/demo/backend').then((b) => {
      off = b.onDemoStatus(setStatus);
      b.getDb().catch((e) => setStatus(`Error: ${(e as Error).message}`));
    });
    return () => off?.();
  }, []);

  return (
    <>
      {status && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-night-900/95 p-6 text-center backdrop-blur">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-cian/30 border-t-cian" />
          <p className="font-display text-xl font-bold">{status}</p>
          <p className="max-w-sm text-sm text-ice/60">La base de dades de la demo funciona dins del teu navegador. El primer cop triga uns segons.</p>
        </div>
      )}
      <div className="fixed bottom-20 left-3 z-[90] md:bottom-3 print:hidden">
        {open ? (
          <div className="glass-strong w-72 p-4 text-sm shadow-2xl">
            <p className="font-display font-semibold">🧪 Mode demostració</p>
            <p className="mt-1 text-ice/70">Totes les dades són fictícies i es guarden <strong>només en aquest navegador</strong>. Pots provar tots els rols i fer qualsevol canvi.</p>
            <p className="mt-2 text-ice/60">Contrasenya de tots els comptes: <code className="text-cian">clautic2026</code></p>
            <div className="mt-3 flex gap-2">
              <button className="btn-danger py-1.5 text-xs" onClick={async () => {
                if (!confirm('Vols tornar la demo a l’estat inicial? Es perdran els canvis fets en aquest navegador.')) return;
                setStatus('Reiniciant la demo…');
                (await import('@/lib/demo/backend')).resetDemo();
              }}>↺ Reinicia la demo</button>
              <button className="btn-ghost py-1.5 text-xs" onClick={() => setOpen(false)}>Tanca</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-night-900 shadow-lg hover:brightness-110">🧪 DEMO</button>
        )}
      </div>
    </>
  );
}
