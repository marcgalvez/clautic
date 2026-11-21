import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { LINES, type Line } from '@/lib/types';
import { Card, ErrorBox, Field, Modal, PageHeader, Spinner, Toggle } from '@/components/ui';
import type { AGroup, AStudent } from './AdminStudents';

const DAYS = ['', 'Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];

export default function AdminGroups() {
  const toast = useToast();
  const { data, error, loading, reload } = useRpc<AGroup[]>('admin_groups');
  const students = useRpc<AStudent[]>('admin_students');
  const [all, setAll] = useState(false);
  const [edit, setEdit] = useState<AGroup | null>(null);
  const [members, setMembers] = useState<{ g: AGroup; ids: string[] } | null>(null);
  const [q, setQ] = useState('');
  const list = useMemo(() => (data ?? []).filter((g) => all || g.is_current), [data, all]);

  async function toggle(g: AGroup) {
    try { await rpc('admin_save', { p_table: 'groups', p_row: { id: g.id, active: !g.active } }); reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }
  async function saveEdit() {
    if (!edit) return;
    try {
      await rpc('admin_save', { p_table: 'groups', p_row: { id: edit.id, name: edit.name, schedule: edit.schedule, weekday: edit.weekday, code: edit.code } });
      toast({ kind: 'ok', text: 'Grup desat' }); setEdit(null); reload(true);
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }
  async function saveMembers() {
    if (!members) return;
    try { await rpc('admin_set_group_students', { p_group: members.g.id, p_student_ids: members.ids }); toast({ kind: 'ok', text: 'Matrícules desades' }); setMembers(null); reload(true); students.reload(true); }
    catch (e) { toast({ kind: 'error', text: (e as Error).message }); }
  }

  const byLine = (l: Line) => list.filter((g) => g.line === l);
  return (
    <div className="space-y-5">
      <PageHeader title="Grups" icon="🧩" subtitle="Robòtica R1–R7 · Videojocs V1–V8 · Minecraft M1–M2. Activa o desactiva grups segons el curs."
        actions={<Toggle checked={all} onChange={setAll} label="Mostra cursos anteriors" />} />
      {loading && !data ? <Spinner /> : error ? <ErrorBox error={error} onRetry={() => reload()} /> : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(LINES) as Line[]).map((l) => (
            <Card key={l} title={<span style={{ color: LINES[l].color }}>{LINES[l].icon} {LINES[l].name}</span>}>
              <ul className="space-y-2">
                {byLine(l).map((g) => (
                  <li key={g.id} className={`rounded-xl bg-white/5 p-3 ${g.active ? '' : 'opacity-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold" style={{ color: LINES[l].color }}>{g.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                      {all && <span className="text-xs text-ice/40">{g.year}</span>}
                      <Toggle checked={g.active} onChange={() => toggle(g)} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-ice/50">
                      <span>👥 {g.student_ids.length} alumnes</span>
                      <span>🧑‍🏫 {g.teachers.map((t) => t.name).join(', ') || 'sense professor'}</span>
                      {g.schedule && <span>🕒 {g.schedule}</span>}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button className="btn-ghost py-1 text-xs" onClick={() => { setQ(''); setMembers({ g, ids: [...g.student_ids] }); }}>Alumnes</button>
                      <button className="btn-ghost py-1 text-xs" onClick={() => setEdit({ ...g })}>Edita</button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edita ${edit?.code}`}
        footer={<><button className="btn-ghost" onClick={() => setEdit(null)}>Cancel·la</button><button className="btn-primary" onClick={saveEdit}>Desa</button></>}>
        {edit && (
          <div className="grid gap-3">
            <Field label="Codi"><input className="input" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
            <Field label="Nom"><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Dia de la setmana" hint="El Mode Classe obre automàticament el grup del dia">
              <select className="input" value={edit.weekday ?? ''} onChange={(e) => setEdit({ ...edit, weekday: e.target.value ? Number(e.target.value) : null })}>
                <option value="">—</option>{DAYS.slice(1).map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </Field>
            <Field label="Horari"><input className="input" value={edit.schedule ?? ''} onChange={(e) => setEdit({ ...edit, schedule: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
      <Modal open={!!members} onClose={() => setMembers(null)} title={`Alumnes de ${members?.g.code}`} wide
        footer={<><span className="mr-auto text-sm text-ice/60">{members?.ids.length} seleccionats</span><button className="btn-ghost" onClick={() => setMembers(null)}>Cancel·la</button><button className="btn-primary" onClick={saveMembers}>Desa</button></>}>
        {members && (
          <>
            <input className="input mb-3" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
              {(students.data ?? []).filter((s) => s.active && (!q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q.toLowerCase()))).map((s) => {
                const on = members.ids.includes(s.id);
                return (
                  <button key={s.id} onClick={() => setMembers({ ...members, ids: on ? members.ids.filter((x) => x !== s.id) : [...members.ids, s.id] })}
                    className={`rounded-lg px-3 py-2 text-left text-sm ${on ? 'bg-cian/20 ring-1 ring-cian' : 'bg-white/5 hover:bg-white/10'}`}>
                    {on ? '✓ ' : ''}{s.first_name} {s.last_name}<span className="block text-xs text-ice/40">{s.groups.join(', ')}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
