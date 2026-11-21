import { useMemo, useState } from 'react';
import { rpc, useRpc } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { fmtDate } from '@/lib/format';
import { CrudSection } from '@/components/Crud';
import { Modal, PageHeader, Spinner } from '@/components/ui';
import type { AGroup, AStudent } from './AdminStudents';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Role = 'participa' | 'collabora' | 'destaca';
const ROLES: { v: Role; label: string; cls: string }[] = [
  { v: 'participa', label: 'Participa', cls: 'bg-cian text-night-900' },
  { v: 'collabora', label: 'Col·labora', cls: 'bg-violet text-white' },
  { v: 'destaca', label: 'Destaca', cls: 'bg-amber-400 text-night-900' },
];

export default function AdminActivities() {
  const badges = useRpc<Row[]>('admin_list', { p_table: 'badges' });
  const [open, setOpen] = useState<Row | null>(null);
  const badgeOpts = (badges.data ?? []).map((b) => ({ value: String(b.id), label: `${b.icon} ${b.name}` }));
  return (
    <div className="space-y-5">
      <PageHeader title="Activitats extraordinàries" icon="🏆" subtitle="Lliga Minecraft, Sumo, competicions, presentacions, jornades… Participar sempre té valor, independentment del resultat." />
      <CrudSection<Row> table="activities" title="Activitats"
        fields={[
          { key: 'name', label: 'Nom', required: true }, { key: 'activity_date', label: 'Data', type: 'date', required: true },
          { key: 'kind', label: 'Tipus', type: 'select', options: ['torneig', 'competicio', 'presentacio', 'jornada', 'comunitaria', 'altres'].map((v) => ({ value: v, label: v })) },
          { key: 'location', label: 'Lloc' }, { key: 'description', label: 'Descripció', type: 'textarea' },
          { key: 'xp_participa', label: 'XP per participar', type: 'number' }, { key: 'coins_participa', label: 'Coins per participar', type: 'number' },
          { key: 'xp_collabora', label: 'XP extra per col·laborar', type: 'number' }, { key: 'coins_collabora', label: 'Coins extra col·laborar', type: 'number' },
          { key: 'xp_destaca', label: 'XP extra per resultat destacat', type: 'number' }, { key: 'coins_destaca', label: 'Coins extra destacar', type: 'number' },
          { key: 'badge_id', label: 'Insígnia especial', type: 'select', options: badgeOpts },
        ]}
        defaults={{ kind: 'torneig', xp_participa: 40, coins_participa: 20, xp_collabora: 10, coins_collabora: 5, xp_destaca: 10, coins_destaca: 5, activity_date: new Date().toISOString().slice(0, 10) }}
        columns={[
          { label: 'Activitat', render: (r) => <span><strong>{r.name}</strong><span className="block text-xs text-ice/50">{r.kind} · {r.location}</span></span> },
          { label: 'Data', render: (r) => fmtDate(r.activity_date, true) },
          { label: 'XP', render: (r) => <span className="text-xs">{r.xp_participa} <span className="text-ice/40">+{r.xp_collabora} / +{r.xp_destaca}</span></span> },
        ]}
        extraActions={(r) => <button className="rounded-lg px-2 py-1 text-sm font-semibold text-amber-300 hover:bg-white/10" onClick={() => setOpen(r)}>👥 Participants</button>} />
      {open && <Participants activity={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Participants({ activity, onClose }: { activity: Row; onClose: () => void }) {
  const toast = useToast();
  const detail = useRpc<{ participants: { student_id: string; role: Role; awarded_at: string | null }[] }>('activity_detail', { p_activity_id: activity.id });
  const students = useRpc<AStudent[]>('admin_students');
  const groups = useRpc<AGroup[]>('admin_groups');
  const [roles, setRoles] = useState<Record<string, Role> | null>(null);
  const [gf, setGf] = useState('');
  const [busy, setBusy] = useState(false);

  const current = roles ?? Object.fromEntries((detail.data?.participants ?? []).map((p) => [p.student_id, p.role]));
  const awarded = new Set((detail.data?.participants ?? []).filter((p) => p.awarded_at).map((p) => p.student_id));
  const list = useMemo(() => (students.data ?? []).filter((s) => s.active && (!gf || s.group_ids.includes(gf))), [students.data, gf]);
  const count = Object.keys(current).length;

  function set(id: string, r: Role | null) {
    const n = { ...current };
    if (r) n[id] = r; else delete n[id];
    setRoles(n);
  }
  async function save(award: boolean) {
    setBusy(true);
    try {
      const r = await rpc<{ saved: number; awarded: number }>('admin_save_participants', {
        p_activity_id: activity.id, p_entries: Object.entries(current).map(([student_id, role]) => ({ student_id, role })), p_award: award,
      });
      toast({ kind: 'ok', text: award ? `Punts concedits: ${r.awarded} participants nous` : 'Participants desats' });
      onClose();
    } catch (e) { toast({ kind: 'error', text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={`Participants · ${activity.name}`} wide
      footer={<>
        <span className="mr-auto text-sm text-ice/60">{count} participants</span>
        <button className="btn-ghost" disabled={busy} onClick={() => save(false)}>Desa sense punts</button>
        <button className="btn-primary" disabled={busy || !count} onClick={() => save(true)}>Desa i concedeix punts</button>
      </>}>
      {!students.data || !detail.data ? <Spinner /> : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <select className="input w-auto" value={gf} onChange={(e) => setGf(e.target.value)}>
              <option value="">Tots els alumnes</option>
              {(groups.data ?? []).filter((g) => g.is_current).map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => { const n = { ...current }; list.forEach((s) => { if (!n[s.id]) n[s.id] = 'participa'; }); setRoles(n); }}>✓ Selecciona tots els visibles</button>
            <button className="btn-ghost" onClick={() => { const n = { ...current }; list.forEach((s) => { if (!awarded.has(s.id)) delete n[s.id]; }); setRoles(n); }}>Treu-los</button>
          </div>
          <p className="mb-2 text-xs text-ice/50">Participar: +{activity.xp_participa} XP · Col·labora: +{activity.xp_collabora} extra · Destaca: +{activity.xp_destaca} extra. Els que ja han rebut punts no es dupliquen.</p>
          <ul className="divide-y divide-white/5">
            {list.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 text-sm">{s.first_name} {s.last_name} <span className="text-xs text-ice/40">{s.groups.join(', ')}</span>{awarded.has(s.id) && <span className="chip ml-2 bg-mint/15 text-mint">✓ punts</span>}</span>
                <div className="flex gap-1">
                  {ROLES.map((r) => (
                    <button key={r.v} onClick={() => set(s.id, current[s.id] === r.v && !awarded.has(s.id) ? null : r.v)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${current[s.id] === r.v ? r.cls : 'bg-white/5 text-ice/50 hover:bg-white/10'}`}>{r.label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
