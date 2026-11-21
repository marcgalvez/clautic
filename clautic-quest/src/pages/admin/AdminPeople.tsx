import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate } from '@/lib/format';
import { LINES, type Role } from '@/lib/types';
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import type { AGroup, AStudent } from './AdminStudents';

interface Person { id: string; full_name: string; email: string; created_at: string; groups?: { id: string; code: string }[]; children?: { id: string; name: string; consent_family: boolean }[] }

export default function AdminPeople({ role }: { role: Extract<Role, 'teacher' | 'family'> }) {
  const toast = useToast();
  const isT = role === 'teacher';
  const { data, error, loading, reload } = useRpc<Person[]>('admin_people', { p_role: role }, [role]);
  const groupsQ = useRpc<AGroup[]>(isT ? 'admin_groups' : null);
  const studentsQ = useRpc<AStudent[]>(isT ? null : 'admin_students');
  const groups = useMemo(() => (groupsQ.data ?? []).filter((g) => g.is_current), [groupsQ.data]);
  const [links, setLinks] = useState<{ person: Person | null; ids: string[]; name: string } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [q, setQ] = useState('');

  async function submit() {
    if (!links) return;
    try {
      if (links.person) {
        await rpc(isT ? 'admin_set_teacher_groups' : 'admin_set_family_students', isT ? { p_teacher: links.person.id, p_group_ids: links.ids } : { p_family: links.person.id, p_student_ids: links.ids });
        toast({ kind: 'ok', text: 'Vinculació desada' }); setLinks(null);
      } else {
        if (!links.name.trim()) return toast({ kind: 'error', text: 'Cal un nom' });
        const r = await rpc<{ code: string }>('admin_create_invitation', { p_role: role, p_full_name: links.name, p_student_ids: isT ? [] : links.ids, p_group_ids: isT ? links.ids : [] });
        setCode(r.code); setLinks(null);
      }
      reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  const options = isT
    ? groups.map((g) => ({ id: g.id, label: g.code, sub: g.name, color: LINES[g.line].color }))
    : (studentsQ.data ?? []).filter((s) => s.active).map((s) => ({ id: s.id, label: `${s.first_name} ${s.last_name}`, sub: s.groups.join(', '), color: '#8B5CF6' }));
  const filtered = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <PageHeader title={isT ? 'Professorat' : 'Famílies'} icon={isT ? '🧑‍🏫' : '👨‍👩‍👧'}
        subtitle={isT ? 'Cada professor només pot gestionar els grups assignats.' : 'Una família pot tenir diversos fills vinculats i només veu les seves dades.'}
        actions={<button className="btn-primary" onClick={() => setLinks({ person: null, ids: [], name: '' })}>+ Convida {isT ? 'un professor' : 'una família'}</button>} />
      <Card>
        {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
          <table className="table-clean">
            <thead><tr><th>Nom</th><th className="hidden md:table-cell">Correu</th><th>{isT ? 'Grups' : 'Fills vinculats'}</th><th className="hidden md:table-cell">Alta</th><th /></tr></thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.full_name}</td>
                  <td className="hidden text-ice/60 md:table-cell">{p.email}</td>
                  <td><div className="flex flex-wrap gap-1">
                    {isT ? p.groups?.map((g) => <span key={g.id} className="chip bg-white/10">{g.code}</span>)
                      : p.children?.map((c) => <span key={c.id} className="chip bg-violet/20 text-violet-soft">{c.name}{!c.consent_family && <span title="Falta l’autorització familiar signada"> ⚠️</span>}</span>)}
                  </div></td>
                  <td className="hidden text-xs text-ice/50 md:table-cell">{fmtDate(p.created_at, true)}</td>
                  <td className="text-right"><button className="rounded-lg px-2 py-1 text-sm text-cian hover:bg-white/10" onClick={() => setLinks({ person: p, ids: isT ? (p.groups ?? []).map((g) => g.id) : (p.children ?? []).map((c) => c.id), name: p.full_name })}>Vincula</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!links} onClose={() => setLinks(null)} title={links?.person ? `Vinculació · ${links.person.full_name}` : `Nova invitació`} wide
        footer={<><button className="btn-ghost" onClick={() => setLinks(null)}>Cancel·la</button><button className="btn-primary" onClick={submit}>{links?.person ? 'Desa' : 'Genera el codi'}</button></>}>
        {links && (
          <div className="space-y-3">
            {!links.person && <Field label="Nom"><input className="input" value={links.name} onChange={(e) => setLinks({ ...links, name: e.target.value })} placeholder={isT ? 'Nom i cognoms' : 'Família Serra'} /></Field>}
            <Field label={isT ? 'Grups assignats' : 'Fills'}>
              {!isT && <input className="input mb-2" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />}
              <div className="grid max-h-72 gap-1.5 overflow-auto sm:grid-cols-2 md:grid-cols-3">
                {filtered.map((o) => {
                  const on = links.ids.includes(o.id);
                  return (
                    <button key={o.id} type="button" onClick={() => setLinks({ ...links, ids: on ? links.ids.filter((x) => x !== o.id) : [...links.ids, o.id] })}
                      className={`rounded-lg px-3 py-2 text-left text-sm ${on ? 'ring-2' : 'bg-white/5 hover:bg-white/10'}`} style={on ? { background: `${o.color}33`, ['--tw-ring-color' as string]: o.color } : undefined}>
                      <span className="font-semibold">{o.label}</span><span className="block text-xs text-ice/50">{o.sub}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}
      </Modal>
      <Modal open={!!code} onClose={() => setCode(null)} title="Invitació creada" footer={<button className="btn-primary" onClick={() => setCode(null)}>Fet</button>}>
        <p className="text-sm text-ice/70">Comparteix aquest codi. S’activa a <code>{window.location.origin}/activar</code>.</p>
        <p className="mt-3 text-center font-display text-4xl font-bold tracking-widest text-cian">{code}</p>
      </Modal>
    </div>
  );
}
