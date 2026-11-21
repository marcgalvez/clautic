import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, toLoginEmail } from '@/lib/supabase';
import { friendlyError, rpc } from '@/lib/api';
import { ROLE_LABEL, type Role } from '@/lib/types';
import { Logo } from '@/components/Shells';

type Inv = { valid: boolean; role?: Role; name?: string; suggested_username?: string };

export default function Activate() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [code, setCode] = useState(params.get('codi') ?? '');
  const [inv, setInv] = useState<Inv | null>(null);
  const [user, setUser] = useState('');
  const [name, setName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function check(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await rpc<Inv>('check_invitation', { p_code: code });
      if (!r.valid) setErr('Aquest codi no és vàlid o ja s’ha fet servir.');
      else { setInv(r); setUser(r.suggested_username ?? ''); setName(r.name ?? ''); }
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setErr('La contrasenya ha de tenir almenys 6 caràcters.');
    if (pw !== pw2) return setErr('Les contrasenyes no coincideixen.');
    if (inv?.role === 'family' && !consent) return setErr('Cal acceptar la política de privacitat.');
    setBusy(true); setErr(null);
    const email = inv?.role === 'student' ? toLoginEmail(user.replace(/[^a-z0-9.]/gi, '').toLowerCase()) : user.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email, password: pw,
      options: { data: { invite_code: code.trim().toUpperCase(), full_name: name }, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setErr(friendlyError(error));
    if (data.session) nav('/', { replace: true });
    else setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-md p-6 md:p-8">
        <Logo />
        <h1 className="mt-6 font-display text-2xl font-bold">Activa el teu compte</h1>
        {done ? (
          <div className="mt-4 space-y-3 text-sm text-ice/80">
            <p>✅ Compte creat! Revisa el teu correu per confirmar-lo i després entra.</p>
            <Link className="btn-primary" to="/entrar">Anar a l’inici de sessió</Link>
          </div>
        ) : !inv ? (
          <form onSubmit={check} className="mt-4 space-y-4">
            <p className="text-sm text-ice/60">Escriu el codi que t’ha donat l’acadèmia (per exemple <code className="text-cian">CQ-7K2P9X</code>).</p>
            <input className="input py-3 text-center font-display text-xl uppercase tracking-[.3em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CQ-XXXXXX" required autoFocus />
            {err && <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand-soft" role="alert">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>Comprova el codi</button>
          </form>
        ) : (
          <form onSubmit={create} className="mt-4 space-y-4">
            <div className="rounded-xl bg-cian/10 p-3 text-sm ring-1 ring-cian/30">
              Invitació de <strong>{ROLE_LABEL[inv.role!]}</strong>{inv.name ? <> per a <strong>{inv.name}</strong></> : null}
            </div>
            {inv.role === 'student' ? (
              <label className="block">
                <span className="label">Tria el teu nom d’usuari</span>
                <input className="input py-3 text-base" value={user} onChange={(e) => setUser(e.target.value.toLowerCase())} required pattern="[a-z0-9.]{3,30}" title="Lletres, números i punts (3-30)" />
                <span className="mt-1 block text-xs text-ice/40">Amb això entraràs a l’app. Sense espais ni accents.</span>
              </label>
            ) : (
              <>
                <label className="block"><span className="label">Nom i cognoms</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
                <label className="block"><span className="label">Correu electrònic</span><input className="input" type="email" value={user} onChange={(e) => setUser(e.target.value)} required /></label>
              </>
            )}
            <label className="block"><span className="label">Contrasenya</span><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" /></label>
            <label className="block"><span className="label">Repeteix la contrasenya</span><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" /></label>
            {inv.role === 'family' && (
              <label className="flex items-start gap-2 text-xs text-ice/70">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span>He llegit la política de privacitat. Entenc que ClauTIC Quest tracta dades dels meus fills amb finalitat educativa, que no es mostren dades personals a altres alumnes i que puc demanar-ne l’accés, la rectificació o la supressió a l’acadèmia.</span>
              </label>
            )}
            {err && <p className="rounded-lg bg-brand/15 px-3 py-2 text-sm text-brand-soft" role="alert">{err}</p>}
            <button className="btn-primary w-full py-3" disabled={busy}>{busy ? 'Creant…' : 'Crea el compte'}</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-ice/50"><Link to="/entrar" className="hover:underline">← Tornar a l’inici de sessió</Link></p>
      </div>
    </div>
  );
}
