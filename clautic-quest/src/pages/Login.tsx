import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/lib/session';
import { homeFor } from '@/lib/home';
import { Logo } from '@/components/Shells';
import { HouseView } from '@/components/House';

const DEMO = [
  { user: 'admin@clautic.cat', label: 'Administració', icon: '⚙️' },
  { user: 'anna@clautic.cat', label: 'Professora (R1–R4, V1)', icon: '🧑‍🏫' },
  { user: 'nil', label: 'Alumne (Nil)', icon: '🧑‍🚀' },
  { user: 'laia', label: 'Alumna nova (Laia)', icon: '👩‍🚀' },
  { user: 'familia@clautic.cat', label: 'Família Puig', icon: '👨‍👩‍👧' },
];

export default function Login() {
  const { signIn, session, ctx } = useSession();
  const nav = useNavigate();
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (session && ctx) nav(homeFor(ctx.roles), { replace: true }); }, [session, ctx, nav]);

  async function submit(e?: FormEvent, u = user, p = pw) {
    e?.preventDefault();
    setBusy(true); setErr(null);
    try { await signIn(u, p); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-violet/30 via-night-900 to-brand/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo />
          <div className="mx-auto w-full max-w-lg">
            <div className="grid grid-cols-2 gap-2">
              <HouseView className="animate-bob" cfg={{ model: 'cupula', wall_color: '#F5F3FF', accent_color: '#8B5CF6', slots: { jardi: 'arbre_tec', robot: 'robot_huma', holograma: 'holo_planeta', llum: 'led_violeta', energia: 'nucli_mini' } }} />
              <HouseView className="animate-bob [animation-delay:1s]" cfg={{ model: 'torre', wall_color: '#E8F1FF', accent_color: '#22D3EE', slots: { teulada: 'turbina', dron: 'dron_llum', llum: 'led_cian', jardi: 'flors_holo', robot: 'robot_gos', porta: 'porta_lliscant' } }} />
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight">Construeix la teva casa a <span className="text-cian">ClauTIC City</span></h1>
            <p className="mt-3 max-w-md text-ice/70">Cada esforç, cada idea i cada vegada que ajudes un company fan créixer la teva casa i tota la ciutat.</p>
          </div>
          <p className="text-xs text-ice/40">Acadèmia ClauTIC · Robòtica · Videojocs · Minecraft Education</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="font-display text-3xl font-bold">Hola de nou! 👋</h2>
          <p className="mt-1 text-sm text-ice/60">Entra amb el teu usuari. Els alumnes només cal que escriguin el seu nom d’usuari.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">Usuari o correu</span>
              <input className="input py-3 text-base" autoComplete="username" autoCapitalize="none" value={user} onChange={(e) => setUser(e.target.value)} placeholder="nil o nom@correu.cat" required />
            </label>
            <label className="block">
              <span className="label">Contrasenya</span>
              <input className="input py-3 text-base" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            </label>
            {err && <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand-soft" role="alert">{err}</p>}
            <button className="btn-primary w-full py-3 text-base" disabled={busy}>{busy ? 'Entrant…' : 'Entra'}</button>
          </form>
          <p className="mt-4 text-center text-sm text-ice/60">Tens un codi d’invitació? <Link to="/activar" className="font-semibold text-cian hover:underline">Activa el teu compte</Link></p>

          <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ice/40">Comptes de demostració · contrasenya <code className="text-cian">clautic2026</code></p>
            <div className="grid gap-1.5">
              {DEMO.map((d) => (
                <button key={d.user} disabled={busy} onClick={() => { setUser(d.user); setPw('clautic2026'); submit(undefined, d.user, 'clautic2026'); }}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10">
                  <span>{d.icon}</span><span className="font-medium">{d.label}</span><span className="ml-auto text-xs text-ice/40">{d.user}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
